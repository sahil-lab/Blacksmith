import { FORMATION_COUNT, createParticleData } from "./formations";
import { createQualityGovernor } from "./quality";
import { sceneBlend } from "./scenes";
import {
  BACKGROUND_FRAGMENT,
  COMPOSITE_FRAGMENT,
  DOWNSAMPLE_FRAGMENT,
  FULLSCREEN_VERTEX,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  SPARK_FRAGMENT,
  SPARK_VERTEX,
  UPSAMPLE_FRAGMENT,
} from "./shaders";

export type StrikePoint = { x: number; y: number };

export type ForgeEngine = {
  /** Embers drawn at the current quality tier. */
  readonly drawn: number;
  frame(deltaSeconds: number): void;
  setScene(target: number): void;
  setSpin(value: number): void;
  setHeat(target: number): void;
  setPointer(clientX: number, clientY: number, active: boolean): void;
  setMotion(running: boolean, reduced: boolean): void;
  strike(point: StrikePoint | null, power: number): void;
  dispose(): void;
};

export type ForgeEngineOptions = {
  compact: boolean;
  /** Software renderers are refused by default; they cannot hold a frame rate. */
  allowSoftware: boolean;
  onContextLost: () => void;
};

type Target = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
};

type Tier = { scale: number; share: number; bloom: boolean };
type Uniforms = Record<string, WebGLUniformLocation | null>;
type Pass = { program: WebGLProgram; uniforms: Uniforms };

// Each tier trades resolution, particle share, and finally bloom for speed.
// The governor in quality.ts decides which one is drawn.
const TIERS: readonly Tier[] = [
  { scale: 1, share: 1, bloom: true },
  { scale: 0.78, share: 0.72, bloom: true },
  { scale: 0.58, share: 0.48, bloom: true },
  { scale: 0.42, share: 0.3, bloom: false },
];
const FIELD_OF_VIEW = (32 * Math.PI) / 180;
const TAN_HALF = Math.tan(FIELD_OF_VIEW / 2);
const SPARK_CAPACITY = 420;
const BLOOM_LEVELS = 5;
// The smoke behind the embers is smooth, so it is drawn this many times smaller
// in each direction and stretched back. At full size it was the most expensive
// pass on an integrated GPU.
const BACKDROP_DIVISOR = 4;
const MAX_PIXEL_RATIO = 1.75;
const GLOWS: readonly (readonly [number, number])[] = [
  [1, 0.42],
  [0.3, 0.55],
  [0.7, 0.46],
  [0.55, 0.75],
  [0.95, 0.42],
];

function required<T>(value: T | null, label: string): T {
  if (value === null) {
    throw new Error(`WebGL could not create ${label}.`);
  }
  return value;
}

/**
 * Some browsers hand out a CPU rasteriser even when asked to fail on a
 * performance caveat, so the reported renderer is checked as well.
 */
function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer: unknown = gl.getParameter(
    info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  );
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(renderer));
}

