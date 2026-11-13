import { describe, expect, it } from "vitest";
import {
  FORMATION_COUNT,
  anvilOutlinePath,
  createParticleData,
  shares,
} from "./formations";
import { createQualityGovernor } from "./quality";
import type { QualityGovernor } from "./quality";
import { sceneAt, sceneBlend } from "./scenes";
import { BACKGROUND_FRAGMENT, PARTICLE_VERTEX } from "./shaders";

describe("ember formations", () => {
  it("fills every formation with finite points and valid temperatures", () => {
    const data = createParticleData(4000);
    expect(data.formations).toHaveLength(FORMATION_COUNT);
    expect(data.seeds).toHaveLength(4000 * 4);
    for (const formation of data.formations) {
      expect(formation).toHaveLength(4000 * 4);
      let empty = 0;
      for (let index = 0; index < formation.length; index += 4) {
        expect(Number.isFinite(formation[index])).toBe(true);
        expect(Number.isFinite(formation[index + 1])).toBe(true);
        expect(Number.isFinite(formation[index + 2])).toBe(true);
        expect(formation[index + 3]).toBeGreaterThanOrEqual(0);
        expect(formation[index + 3]).toBeLessThanOrEqual(1);
        if (
          formation[index] === 0 &&
          formation[index + 1] === 0 &&
          formation[index + 2] === 0
        ) {
          empty += 1;
        }
      }
      // A formation that silently under-fills would leave points at the origin.
      expect(empty).toBeLessThan(4);
    }
  });

  it("is deterministic and keeps ambient embers fixed across formations", () => {
    const first = createParticleData(1200, 7);
    const second = createParticleData(1200, 7);
    expect(Array.from(second.formations[0])).toEqual(Array.from(first.formations[0]));
    expect(createParticleData(1200, 8).formations[0]).not.toEqual(first.formations[0]);

    const ambientFloats = first.ambient * 4;
    expect(first.ambient).toBeGreaterThan(0);
    for (const formation of first.formations) {
      expect(Array.from(formation.subarray(0, ambientFloats))).toEqual(
        Array.from(first.formations[0].subarray(0, ambientFloats)),
      );
    }
  });

  it("splits shares without losing or inventing points", () => {
    expect(shares(10, [1, 1, 1])).toEqual([3, 3, 4]);
    expect(shares(0, [2, 1])).toEqual([0, 0]);
    expect(shares(7, [0.25, 0.75]).reduce((sum, share) => sum + share, 0)).toBe(7);
  });

  it("draws a closed anvil outline for the static fallback", () => {
    const path = anvilOutlinePath();
    expect(path.startsWith("M-1.750 -1.150")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});

describe("scroll to scene mapping", () => {
  const ranges = [
    { top: 0, bottom: 1000, scene: 0 },
    { top: 1000, bottom: 2400, scene: 1 },
    { top: 2400, bottom: 3000, scene: 3 },
    { top: 3000, bottom: 4000, scene: 3 },
  ];

  it("holds a formation while its section fills the view", () => {
    expect(sceneAt(ranges, 0, 800)).toBe(0);
    expect(sceneAt(ranges, 700, 800)).toBe(0);
    expect(sceneAt(ranges, 1700, 800)).toBe(1);
    expect(sceneAt(ranges, 2900, 800)).toBe(3);
    expect(sceneAt(ranges, 3500, 800)).toBe(3);
    expect(sceneAt(ranges, 99999, 800)).toBe(3);
  });

  it("morphs monotonically between neighbouring sections", () => {
    const samples = [760, 900, 1000, 1100, 1240].map((y) => sceneAt(ranges, y, 800));
    expect(samples[0]).toBeGreaterThan(0);
    expect(samples[2]).toBeCloseTo(0.5, 5);
    expect(samples[4]).toBeLessThan(1);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThan(samples[index - 1]);
    }
  });

  it("returns the first formation when no section is tagged", () => {
    expect(sceneAt([], 500, 800)).toBe(0);
  });

  it("still reaches the final formation when the last section is short", () => {
    // A 500px footer on an 800px viewport: the middle of the view stops at 2300.
    const short = [
      { top: 0, bottom: 1000, scene: 0 },
      { top: 1000, bottom: 2200, scene: 3 },
      { top: 2200, bottom: 2700, scene: 4 },
    ];
    expect(sceneAt(short, 2300, 800)).toBe(4);
    const approaching = sceneAt(short, 2100, 800);
    expect(approaching).toBeGreaterThan(3);
    expect(approaching).toBeLessThan(4);
  });
});

describe("formation pair for the shader", () => {
  it("splits a scene value into the pair being blended", () => {
    expect(sceneBlend(0, 5)).toEqual({ from: 0, progress: 0 });
    expect(sceneBlend(1.25, 5)).toEqual({ from: 1, progress: 0.25 });
    expect(sceneBlend(2, 5)).toEqual({ from: 2, progress: 0 });
  });

  it("treats the last formation as the end of the final pair and clamps", () => {
    expect(sceneBlend(4, 5)).toEqual({ from: 3, progress: 1 });
    expect(sceneBlend(9, 5)).toEqual({ from: 3, progress: 1 });
    expect(sceneBlend(-2, 5)).toEqual({ from: 0, progress: 0 });
  });

  it("keeps matrix uniform arrays out of the vertex shader", () => {
    // Direct3D 11 reads the wrong element of a dynamically indexed mat4 uniform
    // array. Software renderers do not reproduce it, so this is the only guard
    // that runs without a GPU; scripts/Capture-Scene.ps1 checks real hardware.
    expect(PARTICLE_VERTEX).not.toMatch(/uniform\s+mat\d\s+\w+\s*\[/);
  });

  it("hashes the smoke lattice with integers, not float products", () => {
    // Measured on an Intel Arc GPU under Direct3D 11: a float-product hash
    // left 133 hard-edge pixels in a 256px sample, an integer hash left none.
    // Software renderers are smooth either way, so only this guard catches it.
    expect(BACKGROUND_FRAGMENT).toContain("uvec2(ivec2(point))");
    expect(BACKGROUND_FRAGMENT).not.toMatch(/fract\(\s*point\s*\*\s*vec2/);
  });
});

describe("quality governor", () => {
  const QUICK = 1 / 60;
  const LATE = 0.034;
  // Twelve warm-up frames, then one 45-frame window per decision.
  const TRIAL = 57;
  const feed = (governor: QualityGovernor, seconds: number, frames: number) => {
    for (let index = 0; index < frames; index += 1) {
      governor.sample(seconds);
    }
  };

  it("does not mistake hitches on a busy machine for a slow device", () => {
    const governor = createQualityGovernor(4, 0);
    for (let index = 0; index < 1200; index += 1) {
      governor.sample(index % 5 === 0 ? 0.12 : QUICK);
    }
    expect(governor.tier).toBe(0);
  });

  it("keeps a lower tier that is quicker, then earns full quality back", () => {
    const governor = createQualityGovernor(4, 0);
    feed(governor, LATE, TRIAL + 45);
    expect(governor.tier).toBe(1);
    feed(governor, QUICK, TRIAL);
    expect(governor.tier).toBe(1);
    // Twenty calm seconds later the tier above is tried, and it holds.
    feed(governor, QUICK, 26 * 45 + TRIAL);
    expect(governor.tier).toBe(0);
  });

  it("waits twice as long after full quality brings the slowness back", () => {
    const governor = createQualityGovernor(4, 0);
    feed(governor, LATE, TRIAL + 45);
    feed(governor, QUICK, TRIAL + 26 * 45);
    expect(governor.tier).toBe(0);
    feed(governor, LATE, TRIAL);
    expect(governor.tier).toBe(1);
    feed(governor, QUICK, TRIAL + 26 * 45);
    expect(governor.tier).toBe(1);
    feed(governor, QUICK, 27 * 45);
    expect(governor.tier).toBe(0);
  });

  it("restores full quality when no tier is any quicker", () => {
    // A display capped at 30 Hz, or a machine busy with something else.
    const governor = createQualityGovernor(4, 0);
    const visited = [governor.tier];
    for (let index = 0; index < 3000; index += 1) {
      if (governor.sample(LATE)) {
        visited.push(governor.tier);
      }
    }
    expect(visited).toEqual([0, 1, 2, 3, 0]);
  });
});
