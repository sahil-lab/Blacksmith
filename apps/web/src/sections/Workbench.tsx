import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import type { PreflightResponse } from "../api";
import { ArrowIcon, LockIcon } from "../icons";

export type PayloadView = "request" | "response";

type WorkbenchProps = {
  ready: boolean;
  workloadName: string;
  pending: boolean;
  result: PreflightResponse | null;
  requestError: string | null;
  payloadView: PayloadView;
  onName: (value: string) => void;
  onView: (view: PayloadView) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const JSON_LINE = /^(\s*)("[^"]+")(: )(.+?)(,?)$/;

function CodeLine({ line }: { line: string }) {
  const match = JSON_LINE.exec(line);
  if (!match) {
    return <span>{line}</span>;
  }
  return (
    <span>
      {match[1]}
      <span className="json-key">{match[2]}</span>
      {match[3]}
      <span className={match[4].startsWith('"') ? "json-string" : "json-literal"}>
        {match[4]}
      </span>
      {match[5]}
    </span>
  );
}

function followSpotlight(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

/** The one functional surface: a real, side-effect-free preflight round trip. */
export default function Workbench({
  ready,
  workloadName,
  pending,
  result,
  requestError,
  payloadView,
  onName,
  onView,
  onSubmit,
}: WorkbenchProps) {
  const preview =
    payloadView === "request"
      ? JSON.stringify({ workloadName, simulation: true }, null, 2)
      : result
        ? JSON.stringify(result, null, 2)
        : null;

  return (
    <section
      id="workbench"
      className="bench"
      data-scene="3"
      aria-labelledby="bench-title"
    >
      <header className="bench-head">
        <p className="eyebrow reveal">
          <span>05</span>
          The workbench — the one real thing
        </p>
        <h2 id="bench-title" className="display reveal reveal-mask">
          <span className="mask">
            <span>One strike.</span>
          </span>
          <span className="mask">
            <span>
              <em>One honest answer.</em>
            </span>
          </span>
        </h2>
        <p className="bench-lede reveal">
          Name a synthetic workload. The API validates it and answers. Nothing is
          queued, scheduled, persisted, or executed.
        </p>
      </header>

      <div className="bench-panel reveal" onPointerMove={followSpotlight}>
        <form className="bench-form" onSubmit={onSubmit}>
          <p className="panel-step">
            <span>01</span>
            Name the work
          </p>
          <label className="field-label" htmlFor="workload-name">
            Workload name
          </label>
          <div className="field">
            <span aria-hidden="true">~/</span>
            <input
              id="workload-name"
              name="workloadName"
              value={workloadName}
              onChange={(event) => onName(event.target.value)}
              required
              disabled={pending}
              maxLength={64}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
              aria-describedby="name-help"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p id="name-help" className="field-help">
            1-64 characters. Start with a letter or digit; then letters, digits, dot,
            underscore, or hyphen.
          </p>
          <div className="lock">
            <LockIcon />
            <p>
              Simulation mode is always on. No commands, no execution, no persistence.
            </p>
            <b>Locked</b>
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || !ready}
          >
            <span>{pending ? "Validating..." : "Validate synthetic workload"}</span>
            {pending ? <i className="spinner" aria-hidden="true" /> : <ArrowIcon />}
          </button>
          {requestError && (
            <p role="alert" className="notice notice-cold">
              Preflight failed: {requestError}
            </p>
          )}
          {result && (
            <p role="status" className="notice notice-hot">
              Validated {result.workloadName}. Simulation only; no job was persisted or
              executed.
            </p>
          )}
        </form>

        <div className="console" role="region" aria-label="API payload inspector">
          <div className="console-bar">
            <span className="method-badge">POST</span>
            <code>/api/preflight</code>
            <span className="http-status" data-success={Boolean(result)}>
              {pending
                ? "In flight"
                : result
                  ? "200 OK"
                  : requestError
                    ? "Failed"
                    : "Not sent"}
            </span>
          </div>
          <div className="payload-tabs" role="group" aria-label="Payload view">
            <button
              type="button"
              aria-pressed={payloadView === "request"}
              onClick={() => onView("request")}
            >
              Request
            </button>
            <button
              type="button"
              aria-pressed={payloadView === "response"}
              onClick={() => onView("response")}
            >
              Response {result && <i className="tab-dot" aria-hidden="true" />}
            </button>
            <span>JSON</span>
          </div>
          <div className="payload" aria-busy={pending && payloadView === "response"}>
            {preview ? (
              <pre
                aria-label={
                  payloadView === "request" ? "Request JSON" : "Response JSON"
                }
              >
                <code>
                  {preview.split("\n").map((line, index) => (
                    <span className="code-line" key={index}>
                      <span className="line-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <CodeLine line={line} />
                    </span>
                  ))}
                </code>
              </pre>
            ) : (
              <div className="payload-empty">
                {pending ? (
                  <i className="spinner" aria-hidden="true" />
                ) : (
                  <span className="glyph" aria-hidden="true">
                    {"{ }"}
                  </span>
                )}
                <p>
                  {pending
                    ? "A small request is on its way."
                    : requestError
                      ? "The API could not validate this request."
                      : "Your response lives here."}
                </p>
                <small>
                  {pending
                    ? "Waiting for the real API response."
                    : requestError
                      ? "Review the error, then try again."
                      : "Run a preflight to see what comes back."}
                </small>
              </div>
            )}
          </div>
          <div className="console-foot">
            <span>
              {payloadView === "request"
                ? "What you send."
                : result
                  ? "What the API returned."
                  : "No result yet."}
            </span>
            <span>Validation, not execution</span>
          </div>
        </div>
      </div>
    </section>
  );
}
