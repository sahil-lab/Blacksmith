const PHASES = [
  { index: "00", name: "Contract & safety", state: "done" },
  { index: "01", name: "Working skeleton", state: "here" },
  { index: "02", name: "Core data & APIs", state: "todo" },
  { index: "03", name: "Functional engine", state: "todo" },
  { index: "04", name: "Agents & automation", state: "todo" },
  { index: "05", name: "Reliability & observability", state: "todo" },
  { index: "06", name: "Evaluation & benchmarks", state: "todo" },
] as const;

const LABELS = {
  done: "Forged",
  here: "Forged — you are here",
  todo: "Not built",
} as const;

/** What exists and what does not, in the order of the build guide. */
export default function Ledger() {
  return (
    <section className="ledger" data-scene="3" aria-labelledby="ledger-title">
      <header className="ledger-head">
        <p className="eyebrow reveal">
          <span>06</span>
          The ledger — what exists
        </p>
        <h2 id="ledger-title" className="display reveal reveal-mask">
          <span className="mask">
            <span>No smoke.</span>
          </span>
          <span className="mask">
            <span>
              <em>No mirrors.</em>
            </span>
          </span>
        </h2>
        <p className="ledger-lede reveal">
          The readiness, schema version, and preflight answer on this page are real
          responses from the local stack. The figures are illustration and say so. No
          benchmark exists yet, so no performance number is shown.
        </p>
      </header>
      <ol className="ledger-list">
        {PHASES.map((phase) => (
          <li className="ledger-row reveal" data-state={phase.state} key={phase.index}>
            <span className="ledger-index">{phase.index}</span>
            <span className="ledger-name">{phase.name}</span>
            <span className="ledger-state">{LABELS[phase.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
