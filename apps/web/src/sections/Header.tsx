import { useEffect, useRef } from "react";
import { onFrame } from "../experience/ticker";
import { BrandMark } from "../icons";

export type Connection = "ready" | "checking" | "cold";

type HeaderProps = {
  connection: Connection;
  enhanced: boolean;
  motion: boolean;
  reducedMotion: boolean;
  sound: boolean;
  onMotion: () => void;
  onSound: () => void;
};

const LINKS = [
  { href: "#manifesto", label: "Manifesto" },
  { href: "#method", label: "Method" },
  { href: "#system", label: "Signal" },
  { href: "#workbench", label: "Workbench" },
];

const STATUS: Record<Connection, string> = {
  ready: "Stack ready",
  checking: "Checking stack",
  cold: "Stack offline",
};

export default function Header({
  connection,
  enhanced,
  motion,
  reducedMotion,
  sound,
  onMotion,
  onSound,
}: HeaderProps) {
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = header.current;
    if (!enhanced || !node) {
      return;
    }
    let applied = -1;
    return onFrame(() => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        range > 0 ? Math.round(Math.min(1, window.scrollY / range) * 1000) / 1000 : 0;
      if (progress !== applied) {
        applied = progress;
        node.style.setProperty("--progress", String(progress));
        node.dataset.scrolled = String(window.scrollY > 40);
      }
    });
  }, [enhanced]);

  const motionLabel = reducedMotion
    ? "System reduced motion enabled"
    : motion
      ? "Pause motion"
      : "Play motion";

  return (
    <header ref={header} className="site-header">
      <a className="brand" href="#top" aria-label="Blacksmith home">
        <BrandMark />
        <span className="brand-word">blacksmith</span>
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        {LINKS.map((link) => (
          <a className="roll" href={link.href} key={link.href}>
            <span className="roll-inner">
              <span>{link.label}</span>
              <span aria-hidden="true">{link.label}</span>
            </span>
          </a>
        ))}
      </nav>
      <p className="stack-status" data-connection={connection}>
        <span className="status-dot" aria-hidden="true" />
        {STATUS[connection]}
      </p>
      <div className="controls" role="group" aria-label="Experience controls">
        <button
          type="button"
          className="control"
          data-on={motion}
          aria-label={motionLabel}
          disabled={reducedMotion}
          onClick={onMotion}
        >
          <i aria-hidden="true" />
          {reducedMotion ? "Reduced motion" : `Motion ${motion ? "on" : "off"}`}
        </button>
        <button
          type="button"
          className="control"
          data-on={sound}
          aria-label={sound ? "Mute sound" : "Enable sound"}
          onClick={onSound}
        >
          <i aria-hidden="true" />
          {`Sound ${sound ? "on" : "off"}`}
        </button>
      </div>
    </header>
  );
}
