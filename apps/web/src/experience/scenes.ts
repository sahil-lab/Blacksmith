export type SceneRange = { top: number; bottom: number; scene: number };

export type SceneBlend = {
  /** Index of the formation being left; the next index is being entered. */
  from: number;
  /** 0 at `from`, 1 at `from + 1`. */
  progress: number;
};

/**
 * Splits a continuous formation index into the pair being blended. Kept in
 * TypeScript so the renderer and the shader can never disagree about the pair.
 */
export function sceneBlend(scene: number, count: number): SceneBlend {
  const clamped = Math.min(Math.max(scene, 0), count - 1);
  const from = Math.min(Math.floor(clamped), count - 2);
  return { from, progress: clamped - from };
}

function smoother(amount: number): number {
  const clamped = Math.min(1, Math.max(0, amount));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * Maps a document position to a continuous formation index. A formation holds
 * while its section fills the view and morphs in the gap to the next section.
 * `position` is the document offset of the middle of the viewport.
 */
export function sceneAt(
  ranges: readonly SceneRange[],
  position: number,
  viewport: number,
): number {
  if (ranges.length === 0) {
    return 0;
  }
  const holds = ranges.map((range) => {
    const pad = Math.min(viewport * 0.35, (range.bottom - range.top) / 2);
    return { start: range.top + pad, end: range.bottom - pad, scene: range.scene };
  });
  // The middle of the view stops half a viewport short of the document's end.
  // A short final section would otherwise never reach its formation, so its
  // hold is pulled forward to just before that last reachable position.
  const last = holds[holds.length - 1];
  const reachable = ranges[ranges.length - 1].bottom - viewport * 0.56;
  if (last.start > reachable) {
    const previousEnd = holds.length > 1 ? holds[holds.length - 2].end : reachable;
    last.start = Math.max(previousEnd, reachable);
  }
  if (position <= holds[0].end) {
    return holds[0].scene;
  }
  for (let index = 0; index < holds.length - 1; index += 1) {
    const current = holds[index];
    const next = holds[index + 1];
    if (position <= next.start) {
      const span = next.start - current.end;
      const amount = span > 0 ? (position - current.end) / span : 1;
      return current.scene + (next.scene - current.scene) * smoother(amount);
    }
    if (position <= next.end) {
      return next.scene;
    }
  }
  return holds[holds.length - 1].scene;
}
