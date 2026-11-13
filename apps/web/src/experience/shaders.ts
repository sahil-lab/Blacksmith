/* GLSL ES 3.00 sources for the ember sculpture. Colours are authored in linear light. */

export const FULLSCREEN_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

export const BACKGROUND_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHeat;
uniform vec3 uGlow;
uniform float uGlowStrength;
out vec4 outColor;

// Lattice hash in exact integer arithmetic. A float-product hash amplifies a
// one-bit rounding difference into a different value, and Direct3D evaluates
// hash(cell + offset) differently from hash(neighbour): the smoke then shows
// hard-edged cells on real GPUs while software renderers look smooth.
float hash(vec2 point) {
  uvec2 cell = uvec2(ivec2(point));
  uint n = cell.x * 1597334677u ^ cell.y * 3812015801u;
  n = (n ^ (n >> 16u)) * 2246822519u;
  n = (n ^ (n >> 13u)) * 3266489917u;
  n ^= n >> 16u;
  return float(n >> 8u) * (1.0 / 16777215.0);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
    blend.y
  );
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(point);
    point = point * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 point = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  vec3 cold = vec3(0.0052, 0.0068, 0.0105);
  vec3 warm = vec3(0.0088, 0.0052, 0.0034);
  vec3 base = mix(cold, warm, uHeat);

  vec2 drift = point * 1.5 + vec2(0.0, -uTime * 0.028);
  float smoke = fbm(drift + fbm(drift * 1.7 + uTime * 0.017) * 0.85);

  vec2 centre = vec2((uGlow.x - 0.5) * aspect, uGlow.y - 0.5);
  float falloff = length(point - centre) / uGlow.z;
  float glow = exp(-falloff * falloff * 2.4);
  vec2 corner = vec2(-0.5 * aspect, -0.5);
  float ground = exp(-dot(point - corner, point - corner) * 1.9) * 0.3;

  vec3 ember = mix(vec3(0.03, 0.07, 0.14), vec3(1.0, 0.2, 0.03), uHeat);
  vec3 color = base * (0.7 + 0.9 * smoke);
  color += ember * (glow * uGlowStrength + ground * uHeat) * (0.3 + 0.95 * smoke) * 0.16;
  outColor = vec4(color, 1.0);
}`;

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aFormation0;
layout(location = 1) in vec4 aFormation1;
layout(location = 2) in vec4 aFormation2;
layout(location = 3) in vec4 aFormation3;
layout(location = 4) in vec4 aFormation4;
layout(location = 5) in vec4 aSeed;

uniform mat4 uProjection;
uniform mat4 uView;
// The application picks the two formations being blended and passes their
// matrices directly. Direct3D 11, the default WebGL backend on Windows,
// miscompiles dynamic indexing into a mat4 uniform array: models[from + 1]
// silently reads models[from].
uniform mat4 uModelFrom;
uniform mat4 uModelTo;
uniform vec2 uWave;
uniform vec2 uGain;
uniform int uFrom;
uniform float uProgress;
uniform float uTime;
uniform float uHeat;
uniform float uPointScale;
uniform float uFocus;
uniform float uAperture;
uniform vec3 uPointer;
uniform float uPointerForce;
uniform vec4 uShock;
uniform float uShockPower;
uniform float uShockMotion;
uniform float uAmbient;
uniform float uFade;

out float vTemperature;
out float vAlpha;
out float vBlur;

vec4 formation(int index) {
  if (index == 0) return aFormation0;
  if (index == 1) return aFormation1;
  if (index == 2) return aFormation2;
  if (index == 3) return aFormation3;
  return aFormation4;
}

vec3 flow(vec3 point, float time) {
  return 0.5 * vec3(
    sin(point.y * 1.7 + time) + sin(point.z * 1.3 - time * 0.7),
    sin(point.z * 1.5 + time * 0.8) + sin(point.x * 1.9 + time * 0.6),
    sin(point.x * 1.4 - time * 0.9) + sin(point.y * 1.6 + time * 0.5)
  );
}

void main() {
  float delay = aSeed.x * 0.42;
  float travel = smoothstep(delay, delay + 0.58, uProgress);

  vec4 start = formation(uFrom);
  vec4 end = formation(uFrom + 1);
  vec3 startPosition = (uModelFrom * vec4(start.xyz, 1.0)).xyz;
  vec3 endPosition = (uModelTo * vec4(end.xyz, 1.0)).xyz;
  vec2 swell = vec2(
    sin(startPosition.x * 0.55 + uTime * 0.5) * cos(startPosition.z * 0.45 + uTime * 0.35),
    sin(endPosition.x * 0.55 + uTime * 0.5) * cos(endPosition.z * 0.45 + uTime * 0.35)
  ) * uWave;
  startPosition.y += swell.x;
  endPosition.y += swell.y;

  vec3 position = mix(startPosition, endPosition, travel);
  float temperature = mix(start.w, end.w, travel);
  bool ambient = float(gl_VertexID) < uAmbient;
  // Crests of the ember field run hotter, so its swell reads as moving light.
  if (!ambient) {
    temperature += max(mix(swell.x, swell.y, travel), 0.0) * 1.5;
  }
  float edgeFade = 1.0;

  float flight = sin(travel * 3.14159265);
  vec3 turbulence = flow(position * 0.55 + aSeed.yzw * 6.2831853, uTime * 0.4);
  position += turbulence * flight * (ambient ? 0.3 : 1.5);
  position.y += flight * (aSeed.z - 0.35) * (ambient ? 0.2 : 1.4);
  temperature += flight * 0.32;

  position += flow(position * 1.6 + aSeed.zwy * 9.0, uTime * 0.7)
    * (0.012 + 0.03 * temperature);

  if (ambient) {
    float speed = 0.1 + aSeed.w * 0.25;
    float wrapped = mod(position.y + uTime * speed + 5.0, 10.0);
    position.y = wrapped - 5.0;
    position.x += sin(uTime * 0.25 + aSeed.z * 40.0) * 0.3;
    edgeFade = smoothstep(0.0, 1.0, wrapped) * smoothstep(10.0, 9.0, wrapped);
  }

  vec3 away = position - uPointer;
  float reach = dot(away.xy, away.xy) + away.z * away.z * 0.25;
  float influence = uPointerForce * exp(-reach * 1.6);
  position += normalize(away + vec3(0.0001)) * influence * (0.25 + aSeed.w * 0.55);
  temperature += influence * 0.9;

  if (uShock.w >= 0.0) {
    vec3 offset = position - uShock.xyz;
    float range = length(offset);
    float front = uShock.w * 7.0;
    float shell = exp(-(range - front) * (range - front) * 1.4);
    float decay = exp(-uShock.w * 2.6);
    float kick = shell * decay * uShockPower;
    position += normalize(offset + vec3(0.0001)) * kick * (0.35 + aSeed.x * 0.9) * uShockMotion;
    position.y += kick * 0.35 * uShockMotion;
    temperature += kick * 1.2 + decay * uShockPower * 0.3 * exp(-range * range * 0.5);
  }

  temperature = clamp(temperature, 0.0, 1.6) * mix(0.12, 1.0, uHeat);

  vec4 viewPosition = uView * vec4(position, 1.0);
  gl_Position = uProjection * viewPosition;
  float depth = max(-viewPosition.z, 0.1);
  float blur = min(abs(1.0 / uFocus - 1.0 / depth) * uAperture * uPointScale, 34.0);
  float radius = (0.016 + 0.02 * aSeed.w) * (0.75 + 0.5 * temperature) * (ambient ? 1.5 : 1.0);
  float size = radius * uPointScale / depth;
  float total = size + blur;
  float covered = max(total, 1.0);
  gl_PointSize = min(covered, 72.0);

  float flicker = 0.8 + 0.2 * sin(uTime * (2.0 + aSeed.y * 5.0) + aSeed.z * 50.0);
  float energy = (size * size) / (covered * covered);
  // Fog is relative to the focal distance, so a far camera (narrow screens)
  // fades the same share of the scene as a near one.
  float fog = exp(-max(depth - uFocus, 0.0) * 0.7 / uFocus);
  // Dense formations would otherwise sum to pure white; each has its own gain.
  float gain = ambient ? 0.7 : mix(uGain.x, uGain.y, travel);
  vAlpha = (0.22 + 0.8 * temperature * temperature) * flicker * gain
    * mix(energy, 1.0, 0.1) * fog * edgeFade * uFade;
  vTemperature = temperature;
  vBlur = blur / covered;
}`;

