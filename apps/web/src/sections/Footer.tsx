import { ArrowIcon, BrandMark } from "../icons";

/** `figures` is true while the ember formations are drawn, so captions apply. */
export default function Footer({ figures }: { figures: boolean }) {
  return (
    <footer className="site-footer" data-scene="4">
      <div className="footer-top">
        <p className="footer-claim reveal">
          Independent prototype. Not affiliated with Blacksmith. No real CI execution.
          No invented benchmark results.
        </p>
        <nav className="footer-nav reveal" aria-label="Footer">
          <a className="text-link" href="/actuator/health/readiness">
            Inspect readiness
            <ArrowIcon />
          </a>
          <a className="text-link" href="#top">
            Back to top
            <ArrowIcon />
          </a>
        </nav>
      </div>
      <p className="wordmark" aria-hidden="true">
        Blacksmith
      </p>
      <div className="footer-base">
        <span className="footer-brand">
          <BrandMark />
          Build lab — experiment N°001
        </span>
        {figures && <span>Fig. 04 — the hammer · illustration</span>}
        <span>Local · synthetic · simulation only</span>
      </div>
    </footer>
  );
}
