import { useEffect, useRef } from "react";
import { onFrame } from "./ticker";

/**
 * A ring that trails the native pointer. The system cursor stays visible, so
 * this is decoration only and is not rendered for touch or reduced motion.
 */
export default function Cursor() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ring.current;
    if (!node) {
      return;
    }
    let goalX = 0;
    let goalY = 0;
    let x = 0;
    let y = 0;
    let seen = false;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      goalX = event.clientX;
      goalY = event.clientY;
      if (!seen) {
        seen = true;
        x = goalX;
        y = goalY;
      }
      node.dataset.visible = "true";
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a, button, input, [data-cursor='link']")) {
        node.dataset.mode = "link";
      } else if (target?.closest("[data-cursor='strike']")) {
        node.dataset.mode = "strike";
      } else {
        node.dataset.mode = "idle";
      }
    };
    const onLeave = () => {
      node.dataset.visible = "false";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    const stop = onFrame((delta) => {
      const ease = 1 - Math.exp(-delta * 14);
      x += (goalX - x) * ease;
      y += (goalY - y) * ease;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ring} className="cursor" aria-hidden="true">
      <span className="cursor-label">Strike</span>
    </div>
  );
}
