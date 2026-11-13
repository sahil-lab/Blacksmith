/**
 * Point clouds for the ember sculpture. Every formation is illustrative art:
 * none of these shapes is derived from runner, job, or scheduling data.
 */
export const FORMATION_COUNT = 5;

export type ParticleData = {
  count: number;
  ambient: number;
  formations: Float32Array[];
  seeds: Float32Array;
};

type Point = readonly [number, number];
type Triple = readonly [number, number, number];
type Emit = (x: number, y: number, z: number, temperature: number) => void;
type Random = () => number;

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const amount = clamp01((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
};

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function curveTo(points: Point[], control: Point, end: Point, steps: number) {
  const start = points[points.length - 1];
  for (let step = 1; step <= steps; step += 1) {
    const amount = step / steps;
    const inverse = 1 - amount;
    points.push([
      inverse * inverse * start[0] +
        2 * inverse * amount * control[0] +
        amount * amount * end[0],
      inverse * inverse * start[1] +
        2 * inverse * amount * control[1] +
        amount * amount * end[1],
    ]);
  }
}

/** Side profile of a London-pattern anvil: heel on the left, horn on the right. */
export function anvilOutline(): Point[] {
  const points: Point[] = [
    [-1.75, 1.15],
    [0.95, 1.15],
    [0.95, 1.02],
    [1.2, 1.02],
  ];
  curveTo(points, [1.95, 1.0], [2.55, 0.74], 10);
  curveTo(points, [1.75, 0.62], [1.05, 0.38], 10);
  curveTo(points, [0.52, 0.2], [0.5, -0.3], 8);
  curveTo(points, [0.55, -0.78], [1.35, -0.86], 8);
  points.push([1.35, -1.15], [0.55, -1.15]);
  curveTo(points, [0, -0.93], [-0.55, -1.15], 8);
  points.push([-1.35, -1.15], [-1.35, -0.86]);
  curveTo(points, [-0.55, -0.78], [-0.5, -0.3], 8);
  curveTo(points, [-0.52, 0.25], [-1.0, 0.45], 8);
  points.push([-1.75, 0.55]);
  return points;
}

/** SVG path for the static fallback illustration (y axis flipped). */
export function anvilOutlinePath(): string {
  return `${anvilOutline()
    .map(
      ([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(3)} ${(-y).toFixed(3)}`,
    )
    .join(" ")} Z`;
}

function anvilHalfDepth(x: number, y: number): number {
  let depth = 0.5;
  if (y <= -0.86) {
    depth = 0.62;
  } else if (y <= -0.3) {
    depth = mix(0.62, 0.36, (y + 0.86) / 0.56);
  } else if (y <= 0.4) {
    depth = mix(0.36, 0.5, (y + 0.3) / 0.7);
  }
  return x > 1 ? depth * (1 - 0.84 * smoothstep(1, 2.55, x)) : depth;
}

function insidePolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function createPerimeter(polygon: readonly Point[]): (amount: number) => Point {
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    total += Math.hypot(bx - ax, by - ay);
    lengths.push(total);
  }
  return (amount) => {
    const target = amount * total;
    let index = lengths.findIndex((length) => length >= target);
    if (index < 0) {
      index = polygon.length - 1;
    }
    const start = index === 0 ? 0 : lengths[index - 1];
    const span = lengths[index] - start;
    const local = span > 0 ? (target - start) / span : 0;
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    return [mix(ax, bx, local), mix(ay, by, local)];
  };
}

/** Splits a total into whole shares; the final share absorbs rounding. */
export function shares(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((accumulator, weight) => accumulator + weight, 0);
  const result: number[] = [];
  let assigned = 0;
  weights.forEach((weight, index) => {
    const share =
      index === weights.length - 1
        ? total - assigned
        : Math.floor((total * weight) / sum);
    result.push(share);
    assigned += share;
  });
  return result;
}

function emitBox(
  emit: Emit,
  random: Random,
  total: number,
  center: Triple,
  half: Triple,
  heat: (u: number, v: number, w: number) => number,
  edgeShare: number,
) {
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = half;
  const areaX = hy * hz;
  const areaY = hx * hz;
  const areaSum = areaX + areaY + hx * hy;
  const lengthSum = hx + hy + hz;
  const sign = () => (random() < 0.5 ? -1 : 1);
  for (let index = 0; index < total; index += 1) {
    let x = (random() * 2 - 1) * hx;
    let y = (random() * 2 - 1) * hy;
    let z = (random() * 2 - 1) * hz;
    if (random() < edgeShare) {
      const pick = random() * lengthSum;
      if (pick < hx) {
        y = sign() * hy;
        z = sign() * hz;
      } else if (pick < hx + hy) {
        x = sign() * hx;
        z = sign() * hz;
      } else {
        x = sign() * hx;
        y = sign() * hy;
      }
    } else {
      const pick = random() * areaSum;
      if (pick < areaX) {
        x = sign() * hx;
      } else if (pick < areaX + areaY) {
        y = sign() * hy;
      } else {
        z = sign() * hz;
      }
    }
    emit(cx + x, cy + y, cz + z, heat(x / hx, y / hy, z / hz));
  }
}

type Profile = {
  outline: readonly Point[];
  halfDepth: (x: number, y: number) => number;
  heat: (x: number, y: number) => number;
};

/** Fills a side profile extruded along z: both faces, the rim, its edges, the inside. */
function emitProfile(
  emit: Emit,
  random: Random,
  { outline, halfDepth, heat }: Profile,
  [faces, walls, edges, interior]: readonly number[],
) {
  const perimeter = createPerimeter(outline);
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sampleInside = (): Point => {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const x = mix(minX, maxX, random());
      const y = mix(minY, maxY, random());
      if (insidePolygon(x, y, outline)) {
        return [x, y];
      }
    }
    return outline[0];
  };
  const side = () => (random() < 0.5 ? -1 : 1);

  for (let index = 0; index < faces; index += 1) {
    const [x, y] = sampleInside();
    emit(x, y, side() * halfDepth(x, y), heat(x, y));
  }
  for (let index = 0; index < walls; index += 1) {
    const [x, y] = perimeter(random());
    emit(x, y, (random() * 2 - 1) * halfDepth(x, y), heat(x, y));
  }
  for (let index = 0; index < edges; index += 1) {
    const [x, y] = perimeter(random());
    emit(
      x + (random() - 0.5) * 0.012,
      y + (random() - 0.5) * 0.012,
      side() * halfDepth(x, y),
      heat(x, y) + 0.08,
    );
  }
  for (let index = 0; index < interior; index += 1) {
    const [x, y] = sampleInside();
    emit(x, y, (random() * 2 - 1) * halfDepth(x, y), heat(x, y) * 0.8);
  }
}

function fillAnvil(emit: Emit, total: number, random: Random) {
  const [faces, walls, edges, top, ingot, interior] = shares(
    total,
    [0.27, 0.2, 0.25, 0.06, 0.03, 0.19],
  );
  const hotSpot = (x: number) => Math.exp(-((x + 0.35) ** 2) / 0.8);
  const heat = (x: number, y: number) =>
    0.09 +
    random() * 0.1 +
    smoothstep(0.3, 1.15, y) * (0.16 + 0.42 * hotSpot(x)) +
    (random() < 0.012 ? 0.6 : 0);
  emitProfile(
    emit,
    random,
    { outline: anvilOutline(), halfDepth: anvilHalfDepth, heat },
    [faces, walls, edges, interior],
  );
  for (let index = 0; index < top; index += 1) {
    const x = mix(-1.75, 0.95, random());
    emit(x, 1.15, (random() * 2 - 1) * 0.5, 0.4 + 0.42 * hotSpot(x) + random() * 0.12);
  }
  emitBox(
    emit,
    random,
    ingot,
    [-0.35, 1.26, 0],
    [0.72, 0.1, 0.13],
    (u) => 0.98 - 0.3 * Math.abs(u) ** 3 - random() * 0.08,
    0.35,
  );
}

function fillQueue(emit: Emit, total: number, random: Random) {
  const jobs = 7;
  const [cubes, gate, track] = shares(total, [0.74, 0.14, 0.12]);
  shares(cubes, new Array<number>(jobs).fill(1)).forEach((share, job) => {
    emitBox(
      emit,
      random,
      share,
      [-2.55 + job * 0.95, 0, 0],
      [0.31, 0.31, 0.31],
      () =>
        job === 0
          ? 0.5 + random() * 0.2
          : 0.07 + random() * 0.1 + (random() < 0.01 ? 0.5 : 0),
      0.5,
    );
  });
  const bars: [Triple, Triple][] = [
    [
      [-3.7, 0.66, 0],
      [0.05, 0.05, 0.71],
    ],
    [
      [-3.7, -0.66, 0],
      [0.05, 0.05, 0.71],
    ],
    [
      [-3.7, 0, 0.66],
      [0.05, 0.71, 0.05],
    ],
    [
      [-3.7, 0, -0.66],
      [0.05, 0.71, 0.05],
    ],
  ];
  shares(gate, [1, 1, 1, 1]).forEach((share, bar) => {
    emitBox(
      emit,
      random,
      share,
      bars[bar][0],
      bars[bar][1],
      () => 0.1 + random() * 0.08,
      0.3,
    );
  });
  for (let index = 0; index < track; index += 1) {
    emit(
      mix(-4.4, 4.6, random()),
      -0.42,
      (random() < 0.5 ? -0.36 : 0.36) + (random() - 0.5) * 0.02,
      0.05 + random() * 0.08,
    );
  }
}

function fillRunners(emit: Emit, total: number, random: Random) {
  const columns = 4;
  const rows = 3;
  const warm = new Set([0, 1, 5, 6, 10]);
  const [blades, cores] = shares(total, [0.86, 0.14]);
  const bladeShares = shares(blades, new Array<number>(columns * rows).fill(1));
  const coreShares = shares(cores, new Array<number>(warm.size).fill(1));
  let core = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const center: Triple = [(column - 1.5) * 1.22, (1 - row) * 0.56, 0];
      const hot = warm.has(index);
      emitBox(
        emit,
        random,
        bladeShares[index],
        center,
        [0.5, 0.19, 0.36],
        () => (hot ? 0.45 + random() * 0.2 : 0.07 + random() * 0.09),
        0.5,
      );
      if (hot) {
        emitBox(
          emit,
          random,
          coreShares[core],
          center,
          [0.2, 0.08, 0.14],
          () => 0.8 + random() * 0.15,
          0.2,
        );
        core += 1;
      }
    }
  }
}

function fillField(emit: Emit, total: number, random: Random) {
  const columns = Math.max(8, Math.round(Math.sqrt(total * 1.25)));
  const rows = Math.max(2, Math.ceil(total / columns));
  for (let index = 0; index < total; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = mix(-11.5, 11.5, (column + (random() - 0.5) * 0.35) / (columns - 1));
    const z = mix(-17, 5, (row + (random() - 0.5) * 0.35) / (rows - 1));
    const height =
      0.26 * Math.sin(x * 0.7) * Math.cos(z * 0.5) + 0.12 * Math.sin(x * 1.9 + z * 1.3);
    emit(
      x,
      -1.6 + height,
      z,
      0.16 + clamp01(height * 1.6 + 0.3) * 0.34 + (random() < 0.006 ? 0.5 : 0),
    );
  }
}

/** Side profile of a cross-peen hammer stood on its handle: face left, peen right. */
function hammerOutline(): Point[] {
  const points: Point[] = [
    [-1.05, 1.38],
    [-0.87, 1.33],
    [0.38, 1.33],
    [0.98, 1.06],
    [0.98, 0.92],
    [0.38, 0.65],
    [0.11, 0.65],
    [0.15, -1.6],
  ];
  curveTo(points, [0.15, -1.8], [0, -1.8], 5);
  curveTo(points, [-0.15, -1.8], [-0.15, -1.6], 5);
  points.push([-0.11, 0.65], [-0.87, 0.65], [-1.05, 0.6]);
  return points;
}

function fillHammer(emit: Emit, total: number, random: Random) {
  // Rolled as if raised to strike, then centred on its own bounds.
  const cos = Math.cos(0.7);
  const sin = Math.sin(0.7);
  const rolled: Emit = (x, y, z, temperature) =>
    emit(x * cos - y * sin + 0.27, x * sin + y * cos - 0.12, z, temperature);
  const head = (y: number) => y > 0.62;
  emitProfile(
    rolled,
    random,
    {
      outline: hammerOutline(),
      halfDepth: (_x, y) => (head(y) ? 0.36 : 0.085),
      // A glowing head, hottest at the striking face, on a cold handle.
      heat: (x, y) =>
        head(y)
          ? 0.3 +
            random() * 0.14 +
            0.5 * Math.exp(-((x + 1.05) ** 2) / 0.2) +
            (random() < 0.012 ? 0.5 : 0)
          : 0.08 + random() * 0.08,
    },
    shares(total, [0.3, 0.2, 0.32, 0.18]),
  );
}

function buildFormation(
  count: number,
  ambient: Float32Array,
  random: Random,
  fill: (emit: Emit, total: number, random: Random) => void,
): Float32Array {
  const data = new Float32Array(count * 4);
  data.set(ambient);
  const offset = ambient.length / 4;
  const total = count - offset;
  let cursor = 0;
  const emit: Emit = (x, y, z, temperature) => {
    if (cursor >= total) {
      return;
    }
    const base = (offset + cursor) * 4;
    data[base] = x;
    data[base + 1] = y;
    data[base + 2] = z;
    data[base + 3] = clamp01(temperature);
    cursor += 1;
  };
  fill(emit, total, random);
  const filled = cursor;
  while (cursor < total && filled > 0) {
    const source = (offset + (cursor % filled)) * 4;
    emit(data[source], data[source + 1], data[source + 2], data[source + 3]);
  }

  // Shuffle so any prefix is a uniform sample and morphs mix evenly.
  for (let index = total - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const a = (offset + index) * 4;
    const b = (offset + other) * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      const held = data[a + channel];
      data[a + channel] = data[b + channel];
      data[b + channel] = held;
    }
  }
  return data;
}

export function createParticleData(count: number, seed = 20261112): ParticleData {
  const random = createRandom(seed);
  const ambientCount = Math.round(count * 0.032);
  const ambient = new Float32Array(ambientCount * 4);
  for (let index = 0; index < ambientCount; index += 1) {
    ambient[index * 4] = (random() * 2 - 1) * 9.5;
    ambient[index * 4 + 1] = (random() * 2 - 1) * 5;
    ambient[index * 4 + 2] = mix(-10, 7.2, random());
    ambient[index * 4 + 3] = 0.45 + random() * 0.5;
  }
  const fills = [fillAnvil, fillQueue, fillRunners, fillField, fillHammer];
  const formations = fills.map((fill) => buildFormation(count, ambient, random, fill));
  const seeds = new Float32Array(count * 4);
  for (let index = 0; index < seeds.length; index += 1) {
    seeds[index] = random();
  }
  return { count, ambient: ambientCount, formations, seeds };
}
