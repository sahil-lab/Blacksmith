/**
 * Chooses the quality tier the ember scene is drawn at.
 *
 * Frame times cannot tell a slow GPU from a busy machine, so no step is taken
 * on trust: a lower tier is kept only if frames really got quicker, and a kept
 * one is tried upward again once the pace has stayed good for a while.
 */
export type QualityGovernor = {
  /** Tier to draw at; 0 is full quality. */
  readonly tier: number;
  /** Takes one frame interval in seconds; true when the tier has changed. */
  sample(deltaSeconds: number): boolean;
  /** Drops the frames gathered so far, for example after a resize. */
  restart(): void;
};

const WINDOW_FRAMES = 45;
const WARMUP_FRAMES = 12;
// A window's pace is the mean of its quickest three quarters, so hitches from
// other work on the machine do not look like a slow device.
const KEPT_SHARE = 0.75;
// Slower than this and about half the frames are missing a 60 Hz display.
const SLOW_SECONDS = 0.022;
const CRAWL_SECONDS = 0.08;
// A hidden tab or a debugger pause, not a frame.
const STALLED_SECONDS = 0.5;
// A lower tier has to be at least this much quicker than the one it replaced.
const QUICKER = 0.88;
const CALM_SECONDS = 20;
const LONGEST_CALM_SECONDS = 320;
const FAILED_RAISE_LIMIT = 4;

export function createQualityGovernor(
  tierCount: number,
  settleSeconds = 3.5,
): QualityGovernor {
  const lowest = tierCount - 1;
  const frames: number[] = [];
  let tier = 0;
  // Start-up work (fonts, the intro wipe) is not sampled at all.
  let settle = settleSeconds;
  let warmup = WARMUP_FRAMES;
  let trial: "none" | "lower" | "raise" = "none";
  // While a lower tier is on trial: where it started and the pace it must beat.
  let origin = 0;
  let paceToBeat = 0;
  let slowWindows = 0;
  // A pace no tier could beat: that is the display or the machine, not the scene.
  let ceiling = 0;
  let calm = 0;
  let calmNeeded = CALM_SECONDS;
  let failedRaises = 0;

  const restart = () => {
    frames.length = 0;
    warmup = WARMUP_FRAMES;
  };
  const moveTo = (next: number) => {
    tier = next;
    restart();
    return true;
  };

  const decide = (pace: number, elapsed: number): boolean => {
    if (pace <= SLOW_SECONDS) {
      ceiling = 0;
    }
    const slow = pace > Math.max(SLOW_SECONDS, ceiling * 1.12);

    if (trial === "lower") {
      if (pace > paceToBeat * QUICKER) {
        // One step can hide behind display refresh timing, so every tier is
        // tried before concluding that the scene is not what is slow.
        if (tier < lowest) {
          return moveTo(tier + 1);
        }
        trial = "none";
        slowWindows = 0;
        ceiling = paceToBeat;
        return moveTo(origin);
      }
      trial = "none";
      slowWindows = 0;
      calm = 0;
    } else if (trial === "raise") {
      trial = "none";
      calm = 0;
      if (slow) {
        failedRaises += 1;
        calmNeeded = Math.min(calmNeeded * 2, LONGEST_CALM_SECONDS);
        return moveTo(tier + 1);
      }
      return false;
    }

    if (slow) {
      calm = 0;
      slowWindows += 1;
      if (slowWindows < 2 || tier === lowest) {
        return false;
      }
      trial = "lower";
      origin = tier;
      paceToBeat = pace;
      return moveTo(Math.min(lowest, tier + (pace > CRAWL_SECONDS ? 2 : 1)));
    }
    slowWindows = 0;
    if (tier === 0 || failedRaises >= FAILED_RAISE_LIMIT) {
      return false;
    }
    calm += elapsed;
    if (calm < calmNeeded) {
      return false;
    }
    trial = "raise";
    return moveTo(tier - 1);
  };

  return {
    get tier() {
      return tier;
    },
    sample(deltaSeconds) {
      if (deltaSeconds <= 0) {
        return false;
      }
      if (deltaSeconds > STALLED_SECONDS) {
        restart();
        return false;
      }
      if (settle > 0) {
        settle -= Math.min(deltaSeconds, 0.25);
        return false;
      }
      if (warmup > 0) {
        warmup -= 1;
        return false;
      }
      frames.push(deltaSeconds);
      if (frames.length < WINDOW_FRAMES) {
        return false;
      }
      const quickest = frames
        .slice()
        .sort((a, b) => a - b)
        .slice(0, Math.ceil(WINDOW_FRAMES * KEPT_SHARE));
      const pace = quickest.reduce((sum, value) => sum + value, 0) / quickest.length;
      const elapsed = frames.reduce((sum, value) => sum + value, 0);
      frames.length = 0;
      return decide(pace, elapsed);
    },
    restart,
  };
}
