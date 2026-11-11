import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { loadSystem, validatePreflight } from "./api";
import type { PreflightResponse, SystemInfo } from "./api";
import "./App.css";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected request error occurred.";
}

export default function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [workloadName, setWorkloadName] = useState("synthetic-demo");
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadSystem(controller.signal)
      .then(setSystem)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatusError(errorMessage(error));
        }
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    setRequestError(null);
    try {
      setResult(await validatePreflight(workloadName));
    } catch (error: unknown) {
      setRequestError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Independent engineering prototype / Phase 1</p>
        <h1>Blacksmith</h1>
        <p className="subtitle">Predictive cache-aware CI scheduler</p>
        <p className="boundary">Simulation only. Real CI execution is disabled.</p>
      </header>

      <section className="panel" aria-labelledby="health-heading">
        <h2 id="health-heading">Local stack</h2>
        <p>Readiness snapshot checked when this page loads.</p>
        {!system && !statusError && <p role="status">Checking API and database...</p>}
        {statusError && (
          <p role="alert">
            Unable to verify the local stack: {statusError} Reload after restoring the
            API.
          </p>
        )}
        {system && (
          <>
            <p className="ready">API and PostgreSQL ready</p>
            <dl className="facts">
              <div>
                <dt>Phase</dt>
                <dd>{system.phase} / Working skeleton</dd>
              </div>
              <div>
                <dt>Schema version</dt>
                <dd>{system.schemaVersion}</dd>
              </div>
              <div>
                <dt>Execution mode</dt>
                <dd>{system.executionMode}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="preflight-heading">
        <h2 id="preflight-heading">Synthetic workload preflight</h2>
        <p>
          Validate a label through the real API. This does not submit, schedule,
          persist, or execute a job.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="workload-name">Workload name</label>
          <input
            id="workload-name"
            name="workloadName"
            value={workloadName}
            onChange={(event) => setWorkloadName(event.target.value)}
            required
            maxLength={64}
            pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
            aria-describedby="name-help"
            autoComplete="off"
          />
          <small id="name-help">
            1-64 characters. Start with a letter or digit; use letters, digits, dot,
            underscore, or hyphen.
          </small>
          <button type="submit" disabled={pending || !system}>
            {pending ? "Validating..." : "Validate synthetic workload"}
          </button>
        </form>
        {requestError && <p role="alert">Preflight failed: {requestError}</p>}
        {result && (
          <p role="status" className="result">
            Validated {result.workloadName}. Simulation only; no job was persisted or
            executed.
          </p>
        )}
      </section>

      <footer>
        Scheduling, runners, cache locality, fairness, and benchmarks are not
        implemented. This project is not affiliated with Blacksmith.
      </footer>
    </main>
  );
}
