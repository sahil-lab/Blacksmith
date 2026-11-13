import { useEffect, useRef, useState } from "react";
import { stage } from "../experience/bus";
import { onFrame } from "../experience/ticker";

const MOVES = [
  {
    index: "01",
    label: "Arrivals",
    title: "Feed the fire.",
    body: "Synthetic CI job arrivals with workload metadata: the raw material every later decision is made from.",
  },
  {
    index: "02",
    label: "Runners",
    title: "Keep it warm.",
    body: "A runner inventory with warm and cold states and a lease lifecycle, so work is not left waiting on a cold start.",
  },
  {
    index: "03",
    label: "Cache",
    title: "Send it home.",
    body: "Content-addressed cache metadata and a locality score for every placement: put the job where its cache already lives.",
  },
  {
    index: "04",
    label: "Fairness",
    title: "Share the heat.",
    body: "Priority and tenant fairness, honoured under capacity and SLA constraints.",
  },
  {
    index: "05",
    label: "Failure",
    title: "Break it on purpose.",
    body: "Failure injection, recovery, and a benchmark simulator that reports only what it measures.",
  },
];

const WIDE_QUERY = "(min-width: 960px) and (min-height: 600px)";

type MethodProps = {
  enhanced: boolean;
  reducedMotion: boolean;
  /** The ember formations are being drawn, so their captions may be shown. */
  figures: boolean;
};

/**
 * The planned modules. On large screens the section pins and vertical scroll
 * drives the cards sideways; otherwise it is an ordinary grid.
 */
export default function Method({ enhanced, reducedMotion, figures }: MethodProps) {
  const section = useRef<HTMLElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(
    () => enhanced && window.matchMedia(WIDE_QUERY).matches,
  );
  const pinned = enhanced && wide && !reducedMotion;

  useEffect(() => {
    if (!enhanced) {
      return;
    }
    const query = window.matchMedia(WIDE_QUERY);
    const update = (event: MediaQueryListEvent) => setWide(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [enhanced]);

  useEffect(() => {
    const root = section.current;
    const frame = sticky.current;
    const row = track.current;
    const bar = rail.current;
    if (!pinned || !root || !frame || !row || !bar) {
      return;
    }
    let sized = "";
    let applied = -1;
    const stop = onFrame(() => {
      const travel = Math.max(0, row.scrollWidth - frame.clientWidth);
      const size = `${window.innerHeight + travel}px`;
      if (size !== sized) {
        sized = size;
        root.style.height = size;
      }
      const top = root.getBoundingClientRect().top;
      const progress =
        travel > 0
          ? Math.round(Math.min(1, Math.max(0, -top / travel)) * 2000) / 2000
          : 0;
      if (progress !== applied) {
        applied = progress;
        stage.spin = progress;
        row.style.transform = `translate3d(${(-progress * travel).toFixed(1)}px, 0, 0)`;
        bar.style.transform = `scaleX(${progress})`;
      }
    });
    return () => {
      stop();
      stage.spin = 0;
      root.style.height = "";
      row.style.transform = "";
      bar.style.transform = "";
    };
  }, [pinned]);

  return (
    <section
      ref={section}
      id="method"
      className="method"
      data-scene="2"
      data-pinned={pinned}
      aria-labelledby="method-title"
    >
      <div ref={sticky} className="method-sticky">
        <div ref={track} className="method-track">
          <header className="method-head">
            <p className="eyebrow reveal">
              <span>03</span>
              The method — planned, not built
            </p>
            <h2 id="method-title" className="display reveal reveal-mask">
              <span className="mask">
                <span>Five moves.</span>
              </span>
              <span className="mask">
                <span>
                  <em>None forged yet.</em>
                </span>
              </span>
            </h2>
            <p className="method-lede reveal">
              The five modules the build guide calls for. None of them exists in this
              repository yet.
            </p>
            {figures && (
              <p className="eyebrow">
                Fig. 03 — a runner pool, warm and cold · illustration
              </p>
            )}
          </header>
          <ol className="method-moves">
            {MOVES.map((move) => (
              <li className="move reveal" key={move.index}>
                <span className="move-index" aria-hidden="true">
                  {move.index}
                </span>
                <p className="move-label">{move.label}</p>
                <h3>{move.title}</h3>
                <p className="move-body">{move.body}</p>
                <p className="move-status">Planned · phase 3 · not built</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="method-rail" aria-hidden="true">
          <i ref={rail} />
        </div>
      </div>
    </section>
  );
}
