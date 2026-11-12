import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { loadSystem, validatePreflight } from "./api";
import type { PreflightResponse, SystemInfo } from "./api";
import ForgeScene from "./ForgeScene";
import "./App.css";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected request error occurred.";
}

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M3 3h11v11H3zM18 3h11v11H18zM3 18h11v11H3zM18 18h11v11H18z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  );
}

export default function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [workloadName, setWorkloadName] = useState("synthetic-demo");
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payloadView, setPayloadView] = useState<"request" | "response">("request");
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [motionEnabled, setMotionEnabled] = useState(!reducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) {
        setMotionEnabled(false);
      }
    };
    preference.addEventListener("change", updateMotion);
    return () => preference.removeEventListener("change", updateMotion);
  }, []);

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
    setPayloadView("response");
    try {
      setResult(await validatePreflight(workloadName));
    } catch (error: unknown) {
      setRequestError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function changeWorkloadName(value: string) {
    setWorkloadName(value);
    setResult(null);
    setRequestError(null);
    setPayloadView("request");
  }

  const preview =
    payloadView === "request"
      ? JSON.stringify({ workloadName, simulation: true }, null, 2)
      : result
        ? JSON.stringify(result, null, 2)
        : null;
  const connection = system ? "ready" : statusError ? "unavailable" : "checking";

  return (
    <div className="site-shell">
      <a className="skip-link" href="#workbench">
        Skip to workbench
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Blacksmith home">
          <BrandMark />
          <span>blacksmith</span>
          <span className="brand-edition">BUILD LAB</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#system">
            The system <span>01</span>
          </a>
          <a href="#workbench">
            Workbench <span>02</span>
          </a>
        </nav>
        <div className="environment-tag" data-connection={connection}>
          <span className="signal-dot" />
          LOCAL ENVIRONMENT
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="edition-label">EXPERIMENT 001</span>
              BETTER CI, BY DESIGN
            </p>
            <h1 id="hero-heading">
              Forge the
              <br />
              <span>next build.</span>
            </h1>
            <p className="hero-description">
              A new perspective on how CI comes together.{" "}
              <br className="desktop-break" />
              Explore the system. Test an idea. Start something better.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#workbench">
                Enter the workbench <ArrowIcon />
              </a>
              <a className="text-action" href="#system">
                Explore the system{" "}
                <span className="down-arrow">
                  <ArrowIcon />
                </span>
              </a>
            </div>
            <p className="hero-footnote">
              <span className="crosshair" aria-hidden="true" />
              LOCAL-FIRST. SIMULATION-ONLY.
            </p>
          </div>

          <ForgeScene
            motionEnabled={motionEnabled}
            reducedMotion={reducedMotion}
            onMotionToggle={() => setMotionEnabled((enabled) => !enabled)}
          />

          <div className="hero-bottom" aria-hidden="true">
            <span>PREDICTIVE CACHE-AWARE CI / AN INDEPENDENT PROTOTYPE</span>
            <span>
              SCROLL TO EXPLORE{" "}
              <span className="down-arrow">
                <ArrowIcon />
              </span>
            </span>
          </div>
        </section>

        <section
          id="system"
          className="system-section"
          aria-label="Local stack"
          data-connection={connection}
        >
          <div className="section-meta">
            <span>01 / SYSTEM SIGNAL</span>
            <span>
              <span className="signal-dot" /> API READINESS SNAPSHOT
            </span>
          </div>
          <div className="system-grid">
            <div className="system-stat connection-stat">
              <span className="stat-label">THE CONNECTION</span>
              <p className="stat-value">
                {system
                  ? "All systems ready"
                  : statusError
                    ? "Connection lost"
                    : "Connecting"}
                <span className="signal-dot" />
              </p>
              <p className="stat-detail">
                {system
                  ? "API and PostgreSQL ready"
                  : statusError
                    ? "The local stack needs attention"
                    : "Checking API and database..."}
              </p>
            </div>
            <div className="system-stat">
              <span className="stat-label">SCHEMA VERSION</span>
              <p className="stat-value schema-value">
                {system ? String(system.schemaVersion).padStart(2, "0") : "--"}
                <span className="stat-slash">/</span>
              </p>
              <p className="stat-detail">Flyway-managed PostgreSQL</p>
            </div>
            <div className="system-stat">
              <span className="stat-label">EXECUTION MODE</span>
              <p className="stat-value">
                Simulated <LockIcon />
              </p>
              <p className="stat-detail">Real CI execution is disabled</p>
            </div>
            <div className="system-stat">
              <span className="stat-label">CURRENT RELEASE</span>
              <p className="stat-value">
                Phase <span className="phase-number">01</span>
              </p>
              <p className="stat-detail">A working foundation</p>
            </div>
          </div>
          <div className="snapshot-note">
            <span>
              Readiness is checked when this page loads, not continuously monitored.
            </span>
            <a href="/actuator/health/readiness">
              Inspect readiness <ArrowIcon />
            </a>
          </div>
          {statusError && (
            <p role="alert" className="feedback error-feedback">
              Unable to verify the local stack: {statusError} Reload after restoring the
              API.
            </p>
          )}
        </section>

        <section
          id="workbench"
          className="workbench-section"
          aria-labelledby="workbench-heading"
        >
          <div className="workbench-heading">
            <div>
              <p className="eyebrow">02 / THE WORKBENCH</p>
              <h2 id="workbench-heading">
                A little input.
                <br />
                <span>A solid start.</span>
              </h2>
            </div>
            <p>
              One label. One real round trip.
              <br />
              Validate a synthetic workload through the API.
              <br />
              No jobs submitted, scheduled, or executed.
            </p>
          </div>

          <div className="workbench-grid">
            <div className="workbench-form">
              <div className="form-heading">
                <span className="step-number">01</span>
                <div>
                  <h3>Set the starting point.</h3>
                  <p>Give your synthetic workload a name.</p>
                </div>
                <span className="form-crosshair crosshair" aria-hidden="true" />
              </div>

              <form onSubmit={submit}>
                <label htmlFor="workload-name">Workload name</label>
                <div className="input-shell">
                  <span aria-hidden="true">~/</span>
                  <input
                    id="workload-name"
                    name="workloadName"
                    value={workloadName}
                    onChange={(event) => changeWorkloadName(event.target.value)}
                    required
                    disabled={pending}
                    maxLength={64}
                    pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
                    aria-describedby="name-help"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <small id="name-help">
                  1-64 characters. Start with a letter or digit.
                  <br />
                  Letters, digits, dot, underscore, and hyphen only.
                </small>
                <div className="safety-note">
                  <LockIcon />
                  <div>
                    <p>
                      Simulation mode. <span>Always on.</span>
                    </p>
                    <small>No commands. No execution. No persistence.</small>
                  </div>
                  <span className="locked-label">LOCKED</span>
                </div>
                <button
                  className="primary-action submit-action"
                  type="submit"
                  disabled={pending || !system}
                >
                  {pending ? "Validating..." : "Validate synthetic workload"}
                  {pending ? (
                    <span className="request-spinner" aria-hidden="true" />
                  ) : (
                    <ArrowIcon />
                  )}
                </button>
                {requestError && (
                  <p role="alert" className="feedback error-feedback">
                    Preflight failed: {requestError}
                  </p>
                )}
                {result && (
                  <p role="status" className="feedback success-feedback">
                    Validated {result.workloadName}. Simulation only; no job was
                    persisted or executed.
                  </p>
                )}
              </form>
            </div>

            <div className="console" aria-label="API payload inspector">
              <div className="console-title">
                <span className="console-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>BLACKSMITH / API CONSOLE</span>
                <span className="console-local">LOCAL</span>
              </div>
              <div className="console-endpoint">
                <span className="method-badge">POST</span>
                <code>/api/preflight</code>
                <span className="http-status" data-success={Boolean(result)}>
                  {pending
                    ? "IN FLIGHT"
                    : result
                      ? "200 OK"
                      : requestError
                        ? "FAILED"
                        : "PREFLIGHT"}
                </span>
              </div>
              <div className="payload-controls" role="group" aria-label="Payload view">
                <button
                  type="button"
                  aria-pressed={payloadView === "request"}
                  onClick={() => setPayloadView("request")}
                >
                  Request
                </button>
                <button
                  type="button"
                  aria-pressed={payloadView === "response"}
                  onClick={() => setPayloadView("response")}
                >
                  Response {result && <span className="response-dot" />}
                </button>
                <span>JSON</span>
              </div>
              <div
                className="payload-surface"
                aria-busy={pending && payloadView === "response"}
              >
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
                          <span>{line}</span>
                        </span>
                      ))}
                    </code>
                  </pre>
                ) : (
                  <div className="payload-empty">
                    <span
                      className={pending ? "request-spinner" : "empty-symbol"}
                      aria-hidden="true"
                    >
                      {pending ? null : "{ }"}
                    </span>
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
              <div className="console-footer">
                <span>
                  {payloadView === "request"
                    ? "What you send."
                    : result
                      ? "What the API returned."
                      : "No result yet."}
                </span>
                <span>VALIDATION, NOT EXECUTION</span>
              </div>
            </div>
          </div>
        </section>

        <section className="roadmap-section" aria-labelledby="roadmap-heading">
          <div>
            <p className="eyebrow">THE BIGGER PICTURE</p>
            <h2 id="roadmap-heading">
              A foundation.
              <br />
              <span>Not the finish line.</span>
            </h2>
          </div>
          <ol className="roadmap">
            <li className="current-milestone">
              <span>01</span>
              <h3>Local foundation</h3>
              <span>
                YOU ARE HERE <span className="response-dot" />
              </span>
            </li>
            <li>
              <span>02</span>
              <h3>Core data &amp; contracts</h3>
              <span>NOT BUILT YET</span>
            </li>
            <li>
              <span>03</span>
              <h3>Cache-aware scheduling</h3>
              <span>NOT BUILT YET</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" aria-label="Blacksmith home">
          <BrandMark />
          <span>blacksmith</span>
        </a>
        <p>
          Independent prototype. Not affiliated with Blacksmith.
          <br />
          No real CI execution. No invented benchmark results.
        </p>
        <a className="back-to-top" href="#top">
          BACK TO TOP <ArrowIcon />
        </a>
      </footer>
    </div>
  );
}
