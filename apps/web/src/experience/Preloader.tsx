import { useEffect, useRef } from "react";
import { onFrame } from "./ticker";

type PreloaderProps = {
  /** Fonts are loaded and the renderer has either started or fallen back. */
  ready: boolean;
  leaving: boolean;
  onDone: () => void;
};

const MINIMUM_SECONDS = 0.9;
const MAXIMUM_SECONDS = 4;

export default function Preloader({ ready, leaving, onDone }: PreloaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const readiness = useRef(ready);

  useEffect(() => {
    readiness.current = ready;
  });

  useEffect(() => {
    let elapsed = 0;
    let shown = 0;
    let displayed = -1;
    let finished = false;
    return onFrame((delta) => {
      if (finished) {
        return;
      }
      elapsed += delta;
      const complete =
        (readiness.current && elapsed > MINIMUM_SECONDS) || elapsed > MAXIMUM_SECONDS;
      const goal = complete ? 1 : Math.min(0.86, 1 - Math.exp(-elapsed * 1.9));
      shown += (goal - shown) * Math.min(1, delta * (complete ? 7 : 5));
      if (complete && shown > 0.995) {
        shown = 1;
      }
      const value = Math.round(shown * 100);
      if (value !== displayed) {
        displayed = value;
        if (counter.current) {
          counter.current.textContent = String(value).padStart(3, "0");
        }
        root.current?.style.setProperty("--progress", shown.toFixed(3));
        root.current?.setAttribute("aria-valuenow", String(value));
      }
      if (shown === 1) {
        finished = true;
        onDone();
      }
    });
  }, [onDone]);

  return (
    <div
      ref={root}
      className="preloader"
      data-leaving={leaving}
      role="progressbar"
      aria-label="Loading Blacksmith"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div className="preloader-row">
        <span>Blacksmith</span>
        <span>Build lab — N°001</span>
      </div>
      <p className="preloader-count" aria-hidden="true">
        <span ref={counter}>000</span>
      </p>
      <div className="preloader-row">
        <span>Heating the forge</span>
        <i className="preloader-bar" />
        <span>Simulation only</span>
      </div>
    </div>
  );
}
