type FrameListener = (deltaSeconds: number) => void;

const listeners = new Set<FrameListener>();
let handle = 0;
let previous = 0;

function loop(now: number) {
  const delta = previous === 0 ? 0 : (now - previous) / 1000;
  previous = now;
  for (const listener of listeners) {
    listener(delta);
  }
  handle = listeners.size > 0 ? requestAnimationFrame(loop) : 0;
}

/** Subscribes to the single shared animation frame loop. */
export function onFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  if (handle === 0) {
    previous = 0;
    handle = requestAnimationFrame(loop);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && handle !== 0) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
  };
}
