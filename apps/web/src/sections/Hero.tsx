import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { emitStrike, onStrike } from "../experience/bus";
import { anvilOutlinePath } from "../experience/formations";
import { attachMagnet } from "../experience/magnet";
import { onFrame } from "../experience/ticker";
import { ArrowIcon, SparkIcon } from "../icons";

type HeroProps = {
  /** Motion-driven effects may run: enhanced browser, motion on, not reduced. */
  interactive: boolean;
  fallback: boolean;
  particles: number;
};

const ANVIL_PATH = anvilOutlinePath();

function Chars({ text }: { text: string }) {
  return text.split("").map((character, index) => (
    <span className="char" data-char key={index}>
      {character}
    </span>
  ));
}

export default function Hero({ interactive, fallback, particles }: HeroProps) {
  const section = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const primary = useRef<HTMLAnchorElement>(null);
  const [strikes, setStrikes] = useState(0);

  useEffect(() => onStrike(() => setStrikes((count) => count + 1)), []);

  useEffect(() => {
    const root = section.current;
    const heading = title.current;
    if (!interactive || !root || !heading) {
      return;
    }
    const characters = Array.from(heading.querySelectorAll<HTMLElement>("[data-char]"));
    const lines = Array.from(heading.querySelectorAll<HTMLElement>(".line"));
    const levels = characters.map(() => 0);
    const applied = characters.map(() => -1);
    const fits = lines.map(() => 1);
    let pointerX = -9999;
    let pointerY = -9999;
    let impact = 0;
    let exit = -1;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        pointerX = event.clientX;
        pointerY = event.clientY;
      }
    };
    const onLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    const stopStrikes = onStrike(() => {
      impact = 1;
    });
    const stopMagnet = primary.current ? attachMagnet(primary.current) : () => {};

    const stopFrames = onFrame((delta) => {
      impact *= Math.exp(-delta * 4.5);
      const progress = Math.round(
        Math.min(1, window.scrollY / window.innerHeight) * 500,
      );
      if (progress !== exit) {
        exit = progress;
        root.style.setProperty("--exit", String(progress / 500));
      }
      if (progress >= 500) {
        return;
      }
      // Read every glyph box first, then write, to keep layout work to one pass.
      const radius = Math.max(160, window.innerWidth * 0.15);
      const centres = characters.map((character) => {
        const rect = character.getBoundingClientRect();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const;
      });
      let changed = false;
      characters.forEach((character, index) => {
        const distance = Math.hypot(
          pointerX - centres[index][0],
          pointerY - centres[index][1],
        );
        const near = Math.max(0, 1 - distance / radius);
        const goal = Math.min(
          1,
          near * near * 1.1 + impact * (0.55 + 0.45 * Math.sin(index * 1.9 + 0.6)),
        );
        levels[index] += (goal - levels[index]) * Math.min(1, delta * 11);
        const level = Math.round(levels[index] * 200) / 200;
        if (level !== applied[index]) {
          applied[index] = level;
          changed = true;
          // Struck or approached glyphs spread wider, like hammered metal.
          character.style.fontVariationSettings = `"wdth" ${(62 + level * 50).toFixed(1)}, "wght" ${Math.round(800 - level * 220)}`;
          character.style.setProperty("--heat", String(level));
        }
      });
      if (!changed) {
        return;
      }
      // Spreading glyphs must displace their neighbours, not leave the screen.
      const available = heading.clientWidth;
      lines.forEach((line, index) => {
        const inner = line.firstElementChild;
        if (!(inner instanceof HTMLElement) || inner.offsetWidth === 0) {
          return;
        }
        const fit = Math.min(
          1,
          Math.floor((available / inner.offsetWidth) * 1000) / 1000,
        );
        if (fit !== fits[index]) {
          fits[index] = fit;
          line.style.transform = fit < 1 ? `scaleX(${fit})` : "";
        }
      });
    });

    return () => {
      stopFrames();
      stopStrikes();
      stopMagnet();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.style.removeProperty("--exit");
      characters.forEach((character) => {
        character.style.fontVariationSettings = "";
        character.style.removeProperty("--heat");
      });
      lines.forEach((line) => {
        line.style.transform = "";
      });
    };
  }, [interactive]);

  const strikeAt = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.pointerType === "touch") {
      return;
    }
    if (event.target instanceof Element && event.target.closest("a, button")) {
      return;
    }
    emitStrike({ point: { x: event.clientX, y: event.clientY }, power: 1 });
  };

  return (
    <section
      ref={section}
      className="hero"
      data-scene="0"
      data-cursor="strike"
      aria-labelledby="hero-title"
      onPointerDown={strikeAt}
    >
      {fallback && (
        <svg
          className="hero-art"
          viewBox="-2.1 -1.6 5 3.1"
          role="img"
          aria-label="Static illustration of an anvil with a glowing workpiece"
        >
          <defs>
            <linearGradient id="anvil-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffd27a" />
              <stop offset="0.5" stopColor="#ff7a1c" />
              <stop offset="1" stopColor="#5a1c08" />
            </linearGradient>
            <pattern
              id="anvil-dots"
              width="0.09"
              height="0.09"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0.045" cy="0.045" r="0.012" fill="#ff8a1e" opacity="0.5" />
            </pattern>
          </defs>
          <path d={ANVIL_PATH} fill="url(#anvil-dots)" />
          <path
            d={ANVIL_PATH}
            fill="none"
            stroke="url(#anvil-stroke)"
            strokeWidth="0.018"
          />
          <rect
            x="-1.07"
            y="-1.36"
            width="1.44"
            height="0.2"
            rx="0.03"
            fill="#ffe2a8"
          />
        </svg>
      )}

      <p className="eyebrow hero-eyebrow">
        <span>N°001</span>
        Independent prototype — local build lab
      </p>

      <h1
        id="hero-title"
        ref={title}
        className="hero-title"
        aria-label="Forge the next build."
      >
        <span className="line" aria-hidden="true">
          <span className="line-inner">
            <Chars text="FORGE" />
            <em>the</em>
          </span>
        </span>
        <span className="line" aria-hidden="true">
          <span className="line-inner">
            <Chars text="NEXT" />{" "}
            <span className="molten">
              <Chars text="BUILD." />
            </span>
          </span>
        </span>
      </h1>

      <div className="hero-foot">
        <p className="hero-lede">
          A local build lab for a cache-aware CI scheduler. Today it proves one thing
          end to end: a real API, a real database, and one honest round trip. Nothing is
          executed.
        </p>
        <div className="hero-actions">
          <a ref={primary} className="button button-primary" href="#workbench">
            <span>Enter the workbench</span>
            <ArrowIcon />
          </a>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => emitStrike({ point: null, power: 1 })}
          >
            <span>Strike the anvil</span>
            <SparkIcon />
          </button>
        </div>
        <p className="hero-meter" data-strikes={strikes}>
          Strikes
          <b>{String(strikes).padStart(3, "0")}</b>
        </p>
      </div>

      <div className="hero-hud" aria-hidden="true">
        <span>Scroll to explore</span>
        <span>
          {fallback
            ? "Fig. 01 — static illustration"
            : particles > 0
              ? `Fig. 01 — ${particles.toLocaleString("en-US")} embers · illustration, not telemetry`
              : "Fig. 01 — ember field · illustration, not telemetry"}
        </span>
      </div>
    </section>
  );
}
