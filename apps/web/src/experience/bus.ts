export type Strike = {
  /** Viewport coordinates, or null to strike the anvil face. */
  point: { x: number; y: number } | null;
  power: number;
};

type StrikeListener = (strike: Strike) => void;

const listeners = new Set<StrikeListener>();

export function onStrike(listener: StrikeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStrike(strike: Strike): void {
  for (const listener of listeners) {
    listener(strike);
  }
}

/** Scroll-driven values shared between sections and the renderer. */
export const stage = { spin: 0 };