export const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float vTemperature;
in float vAlpha;
in float vBlur;
out vec4 outColor;

vec3 heatColor(float temperature) {
  vec3 iron = vec3(0.1, 0.14, 0.2);
  vec3 ember = vec3(0.55, 0.045, 0.004);
  vec3 flame = vec3(1.0, 0.24, 0.02);
  vec3 amber = vec3(1.0, 0.56, 0.12);
  vec3 white = vec3(1.0, 0.9, 0.7);
  vec3 color = mix(iron, ember, smoothstep(0.08, 0.3, temperature));
  color = mix(color, flame, smoothstep(0.25, 0.55, temperature));
  color = mix(color, amber, smoothstep(0.5, 0.82, temperature));
  return mix(color, white, smoothstep(0.8, 1.15, temperature));
}

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radius = dot(point, point);
  if (radius > 1.0) discard;
  float core = exp(-radius * 4.5);
  float disc = smoothstep(1.0, 0.72, radius) * 0.5
    + 0.28 * smoothstep(0.5, 0.95, radius) * smoothstep(1.0, 0.9, radius);
  float alpha = mix(core, disc, smoothstep(0.35, 0.8, vBlur)) * vAlpha;
  outColor = vec4(heatColor(vTemperature) * alpha, alpha);
}`;

export const SPARK_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSpark;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uPointScale;
out float vEnergy;
void main() {
  vec4 viewPosition = uView * vec4(aSpark.xyz, 1.0);
  gl_Position = uProjection * viewPosition;
  gl_PointSize = clamp(0.04 * uPointScale / max(-viewPosition.z, 0.1), 1.5, 10.0);
  vEnergy = aSpark.w;
}`;

