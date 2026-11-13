import { useEffect, useRef } from "react";
import { onFrame } from "../experience/ticker";
import { SparkIcon } from "../icons";

const ITEMS = ["Warm capacity", "Cache locality", "Fair queues", "Failure, on purpose"];

/** Decorative ticker of the planned themes. Hidden from assistive technology. */
export default function Marquee({ interactive }: { interactive: boolean }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = track.current;
    if (!interactive || !node) {
      return;
    }
    let offset = 0;
    let velocity = 0;
    let previousScroll = window.scrollY;
    const stop = onFrame((delta) => {
      const scroll = window.scrollY;
      const instant = delta > 0 ? (scroll - previousScroll) / delta : 0;
      previousScroll = scroll;
      velocity += (instant - velocity) * Math.min(1, delta * 6);
      const loop = node.scrollWidth / 2;
      if (loop <= 0) {
        return;
      }
      // Scrolling speeds the ticker up, and scrolling back reverses it.
      const direction = velocity < -30 ? -1 : 1;
      offset = (offset + direction * (70 + Math.abs(velocity) * 0.3) * delta) % loop;
      if (offset < 0) {
        offset += loop;
      }
      const skew = Math.max(-7, Math.min(7, velocity * 0.005));
      node.style.transform = `translate3d(${(-offset).toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    });
    return () => {
      stop();
      node.style.transform = "";
    };
  }, [interactive]);

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" ref={track}>
        {[0, 1].map((copy) => (
          <div className="marquee-group" key={copy}>
            {ITEMS.map((item, index) => (
              <span className={index % 2 === 1 ? "outline" : undefined} key={item}>
                {item}
                <SparkIcon />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
