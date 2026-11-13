import { useEffect, useRef } from "react";
import { onFrame } from "../experience/ticker";

const SENTENCE =
  "Builds queue. Runners start *cold.* Warm caches sit on the *wrong* *machine.* A scheduler should know where the *heat* is — and send the work there.";

const WORDS = SENTENCE.split(" ").map((token) =>
  token.startsWith("*")
    ? { text: token.slice(1, -1), accent: true }
    : { text: token, accent: false },
);

type ManifestoProps = {
  interactive: boolean;
  /** The ember formations are being drawn, so their captions may be shown. */
  figures: boolean;
};

export default function Manifesto({ interactive, figures }: ManifestoProps) {
  const text = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = text.current;
    if (!interactive || !node) {
      return;
    }
    const words = Array.from(node.querySelectorAll<HTMLElement>("[data-word]"));
    let lit = -1;
    const stop = onFrame(() => {
      // Words light up as the paragraph travels through the middle of the view.
      const rect = node.getBoundingClientRect();
      const start = window.innerHeight * 0.82;
      const end = window.innerHeight * 0.38;
      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / (start - end + rect.height)),
      );
      const next = Math.round(progress * words.length);
      if (next !== lit) {
        lit = next;
        words.forEach((word, index) => {
          word.dataset.lit = String(index < next);
        });
      }
    });
    return () => {
      stop();
      words.forEach((word) => {
        delete word.dataset.lit;
      });
    };
  }, [interactive]);

  return (
    <section
      id="manifesto"
      className="manifesto"
      data-scene="1"
      aria-labelledby="manifesto-label"
    >
      <p id="manifesto-label" className="eyebrow reveal">
        <span>02</span>
        The problem, plainly
      </p>
      <p ref={text} className="manifesto-text">
        {WORDS.map((word, index) => (
          <span className={word.accent ? "accent" : undefined} data-word key={index}>
            {word.text}{" "}
          </span>
        ))}
      </p>
      <div className="manifesto-note reveal" data-figure={figures}>
        {figures && (
          <span className="eyebrow">Fig. 02 — a cold queue · illustration</span>
        )}
        <p>
          That scheduler does not exist here yet. This is the forge it will be built in,
          one real piece at a time.
        </p>
      </div>
    </section>
  );
}