export const SPARK_FRAGMENT = `#version 300 es
precision highp float;
in float vEnergy;
uniform float uHead;
out vec4 outColor;
void main() {
  float shape = 1.0;
  if (uHead > 0.5) {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float radius = dot(point, point);
    if (radius > 1.0) discard;
    shape = exp(-radius * 3.0);
  }
  vec3 color = mix(vec3(0.9, 0.12, 0.01), vec3(1.0, 0.85, 0.55), smoothstep(0.25, 0.9, vEnergy));
  float alpha = vEnergy * shape;
  outColor = vec4(color * alpha * 2.6, alpha);
}`;

export const DOWNSAMPLE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 outColor;
void main() {
  vec3 sum = texture(uSource, vUv).rgb * 4.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  vec3 color = sum / 8.0;
  if (uThreshold > 0.0) {
    float brightness = max(color.r, max(color.g, color.b));
    float knee = clamp(brightness - uThreshold + 0.25, 0.0, 0.5);
    float contribution = max(knee * knee, brightness - uThreshold) / max(brightness, 0.0001);
    color *= contribution;
  }
  outColor = vec4(color, 1.0);
}`;

export const UPSAMPLE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec2 o = uTexel;
  vec3 sum = texture(uSource, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  sum += texture(uSource, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture(uSource, vUv + vec2(0.0, o.y * 2.0)).rgb;
  sum += texture(uSource, vUv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture(uSource, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  sum += texture(uSource, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture(uSource, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  sum += texture(uSource, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  outColor = vec4(sum / 12.0, 1.0);
}`;

export const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uBackdrop;
uniform float uBloomStrength;
uniform float uTime;
uniform float uPunch;
out vec4 outColor;

float hash(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec3 tonemap(vec3 color) {
  return clamp(
    (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14),
    0.0,
    1.0
  );
}

void main() {
  vec2 centred = vUv - 0.5;
  float radius = dot(centred, centred);
  vec2 uv = 0.5 + centred * (1.0 - uPunch * 0.022);
  vec2 fringe = centred * (0.0015 + uPunch * 0.02) * (0.35 + radius * 3.0);
  vec3 color = vec3(
    texture(uScene, uv + fringe).r,
    texture(uScene, uv).g,
    texture(uScene, uv - fringe).b
  );
  color += texture(uBloom, uv).rgb * uBloomStrength;
  color += texture(uBackdrop, uv).rgb;
  color *= 1.0 - radius * 0.85;
  color = pow(tonemap(color * 1.05), vec3(1.0 / 2.2));
  color += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.026;
  outColor = vec4(color, 1.0);
}`;
