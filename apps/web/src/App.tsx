import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { loadSystem, validatePreflight } from "./api";
import type { PreflightResponse, SystemInfo } from "./api";
import Cursor from "./experience/Cursor";
import ForgeCanvas from "./experience/ForgeCanvas";
import type { RenderMode } from "./experience/ForgeCanvas";
import Preloader from "./experience/Preloader";
import { emitStrike, onStrike } from "./experience/bus";
import { disableSound, enableSound, playStrike } from "./experience/sound";
import Footer from "./sections/Footer";
import Header from "./sections/Header";
import type { Connection } from "./sections/Header";
import Hero from "./sections/Hero";
import Ledger from "./sections/Ledger";
import Manifesto from "./sections/Manifesto";
import Marquee from "./sections/Marquee";
import Method from "./sections/Method";
import Signal from "./sections/Signal";
import Workbench from "./sections/Workbench";
import type { PayloadView } from "./sections/Workbench";

type Phase = "loading" | "revealing" | "ready";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const HEAT: Record<Connection, number> = { ready: 1, checking: 0.42, cold: 0 };

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected request error occurred.";
}

export default function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [workloadName, setWorkloadName] = useState("synthetic-demo");
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payloadView, setPayloadView] = useState<PayloadView>("request");

  // The immersive layer is an enhancement over a fully working plain page.
  const [enhanced] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      typeof window.IntersectionObserver === "function",
  );
  const [finePointer] = useState(
    () => enhanced && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => enhanced && window.matchMedia(REDUCED_QUERY).matches,
  );
  const [motionOn, setMotionOn] = useState(true);
  const [sound, setSound] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [phase, setPhase] = useState<Phase>(() =>
    enhanced && !reducedMotion ? "loading" : "ready",
  );
  const [render, setRender] = useState<{ mode: RenderMode; particles: number }>(() => ({
    mode: enhanced ? "pending" : "fallback",
    particles: 0,
  }));

  const motion = motionOn && !reducedMotion;
  const interactive = enhanced && motion;
  // Formation captions are only true while the ember scene is actually drawn.
  const figures = render.mode === "webgl2";
  const connection: Connection = system ? "ready" : statusError ? "cold" : "checking";

  useEffect(() => {
    const controller = new AbortController();
    loadSystem(controller.signal)
      .then((info) => {
        setSystem(info);
        setCheckedAt(new Date().toLocaleTimeString("en-GB"));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatusError(errorMessage(error));
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!enhanced) {
      return;
    }
    const preference = window.matchMedia(REDUCED_QUERY);
    const update = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [enhanced]);

  useEffect(() => {
    if (!enhanced) {
      return;
    }
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        setFontsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enhanced]);

  useEffect(() => {
    if (phase !== "revealing") {
      return;
    }
    const timer = window.setTimeout(() => setPhase("ready"), 1150);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!enhanced) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            entry.target.dataset.inview = "true";
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    document
      .querySelectorAll<HTMLElement>(".reveal")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [enhanced]);

  useEffect(() => {
    if (!sound) {
      return;
    }
    return onStrike((strike) => playStrike(strike.power));
  }, [sound]);

  const handleMode = useCallback((mode: RenderMode, particles: number) => {
    setRender({ mode, particles });
  }, []);
  const finishLoading = useCallback(() => setPhase("revealing"), []);

  async function toggleSound() {
    if (sound) {
      disableSound();
      setSound(false);
    } else if (await enableSound()) {
      setSound(true);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = event.currentTarget.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    setPending(true);
    setResult(null);
    setRequestError(null);
    setPayloadView("response");
    try {
      setResult(await validatePreflight(workloadName));
      // A real answer earns a real strike, at the button that asked for it.
      const rect = button?.getBoundingClientRect();
      emitStrike({
        point: rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : null,
        power: 0.8,
      });
    } catch (error: unknown) {
      setRequestError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function changeWorkloadName(value: string) {
    setWorkloadName(value);
    setResult(null);
    setRequestError(null);
    setPayloadView("request");
  }

  return (
    <div
      className="app"
      data-enhanced={enhanced}
      data-phase={phase}
      data-motion={motion ? "on" : "off"}
      data-heat={connection}
      data-gl={render.mode}
    >
      <a className="skip-link" href="#workbench">
        Skip to workbench
      </a>

      <ForgeCanvas
        enabled={enhanced}
        heat={HEAT[connection]}
        motion={motion}
        reduced={reducedMotion}
        onMode={handleMode}
      />
      {render.mode === "fallback" && (
        <div className="forge-fallback" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="grain" aria-hidden="true" />

      {phase !== "ready" && (
        <Preloader
          ready={fontsReady && render.mode !== "pending"}
          leaving={phase === "revealing"}
          onDone={finishLoading}
        />
      )}

      <Header
        connection={connection}
        enhanced={enhanced}
        motion={motion}
        reducedMotion={reducedMotion}
        sound={sound}
        onMotion={() => setMotionOn((enabled) => !enabled)}
        onSound={() => void toggleSound()}
      />

      <main id="top">
        <Hero
          interactive={interactive}
          fallback={render.mode === "fallback"}
          particles={render.particles}
        />
        <Marquee interactive={interactive} />
        <Manifesto interactive={interactive} figures={figures} />
        <Method enhanced={enhanced} reducedMotion={reducedMotion} figures={figures} />
        <Signal
          connection={connection}
          system={system}
          error={statusError}
          checkedAt={checkedAt}
        />
        <Workbench
          ready={system !== null}
          workloadName={workloadName}
          pending={pending}
          result={result}
          requestError={requestError}
          payloadView={payloadView}
          onName={changeWorkloadName}
          onView={setPayloadView}
          onSubmit={submit}
        />
        <Ledger />
      </main>

      <Footer figures={figures} />
      {finePointer && interactive && <Cursor />}
    </div>
  );
}
