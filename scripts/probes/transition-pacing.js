// Frame pacing while the embers fly between formations. Nothing here reads the
// GPU back, so the page is timed exactly as a visitor's browser runs it.
//
//   .\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -Probe .\scripts\probes\transition-pacing.js
//
// A frame counts as late when it arrives more than 25 ms after the previous
// one, which on a 60 Hz display means at least one refresh was missed.
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const canvas = document.querySelector("canvas.forge-canvas");
  const round = (value) => Math.round(value * 10) / 10;
  const embers = () => {
    const caption = document.querySelector(".hero-hud span:last-child").textContent;
    const found = caption.match(/([\d,]+) embers/);
    return found ? `${found[1]} embers` : caption;
  };
  const top = (selector) =>
    selector === "top"
      ? 0
      : document.querySelector(selector).getBoundingClientRect().top + window.scrollY;
  const run = (count) =>
    new Promise((resolve) => {
      const intervals = [];
      let last = 0;
      const tick = (now) => {
        if (last) {
          intervals.push(now - last);
        }
        last = now;
        if (intervals.length < count) {
          requestAnimationFrame(tick);
          return;
        }
        const sorted = [...intervals].sort((a, b) => a - b);
        const pick = (share) =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
        resolve(
          `late ${intervals.filter((value) => value > 25).length}/${count}` +
            ` | median ${round(pick(0.5))} p90 ${round(pick(0.9))}` +
            ` max ${round(sorted[sorted.length - 1])} ms` +
            ` | ${canvas.width}x${canvas.height}, ${embers()}`,
        );
      };
      requestAnimationFrame(tick);
    });

  const hops = [
    ["hero > manifesto", "#manifesto"],
    ["manifesto > method", "#method"],
    ["method > signal", "#system"],
    ["signal > footer", ".site-footer"],
    ["footer > signal", "#system"],
    ["signal > method", "#method"],
    ["method > manifesto", "#manifesto"],
    ["manifesto > hero", "top"],
  ];
  const out = { atRest: await run(180) };
  for (const [name, selector] of hops) {
    // An instant jump is the worst case: every ember flies the whole way at once.
    window.scrollTo({ top: top(selector), behavior: "instant" });
    out[name] = await run(110);
    await sleep(1200);
  }
  out.atRestAfter = await run(180);
  return JSON.stringify(out, null, 1);
})();
