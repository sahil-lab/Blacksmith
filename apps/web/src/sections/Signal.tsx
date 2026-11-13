import type { SystemInfo } from "../api";
import { ArrowIcon } from "../icons";
import type { Connection } from "./Header";

type SignalProps = {
  connection: Connection;
  system: SystemInfo | null;
  error: string | null;
  checkedAt: string | null;
};

const WORD: Record<Connection, string> = {
  ready: "hot.",
  checking: "warming.",
  cold: "cold.",
};

/** Real readiness, read once when the page loads. Nothing here is simulated. */
export default function Signal({ connection, system, error, checkedAt }: SignalProps) {
  return (
    <section
      id="system"
      className="signal"
      data-scene="3"
      data-connection={connection}
      aria-labelledby="signal-title"
    >
      <p className="eyebrow reveal">
        <span>04</span>
        System signal — read once at page load
      </p>
      <h2 id="signal-title" className="signal-title reveal reveal-mask">
        <span className="mask">
          <span>The forge is</span>
        </span>
        <span className="mask">
          <span>
            <em>{WORD[connection]}</em>
          </span>
        </span>
      </h2>

      <div className="signal-row reveal">
        <div>
          <p className="signal-state">
            {system
              ? "API and PostgreSQL ready"
              : error
                ? "The local stack is unreachable"
                : "Checking API and database..."}
          </p>
          <p className="signal-note">
            The glow of this page follows this one reading: warm when the stack answers,
            cold when it does not. It is a snapshot, not continuous monitoring.
          </p>
        </div>
        <a className="text-link" href="/actuator/health/readiness">
          Inspect readiness
          <ArrowIcon />
        </a>
      </div>

      {error && (
        <p role="alert" className="notice notice-cold">
          Unable to verify the local stack: {error} Reload after restoring the API.
        </p>
      )}

      <dl className="signal-facts reveal">
        <div>
          <dt>Schema version</dt>
          <dd>{system ? String(system.schemaVersion).padStart(2, "0") : "--"}</dd>
        </div>
        <div>
          <dt>Execution mode</dt>
          <dd>Simulated</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{system ? String(system.phase).padStart(2, "0") : "--"}</dd>
        </div>
        <div>
          <dt>Read at</dt>
          <dd>{checkedAt ?? "--"}</dd>
        </div>
      </dl>
    </section>
  );
}