function createPass(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniformNames: readonly string[],
): Pass {
  const compile = (type: number, source: string) => {
    const shader = required(gl.createShader(type), "a shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "no log";
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${log}`);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = required(gl.createProgram(), "a program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "no log";
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  const uniforms: Uniforms = {};
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function perspective(out: Float32Array, aspect: number, near: number, far: number) {
  const focal = 1 / TAN_HALF;
  out.fill(0);
  out[0] = focal / aspect;
  out[5] = focal;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}

/** View matrix for a camera at the eye looking at the origin with +Y up. */
function lookAtOrigin(out: Float32Array, eyeX: number, eyeY: number, eyeZ: number) {
  const length = Math.hypot(eyeX, eyeY, eyeZ);
  const zx = eyeX / length;
  const zy = eyeY / length;
  const zz = eyeZ / length;
  const rightLength = Math.hypot(zz, zx);
  const xx = zz / rightLength;
  const xz = -zx / rightLength;
  const yx = zy * xz;
  const yy = zz * xx - zx * xz;
  const yz = -zy * xx;
  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = 0;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eyeX + xz * eyeZ);
  out[13] = -(yx * eyeX + yy * eyeY + yz * eyeZ);
  out[14] = -(zx * eyeX + zy * eyeY + zz * eyeZ);
  out[15] = 1;
}

/** Writes translate * rotateY(yaw) * rotateX(pitch) * scale for one formation. */
function place(
  out: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  scale: number,
) {
  const base = index * 16;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  out[base] = cy * scale;
  out[base + 1] = 0;
  out[base + 2] = -sy * scale;
  out[base + 3] = 0;
  out[base + 4] = sy * sx * scale;
  out[base + 5] = cx * scale;
  out[base + 6] = cy * sx * scale;
  out[base + 7] = 0;
  out[base + 8] = sy * cx * scale;
  out[base + 9] = -sx * scale;
  out[base + 10] = cy * cx * scale;
  out[base + 11] = 0;
  out[base + 12] = x;
  out[base + 13] = y;
  out[base + 14] = z;
  out[base + 15] = 1;
}

/**
 * Creates the ember sculpture renderer. Returns null when WebGL2 is unavailable
 * or the first frame reports a GL error, so the caller can show the static art.
 */
export function createForgeEngine(
  canvas: HTMLCanvasElement,
  options: ForgeEngineOptions,
): ForgeEngine | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: !options.allowSoftware,
  });
  if (!gl) {
    return null;
  }
  if (!options.allowSoftware && isSoftwareRenderer(gl)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  const background = createPass(gl, FULLSCREEN_VERTEX, BACKGROUND_FRAGMENT, [
    "uResolution",
    "uTime",
    "uHeat",
    "uGlow",
    "uGlowStrength",
  ]);
  const particles = createPass(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT, [
    "uProjection",
    "uView",
    "uModelFrom",
    "uModelTo",
    "uWave",
    "uGain",
    "uFrom",
    "uProgress",
    "uTime",
    "uHeat",
    "uPointScale",
    "uFocus",
    "uAperture",
    "uPointer",
    "uPointerForce",
    "uShock",
    "uShockPower",
    "uShockMotion",
    "uAmbient",
    "uFade",
  ]);
  const sparks = createPass(gl, SPARK_VERTEX, SPARK_FRAGMENT, [
    "uProjection",
    "uView",
    "uPointScale",
    "uHead",
  ]);
  const downsample = createPass(gl, FULLSCREEN_VERTEX, DOWNSAMPLE_FRAGMENT, [
    "uSource",
    "uTexel",
    "uThreshold",
  ]);
  const upsample = createPass(gl, FULLSCREEN_VERTEX, UPSAMPLE_FRAGMENT, [
    "uSource",
    "uTexel",
  ]);
  const composite = createPass(gl, FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT, [
    "uScene",
    "uBloom",
    "uBackdrop",
    "uBloomStrength",
    "uTime",
    "uPunch",
  ]);
  const passes = [background, particles, sparks, downsample, upsample, composite];

  const count = options.compact ? 26000 : 56000;
  const data = createParticleData(count);
  const stride = (FORMATION_COUNT + 1) * 4;
  const interleaved = new Float32Array(count * stride);
  for (let index = 0; index < count; index += 1) {
    const source = index * 4;
    const destination = index * stride;
    for (let formation = 0; formation < FORMATION_COUNT; formation += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        interleaved[destination + formation * 4 + channel] =
          data.formations[formation][source + channel];
      }
    }
    for (let channel = 0; channel < 4; channel += 1) {
      interleaved[destination + FORMATION_COUNT * 4 + channel] =
        data.seeds[source + channel];
    }
  }

  const particleArray = required(gl.createVertexArray(), "a vertex array");
  const particleBuffer = required(gl.createBuffer(), "a buffer");
  gl.bindVertexArray(particleArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
  for (let attribute = 0; attribute <= FORMATION_COUNT; attribute += 1) {
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, stride * 4, attribute * 16);
  }

  // Each spark is a line from a faded tail vertex to a bright head vertex.
  const sparkState = new Float32Array(SPARK_CAPACITY * 8);
  const sparkVertices = new Float32Array(SPARK_CAPACITY * 8);
  const sparkBuffer = required(gl.createBuffer(), "a buffer");
  const sparkLines = required(gl.createVertexArray(), "a vertex array");
  gl.bindVertexArray(sparkLines);
  gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sparkVertices.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  const sparkHeads = required(gl.createVertexArray(), "a vertex array");
  gl.bindVertexArray(sparkHeads);
  gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 16);
  const fullscreenArray = required(gl.createVertexArray(), "a vertex array");
  gl.bindVertexArray(null);

  let targetFormat: number = gl.RGBA8;
  const createTarget = (targetWidth: number, targetHeight: number): Target => {
    const texture = required(gl.createTexture(), "a texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, targetFormat, targetWidth, targetHeight);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = required(gl.createFramebuffer(), "a framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    return { framebuffer, texture, width: targetWidth, height: targetHeight };
  };
  const destroyTarget = (target: Target) => {
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
  };

  // Prefer half-float targets for smooth highlights; fall back to 8-bit.
  if (
    gl.getExtension("EXT_color_buffer_float") ??
    gl.getExtension("EXT_color_buffer_half_float")
  ) {
    targetFormat = gl.RGBA16F;
    const probe = createTarget(4, 4);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      targetFormat = gl.RGBA8;
    }
    destroyTarget(probe);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const projection = new Float32Array(16);
  const view = new Float32Array(16);
  const models = new Float32Array(16 * FORMATION_COUNT);
  const waves = new Float32Array([0, 0, 0, 0.3, 0]);
  const gains = new Float32Array([1, 0.55, 0.5, 0.6, 0.5]);
  const quality = createQualityGovernor(TIERS.length);
  const drawnCount = () =>
    Math.max(data.ambient, Math.floor(count * TIERS[quality.tier].share));
  const pointer = { x: 0, y: 0, goalX: 0, goalY: 0, force: 0, active: false, idle: 9 };
  const shock = { x: 0, y: 0, z: 0, age: -1, power: 0 };

  let sceneTarget: Target | null = null;
  let backdropTarget: Target | null = null;
  let bloomTargets: Target[] = [];
  let width = 0;
  let height = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let aspect = 1;
  let distance = 10;
  let halfWidth = 1;
  let halfHeight = 1;
  let time = 0;
  let scene = 0;
  let sceneGoal = 0;
  let shownScene = 0;
  let fade = 1;
  let heat = 0.3;
  let heatGoal = 0.3;
  let spin = 0;
  let punch = 0;
  let running = true;
  let reduced = false;
  let dirty = true;
  let disposed = false;
  let lost = false;

  const allocate = () => {
    const tier = TIERS[quality.tier];
    const nextWidth = Math.max(2, Math.round(cssWidth * pixelRatio * tier.scale));
    const nextHeight = Math.max(2, Math.round(cssHeight * pixelRatio * tier.scale));
    if (sceneTarget && nextWidth === width && nextHeight === height) {
      return;
    }
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    if (sceneTarget) {
      destroyTarget(sceneTarget);
    }
    if (backdropTarget) {
      destroyTarget(backdropTarget);
    }
    bloomTargets.forEach(destroyTarget);
    sceneTarget = createTarget(width, height);
    backdropTarget = createTarget(
      Math.max(2, Math.round(width / BACKDROP_DIVISOR)),
      Math.max(2, Math.round(height / BACKDROP_DIVISOR)),
    );
    bloomTargets = [];
    let levelWidth = width;
    let levelHeight = height;
    for (let level = 0; level < BLOOM_LEVELS; level += 1) {
      levelWidth = Math.max(2, levelWidth >> 1);
      levelHeight = Math.max(2, levelHeight >> 1);
      bloomTargets.push(createTarget(levelWidth, levelHeight));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    dirty = true;
  };

  const measure = () => {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    if (
      nextWidth === cssWidth &&
      nextHeight === cssHeight &&
      nextRatio === pixelRatio
    ) {
      return;
    }
    cssWidth = nextWidth;
    cssHeight = nextHeight;
    pixelRatio = nextRatio;
    if (cssWidth < 1 || cssHeight < 1) {
      return;
    }
    aspect = cssWidth / cssHeight;
    // Dolly back on narrow screens so formations keep their full width.
    distance = Math.max(10, 3.25 / (TAN_HALF * aspect));
    halfHeight = distance * TAN_HALF;
    halfWidth = halfHeight * aspect;
    perspective(projection, aspect, 0.1, 140);
    allocate();
    quality.restart();
  };

  const layout = () => {
    const sway = Math.sin(time * 0.21) * 0.2;
    const tiltX = pointer.x * 0.26;
    const tiltY = pointer.y * 0.09;
    if (aspect >= 1) {
      place(
        models,
        0,
        halfWidth * 0.4,
        halfHeight * 0.17,
        0,
        -0.5 + sway + tiltX,
        0.2 - tiltY,
        Math.min(1.1, halfWidth * 0.195),
      );
      place(
        models,
        1,
        halfWidth * 0.22,
        -halfHeight * 0.5,
        -1.4,
        -0.75 + sway * 0.5 + tiltX * 0.6,
        0.24 - tiltY,
        Math.min(1.05, halfWidth * 0.2),
      );
      // The pool sits low and central so it stays visible beneath the header
      // and glows through the glass cards as they slide across it.
      place(
        models,
        2,
        halfWidth * 0.22,
        -halfHeight * 0.5,
        -1.4,
        -0.75 + spin * 1.1 + tiltX * 0.6,
        0.24 - tiltY,
        Math.min(1.05, halfWidth * 0.2),
      );
      // Tilted up towards the horizon so the field fills the lower half of the view.
      place(models, 3, 0, -halfHeight * 0.64 + 1.6, 0, sway * 0.12, 0.12, 1);
      place(
        models,
        4,
        halfWidth * 0.5,
        halfHeight * 0.16,
        0,
        -0.45 + sway + tiltX,
        0.16 - tiltY,
        Math.min(1.15, halfWidth * 0.2),
      );
    } else {
      place(
        models,
        0,
        halfWidth * 0.04,
        halfHeight * 0.36,
        0,
        -0.42 + sway + tiltX,
        0.2 - tiltY,
        halfWidth * 0.37,
      );
      place(
        models,
        1,
        0,
        -halfHeight * 0.42,
        -1,
        -0.8 + sway * 0.5,
        0.24,
        halfWidth * 0.3,
      );
      place(
        models,
        2,
        0,
        -halfHeight * 0.45,
        0,
        -0.5 + spin * 1.1,
        0.22,
        halfWidth * 0.34,
      );
      place(models, 3, 0, -halfHeight * 0.6 + 2.24, 0, sway * 0.12, 0.1, 1.4);
      // Centred between the footer's claim and its wordmark.
      place(models, 4, 0, 0, 0, -0.4 + sway + tiltX, 0.16, halfWidth * 0.42);
    }
  };

  const stepSparks = (step: number): number => {
    let alive = 0;
    const drag = Math.exp(-step * 1.3);
    for (let index = 0; index < SPARK_CAPACITY; index += 1) {
      const base = index * 8;
      if (sparkState[base + 6] <= 0) {
        continue;
      }
      const life = sparkState[base + 6] - step;
      sparkState[base + 6] = life;
      if (life <= 0) {
        continue;
      }
      const vx = sparkState[base + 3] * drag;
      const vy = (sparkState[base + 4] - 7.5 * step) * drag;
      const vz = sparkState[base + 5] * drag;
      const x = sparkState[base] + vx * step;
      const y = sparkState[base + 1] + vy * step;
      const z = sparkState[base + 2] + vz * step;
      sparkState[base] = x;
      sparkState[base + 1] = y;
      sparkState[base + 2] = z;
      sparkState[base + 3] = vx;
      sparkState[base + 4] = vy;
      sparkState[base + 5] = vz;
      const out = alive * 8;
      sparkVertices[out] = x - vx * 0.05;
      sparkVertices[out + 1] = y - vy * 0.05;
      sparkVertices[out + 2] = z - vz * 0.05;
      sparkVertices[out + 3] = 0;
      sparkVertices[out + 4] = x;
      sparkVertices[out + 5] = y;
      sparkVertices[out + 6] = z;
      sparkVertices[out + 7] = Math.pow(life / sparkState[base + 7], 0.6);
      alive += 1;
    }
    return alive;
  };

  const spawnSparks = (x: number, y: number, z: number, amount: number) => {
    let spawned = 0;
    for (let index = 0; index < SPARK_CAPACITY && spawned < amount; index += 1) {
      const base = index * 8;
      if (sparkState[base + 6] > 0) {
        continue;
      }
      const angle = Math.random() * Math.PI * 2;
      const spread = (0.35 + Math.random()) * 0.75;
      const speed = 1.6 + Math.random() * 5.2;
      const life = 0.35 + Math.random() * 0.95;
      sparkState[base] = x + (Math.random() - 0.5) * 0.3;
      sparkState[base + 1] = y;
      sparkState[base + 2] = z + (Math.random() - 0.5) * 0.2;
      sparkState[base + 3] = Math.cos(angle) * spread * speed;
      sparkState[base + 4] = (0.45 + Math.random() * 0.9) * speed;
      sparkState[base + 5] = Math.sin(angle) * spread * speed;
      sparkState[base + 6] = life;
      sparkState[base + 7] = life;
      spawned += 1;
    }
  };

  const drawFullscreen = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  const render = (target: Target, backdrop: Target, aliveSparks: number) => {
    layout();
    lookAtOrigin(view, pointer.x * 0.5, pointer.y * 0.28, distance);
    const tier = TIERS[quality.tier];
    const pointScale = height / (2 * TAN_HALF);

    const { from, progress } = sceneBlend(scene, FORMATION_COUNT);
    const blend = progress * progress * (3 - 2 * progress);
    const glowAt = (index: number, channel: number) => {
      const base = index * 16;
      const scale = Math.hypot(models[base], models[base + 1], models[base + 2]);
      if (channel === 0) {
        return 0.5 + models[base + 12] / (2 * halfWidth);
      }
      return (
        0.5 +
        (models[base + 13] + (index === 3 ? -1.6 : 0.6) * scale) / (2 * halfHeight)
      );
    };
    const mixGlow = (a: number, b: number) => a + (b - a) * blend;

    gl.bindFramebuffer(gl.FRAMEBUFFER, backdrop.framebuffer);
    gl.viewport(0, 0, backdrop.width, backdrop.height);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(fullscreenArray);
    gl.useProgram(background.program);
    // Only the aspect ratio is read, so the full-size figures keep it exact.
    gl.uniform2f(background.uniforms.uResolution, width, height);
    gl.uniform1f(background.uniforms.uTime, time);
    gl.uniform1f(background.uniforms.uHeat, heat);
    // On narrow screens the glow would otherwise span the whole width and
    // flatten the page into one red wash.
    const reach = Math.min(1, 0.5 + 0.5 * aspect);
    gl.uniform3f(
      background.uniforms.uGlow,
      mixGlow(glowAt(from, 0), glowAt(from + 1, 0)),
      mixGlow(glowAt(from, 1), glowAt(from + 1, 1)),
      mixGlow(GLOWS[from][1], GLOWS[from + 1][1]) * reach,
    );
    gl.uniform1f(
      background.uniforms.uGlowStrength,
      mixGlow(GLOWS[from][0], GLOWS[from + 1][0]) * fade,
    );
    drawFullscreen();

    // Embers accumulate on black; the composite pass adds the smoke behind them.
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(particles.program);
    gl.bindVertexArray(particleArray);
    gl.uniformMatrix4fv(particles.uniforms.uProjection, false, projection);
    gl.uniformMatrix4fv(particles.uniforms.uView, false, view);
    gl.uniformMatrix4fv(particles.uniforms.uModelFrom, false, models, from * 16, 16);
    gl.uniformMatrix4fv(
      particles.uniforms.uModelTo,
      false,
      models,
      (from + 1) * 16,
      16,
    );
    gl.uniform2f(particles.uniforms.uWave, waves[from], waves[from + 1]);
    gl.uniform2f(particles.uniforms.uGain, gains[from], gains[from + 1]);
    gl.uniform1i(particles.uniforms.uFrom, from);
    gl.uniform1f(particles.uniforms.uProgress, progress);
    gl.uniform1f(particles.uniforms.uTime, time);
    gl.uniform1f(particles.uniforms.uHeat, heat);
    gl.uniform1f(particles.uniforms.uPointScale, pointScale);
    gl.uniform1f(particles.uniforms.uFocus, distance);
    gl.uniform1f(particles.uniforms.uAperture, 0.06);
    gl.uniform3f(
      particles.uniforms.uPointer,
      pointer.goalX * halfWidth,
      pointer.goalY * halfHeight,
      0,
    );
    gl.uniform1f(particles.uniforms.uPointerForce, pointer.force);
    gl.uniform4f(particles.uniforms.uShock, shock.x, shock.y, shock.z, shock.age);
    gl.uniform1f(particles.uniforms.uShockPower, shock.power);
    gl.uniform1f(particles.uniforms.uShockMotion, reduced ? 0 : 1);
    gl.uniform1f(particles.uniforms.uAmbient, data.ambient);
    gl.uniform1f(particles.uniforms.uFade, fade);
    gl.drawArrays(gl.POINTS, 0, drawnCount());

    if (aliveSparks > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sparkVertices, 0, aliveSparks * 8);
      gl.useProgram(sparks.program);
      gl.uniformMatrix4fv(sparks.uniforms.uProjection, false, projection);
      gl.uniformMatrix4fv(sparks.uniforms.uView, false, view);
      gl.uniform1f(sparks.uniforms.uPointScale, pointScale);
      gl.bindVertexArray(sparkLines);
      gl.uniform1f(sparks.uniforms.uHead, 0);
      gl.drawArrays(gl.LINES, 0, aliveSparks * 2);
      gl.bindVertexArray(sparkHeads);
      gl.uniform1f(sparks.uniforms.uHead, 1);
      gl.drawArrays(gl.POINTS, 0, aliveSparks);
    }

    gl.bindVertexArray(fullscreenArray);
    gl.activeTexture(gl.TEXTURE0);
    let bloomTexture = target.texture;
    let bloomStrength = 0;
    if (tier.bloom && bloomTargets.length > 0) {
      gl.disable(gl.BLEND);
      gl.useProgram(downsample.program);
      gl.uniform1i(downsample.uniforms.uSource, 0);
      let source = target;
      bloomTargets.forEach((level, index) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, level.framebuffer);
        gl.viewport(0, 0, level.width, level.height);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);
        gl.uniform2f(downsample.uniforms.uTexel, 1 / source.width, 1 / source.height);
        gl.uniform1f(downsample.uniforms.uThreshold, index === 0 ? 0.8 : 0);
        drawFullscreen();
        source = level;
      });
      gl.enable(gl.BLEND);
      gl.useProgram(upsample.program);
      gl.uniform1i(upsample.uniforms.uSource, 0);
      for (let index = bloomTargets.length - 1; index > 0; index -= 1) {
        const small = bloomTargets[index];
        const large = bloomTargets[index - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, large.framebuffer);
        gl.viewport(0, 0, large.width, large.height);
        gl.bindTexture(gl.TEXTURE_2D, small.texture);
        gl.uniform2f(upsample.uniforms.uTexel, 0.5 / small.width, 0.5 / small.height);
        drawFullscreen();
      }
      bloomTexture = bloomTargets[0].texture;
      bloomStrength = 0.6;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(composite.program);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(composite.uniforms.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTexture);
    gl.uniform1i(composite.uniforms.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
    gl.uniform1i(composite.uniforms.uBackdrop, 2);
    gl.uniform1f(composite.uniforms.uBloomStrength, bloomStrength);
    gl.uniform1f(composite.uniforms.uTime, time);
    gl.uniform1f(composite.uniforms.uPunch, punch);
    drawFullscreen();
    // Leave no render target bound to a sampler for the next frame.
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  };

  const frame = (deltaSeconds: number) => {
    if (disposed || lost) {
      return;
    }
    measure();
    if (!sceneTarget || !backdropTarget) {
      return;
    }
    const step = Math.min(Math.max(deltaSeconds, 0), 0.05);
    const moving = running && !reduced;
    if (moving) {
      time += step;
    }

    let sceneSettled: boolean;
    if (reduced) {
      // No flight under reduced motion: cross-fade between whole formations.
      const snapped = Math.round(sceneGoal);
      const fadeGoal = snapped === shownScene ? 1 : 0;
      fade += (fadeGoal - fade) * Math.min(1, step * 9);
      if (fadeGoal === 0 && fade < 0.03) {
        shownScene = snapped;
      }
      scene = shownScene;
      sceneSettled = fadeGoal === 1 && fade > 0.995;
    } else {
      scene += (sceneGoal - scene) * (1 - Math.exp(-step * 4.2));
      fade += (1 - fade) * Math.min(1, step * 9);
      shownScene = Math.round(scene);
      sceneSettled = Math.abs(sceneGoal - scene) < 0.0004 && fade > 0.995;
    }

    heat += (heatGoal - heat) * (1 - Math.exp(-step * 1.6));
    const heatSettled = Math.abs(heatGoal - heat) < 0.002;

    const ease = 1 - Math.exp(-step * 3);
    pointer.x += (pointer.goalX - pointer.x) * ease;
    pointer.y += (pointer.goalY - pointer.y) * ease;
    pointer.idle += step;
    const forceGoal = moving && pointer.active && pointer.idle < 2.2 ? 1 : 0;
    pointer.force += (forceGoal - pointer.force) * (1 - Math.exp(-step * 5));
    const pointerSettled =
      Math.abs(forceGoal - pointer.force) < 0.003 &&
      Math.abs(pointer.goalX - pointer.x) < 0.002 &&
      Math.abs(pointer.goalY - pointer.y) < 0.002;

    if (shock.age >= 0) {
      shock.age += step;
      if (shock.age > 2.4) {
        shock.age = -1;
      }
    }
    punch = punch < 0.002 ? 0 : punch * Math.exp(-step * 7);
    const aliveSparks = stepSparks(step);

    const active =
      moving ||
      dirty ||
      !sceneSettled ||
      !heatSettled ||
      !pointerSettled ||
      shock.age >= 0 ||
      punch > 0 ||
      aliveSparks > 0;
    if (!active) {
      return;
    }
    dirty = false;
    if (moving && quality.sample(deltaSeconds)) {
      allocate();
    }
    render(sceneTarget, backdropTarget, aliveSparks);
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    options.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    canvas.removeEventListener("webglcontextlost", onContextLost);
    if (sceneTarget) {
      destroyTarget(sceneTarget);
    }
    if (backdropTarget) {
      destroyTarget(backdropTarget);
    }
    bloomTargets.forEach(destroyTarget);
    passes.forEach((pass) => gl.deleteProgram(pass.program));
    gl.deleteBuffer(particleBuffer);
    gl.deleteBuffer(sparkBuffer);
    [particleArray, sparkLines, sparkHeads, fullscreenArray].forEach((array) =>
      gl.deleteVertexArray(array),
    );
  };

  const engine: ForgeEngine = {
    get drawn() {
      return drawnCount();
    },
    frame,
    setScene(target) {
      sceneGoal = Math.min(Math.max(target, 0), FORMATION_COUNT - 1);
    },
    setSpin(value) {
      if (value !== spin) {
        spin = value;
        dirty = true;
      }
    },
    setHeat(target) {
      heatGoal = Math.min(Math.max(target, 0), 1);
    },
    setPointer(clientX, clientY, active) {
      pointer.active = active && !reduced;
      if (!pointer.active || cssWidth < 1 || cssHeight < 1) {
        pointer.goalX = 0;
        pointer.goalY = 0;
        return;
      }
      pointer.goalX = (clientX / cssWidth) * 2 - 1;
      pointer.goalY = 1 - (clientY / cssHeight) * 2;
      pointer.idle = 0;
    },
    setMotion(nextRunning, nextReduced) {
      if (nextRunning === running && nextReduced === reduced) {
        return;
      }
      running = nextRunning;
      reduced = nextReduced;
      if (reduced) {
        pointer.active = false;
        pointer.goalX = 0;
        pointer.goalY = 0;
      }
      dirty = true;
    },
    strike(point, power) {
      let x: number;
      let y: number;
      let z = 0;
      if (point && cssWidth > 0 && cssHeight > 0) {
        x = ((point.x / cssWidth) * 2 - 1) * halfWidth;
        y = (1 - (point.y / cssHeight) * 2) * halfHeight;
      } else {
        // The glowing workpiece on the anvil face, in world space.
        x = models[0] * -0.35 + models[4] * 1.3 + models[12];
        y = models[1] * -0.35 + models[5] * 1.3 + models[13];
        z = models[2] * -0.35 + models[6] * 1.3 + models[14];
      }
      shock.x = x;
      shock.y = y;
      shock.z = z;
      shock.age = 0;
      shock.power = power;
      if (!reduced) {
        punch = Math.min(1, power);
        spawnSparks(x, y, z, Math.round(110 * power));
      }
      dirty = true;
    },
    dispose,
  };

  frame(0);
  if (gl.getError() !== gl.NO_ERROR) {
    dispose();
    return null;
  }
  return engine;
}
