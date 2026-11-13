import { useEffect, useRef } from "react";
import { onStrike, stage } from "./bus";
import type { ForgeEngine } from "./engine";
import { sceneAt } from "./scenes";
import type { SceneRange } from "./scenes";
import { onFrame } from "./ticker";

export type RenderMode = "pending" | "webgl2" | "fallback";

type ForgeCanvasProps = {
  enabled: boolean;
  heat: number;
  motion: boolean;
  reduced: boolean;
  onMode: (mode: RenderMode, particles: number) => void;
};

function measureScenes(): SceneRange[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).map(
    (node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        scene: Number(node.dataset.scene),
      };
    },
  );
}

/** Fixed full-viewport WebGL layer. Purely decorative; hidden from assistive tech. */
export default function ForgeCanvas({
  enabled,
  heat,
  motion,
  reduced,
  onMode,
}: ForgeCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ heat, motion, reduced });

  useEffect(() => {
    settings.current = { heat, motion, reduced };
  });

  useEffect(() => {
    const element = canvas.current;
    if (!enabled || !element) {
      return;
    }
    let cancelled = false;
    let cleanup = () => {};

    import("./engine")
      .then(({ createForgeEngine }) => {
        if (cancelled) {
          return;
        }
        let engine: ForgeEngine | null = null;
        try {
          engine = createForgeEngine(element, {
            compact:
              window.innerWidth < 760 || window.matchMedia("(pointer: coarse)").matches,
            // Diagnostic opt-in: ?forge=software runs the scene without a GPU.
            allowSoftware:
              new URLSearchParams(window.location.search).get("forge") === "software",
            onContextLost: () => onMode("fallback", 0),
          });
        } catch (error) {
          console.warn("Blacksmith: WebGL scene unavailable, using static art.", error);
        }
        if (!engine) {
          onMode("fallback", 0);
          return;
        }
        const active = engine;
        let reported = active.drawn;
        onMode("webgl2", reported);

        let ranges: SceneRange[] = [];
        let countdown = 0;
        const stopFrames = onFrame((delta) => {
          // Section positions shift as fonts load and pinned sections resize.
          if (countdown <= 0) {
            ranges = measureScenes();
            countdown = 20;
          }
          countdown -= 1;
          const current = settings.current;
          active.setMotion(current.motion, current.reduced);
          active.setHeat(current.heat);
          active.setSpin(stage.spin);
          active.setScene(
            sceneAt(
              ranges,
              window.scrollY + window.innerHeight / 2,
              window.innerHeight,
            ),
          );
          active.frame(delta);
          // Keep the on-page count equal to what is actually drawn.
          if (active.drawn !== reported) {
            reported = active.drawn;
            onMode("webgl2", reported);
          }
        });
        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== "touch") {
            active.setPointer(event.clientX, event.clientY, true);
          }
        };
        const onLeave = () => active.setPointer(0, 0, false);
        const onResize = () => {
          countdown = 0;
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("resize", onResize);
        document.documentElement.addEventListener("pointerleave", onLeave);
        const stopStrikes = onStrike((strike) =>
          active.strike(strike.point, strike.power),
        );
        cleanup = () => {
          stopFrames();
          stopStrikes();
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("resize", onResize);
          document.documentElement.removeEventListener("pointerleave", onLeave);
          active.dispose();
        };
      })
      .catch(() => {
        if (!cancelled) {
          onMode("fallback", 0);
        }
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, onMode]);

  return <canvas ref={canvas} className="forge-canvas" aria-hidden="true" />;
}
