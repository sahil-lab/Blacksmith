# Ordered implementation and evidence ledger

## Source and initial observations

- Read all **3 of 3 pages** of `02_Blacksmith_CI_Scheduler.pdf`.
- SHA-256:
  `4D17F14DA2D172C173C97E80039E2C20AD00BE27CCCC2513205D1CDA63CEA506`.
- Initial directory contained only the PDF and was not a Git repository.
- Docker client/server **29.4.1**, Linux engine, Compose **5.1.3** verified.
- Reserved ports 18102/18202 were initially free; no Blacksmith containers existed.
- Spring Boot **3.5.16** selected from the requested 3.5 line.

## Phase gates

- Phase 0: required documentation, conventions, ignore rules and CI authored
  before application code. Git writes remain separately approval-gated; see
  [repository state](#repository-state-observed-on-2026-11-13).
- Phase 1: **complete and locally verified**, including persistent test evidence.
  The front end was later rebuilt twice at the user's request; the current one
  is recorded under [Immersive UI rebuild](#immersive-ui-rebuild).
- Phases 2-6: not started and not authorized.

## Validation ledger

Executed from the project directory:

```powershell
.\scripts\Verify.ps1 -Format
.\scripts\Start-Local.ps1
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps e2e
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm audit --omit=dev --json
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm audit --json
```

- PASS: Prettier, Spotless, ESLint, strict TypeScript, Vite production build.
- PASS: 5 frontend tests, 22 Java controller tests, 5 real PostgreSQL integration
  tests. Flyway applied V1; live HTTP readiness and non-persistent preflight were
  exercised inside the integration-test container.
- FIXED: Jackson converted numeric labels to strings despite the scalar-coercion
  flag. Explicit textual coercion rejection now passes integer/float/boolean
  regression tests and a production-configuration integration test.
- RECOVERED FAILURE: Maven `verify` finalized with `Input/output error` after tests.
  C: then reported **0 GiB free** and a file write failed with ENOSPC. The partial
  Compose edit was reverted. This ledger was restored after disk space returned.
- RECOVERY: a later check reported 16,532,844,544 free bytes. This session did not
  delete caches, prune Docker, or alter other projects to recover space.
- PASS AFTER RECOVERY: Maven `verify` finished with BUILD SUCCESS and complete
  Surefire/Failsafe XML reports (22 unit tests and 5 integration tests, no failures,
  errors, or skipped tests).
- FIXED: the subsequent normal-stack startup reported exhausted default Docker
  address pools. Two new runtime networks received verified, non-overlapping
  /28 lab subnets. Existing networks were not deleted or changed.
- PASS: both application Docker images built. `Start-Local.ps1` then completed
  within its 180-second health wait after building: DB, API, web all healthy.
- PASS: Playwright Chromium E2E: **2 passed**, 0 retries, one worker (28.7 seconds
  on the initial successful smoke). Actual UI/API/DB round trip and an explicitly
  intercepted API-unavailable browser scenario passed. Desktop and 390px mobile
  screenshots were inspected; no horizontal overflow or browser page errors.
- PASS: host HTTP checks returned web 200, readiness UP, schema version 1, and
  `{"workloadName":"host-smoke","executionMode":"SIMULATED","persisted":false}`
  through the web proxy.
- PASS: runtime PostgreSQL showed exactly one successful V1 history entry and one
  bootstrap row `(id=1, schema_version=1)`.
- FIXED REPORTING: Playwright reporter paths were relative to its nested config,
  not the repository root. They now target the root CI artifact directories.
  Frontend tests also write a JUnit report.
- PASS AFTER REPORT FIX: frontend formatting, lint, strict type checking, build,
  and 5 tests passed again. Real browser E2E passed again: 2 tests, 19.9 seconds.
  Both root JUnit files were parsed and confirmed to contain zero failures/errors.
- NOT RUN: hosted CI, later phases, cloud deployment, scheduler benchmarks.
- AUDIT: production dependencies: 0 advisories; full development tree:
  10 moderate advisories inherited through ESLint/minimatch. No forced major
  downgrade/override was applied. This is not a complete security audit.

Evidence is retained in `.local/verification.log`,
`.local/verification-fixed.log`, `.local/verification-recovered.log`,
`.local/runtime-smoke.log`, `.local/production-dependency-audit.json`,
`.local/dependency-audit.json`, and `services/api/target/*-reports`.
The earlier disk-full transcript can be incomplete; the recovered run and XML
reports are the authoritative Java success evidence.
Initial bind-mounted restores were extremely slow; project-scoped cache volumes
reduced npm restore to 29-37 seconds. No scheduler benchmark was run.

## Runtime isolation and remaining limitations

Runtime inspection confirmed:

| Service    | User                      | Memory cap | CPU cap | PID cap | Published port  |
| ---------- | ------------------------- | ---------- | ------- | ------- | --------------- |
| API        | 10001:10001               | 512 MiB    | 0.75    | 128     | 127.0.0.1:18202 |
| Web        | 101:101                   | 96 MiB     | 0.25    | 64      | 127.0.0.1:18102 |
| PostgreSQL | Official image entrypoint | 192 MiB    | 0.25    | 64      | None            |

Web/API root filesystems are read-only. The aggregate normal runtime memory cap is
800 MiB. One observed idle snapshot was approximately 197 MiB total; this is not
a capacity benchmark. Temporary test DB exited with code 0; one-shot tools were
removed automatically. Application services remain running for local evaluation.

No current runtime blocker remains. Constraints and follow-up risks:

- Keep free disk space for builds. At this point the abandoned host dependency
  caches were left in place because separate deletion approval was unavailable;
  they were removed later, see
  [housekeeping and disclosures](#housekeeping-and-disclosures).
- Development-only ESLint/minimatch advisory chain: 10 moderate findings;
  production-only npm audit found zero. No forced dependency changes were made.
- Java 21 tests emit Mockito dynamic-agent warnings; tests pass, but a future JDK
  upgrade needs explicit agent configuration.
- Git initialization and hosted CI publication still need approval.
- No authentication, public hosting, real CI execution, scheduling, or benchmark
  result is claimed.

Next step: user review of this Phase 0/1 skeleton. Start Phase 2 domain contracts,
permissions, idempotency, and state transitions only after new authorization.

## Exact validation stages and retained evidence

The full verification run reached successful formatting, builds and Java tests
before failing at the exhausted network pool. After the subnet fix, the startup
and E2E continuation succeeded. The final report-only changes were checked with
the focused frontend/E2E commands below, not by claiming the earlier interrupted
full invocation exited successfully.

```powershell
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm run format
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps api-tool spotless:apply
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool sh -lc 'npm run format:check && npm run lint && npm run build && npm test'
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks up --detach --wait --wait-timeout 90 test-db
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps api-tool verify
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks stop test-db
.\scripts\Start-Local.ps1
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps e2e
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml exec -T db psql -U blacksmith -d blacksmith -c 'SELECT version, success FROM flyway_schema_history; SELECT * FROM bootstrap_state;'
```

The shell operators in `sh -lc` above are evaluated inside the Linux tool
container, not by PowerShell. The scripts also validate Compose project/ports
and reject a published database port.

| Evidence                                                                                                              | Observed result                                |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [Java controller report](../services/api/target/surefire-reports/TEST-dev.blacksmith.api.PreflightControllerTest.xml) | 19 passed                                      |
| [System controller report](../services/api/target/surefire-reports/TEST-dev.blacksmith.api.SystemControllerTest.xml)  | 3 passed                                       |
| [PostgreSQL integration report](../services/api/target/failsafe-reports/TEST-dev.blacksmith.api.SkeletonIT.xml)       | 5 passed                                       |
| [Frontend JUnit](../test-results/web.xml)                                                                             | 5 passed                                       |
| [Browser/API JUnit](../test-results/e2e.xml)                                                                          | 2 passed                                       |
| [Browser HTML report](../playwright-report/index.html)                                                                | Both smoke scenarios passed                    |
| Desktop screenshot `dashboard.png` (removed with the superseded design)                                               | Real ready stack and validated synthetic label |
| Mobile screenshot `dashboard-mobile.png` (removed with the superseded design)                                         | 390px layout, no horizontal overflow           |

The JUnit and HTML report files are overwritten by every run, so the counts in
this table are those of the initial Phase 1 run, not what the linked files hold
now. Current counts are under [Immersive UI rebuild](#immersive-ui-rebuild).

The initial Phase 0/1 verification passed all 34 tests with no skipped tests.
The sections below record the subsequently expanded frontend/browser suites.
Reports and screenshots are generated local evidence, not committed fixtures.
P0-01/P0-02 and P1-01 through P1-08 are satisfied within the explicitly documented
Git/hosted-CI approval boundary. No later-phase acceptance gate is claimed.

## Authored file groups

- Root: README, package.json/package-lock.json, .gitignore, .dockerignore,
  .gitattributes, .editorconfig, .prettierignore, .prettierrc.json.
- docs: PRD.md, ARCHITECTURE.md, THREAT_MODEL.md, PLAN.md, DECISIONS.md,
  CONTRIBUTING.md; .github/workflows/ci.yml.
- apps/web: package.json, README.md, .gitignore, eslint.config.js, index.html,
  tsconfig.json, tsconfig.app.json, tsconfig.node.json, vite.config.ts;
  src/App.tsx, App.css, App.test.tsx, api.ts, index.css, main.tsx, test/setup.ts.
- services/api: pom.xml; src/main/java/dev/blacksmith/api/
  BlacksmithApplication.java, PreflightController.java, SystemController.java,
  ApiExceptionHandler.java, JsonConfiguration.java; src/main/resources/
  application.yaml, db/migration/V1__bootstrap.sql; src/test/java/dev/blacksmith/api/
  PreflightControllerTest.java, SystemControllerTest.java, SkeletonIT.java.
- infra/docker: compose.yaml, api.Dockerfile, web.Dockerfile, nginx.conf.
- scripts: Common.ps1, Initialize-Local.ps1, Start-Local.ps1, Verify.ps1.
- tests/e2e: playwright.config.ts, skeleton.spec.ts, tsconfig.json.
- packages/contracts/openapi.yaml; services/worker/README.md; benchmarks/README.md.

Generated contract types, dependency caches, build output and reports are ignored.
The supplied PDF was not edited. No Git, cloud, or other-session actions were
taken by this work.

## UI refinement

**Superseded.** The user judged this design insufficient, and it was replaced by
the [immersive rebuild](#immersive-ui-rebuild). The record below is kept as
history: `App.css` and `ForgeScene.tsx` no longer exist, and the screenshots of
this design were removed with it.

User-requested visual redesign only; no Phase 2 domain features were introduced.
The result is an original industrial build lab rather than the initial scaffold:

- Ink-black/acid-green identity, oversized Manrope typography, self-hosted Geist
  Mono, custom four-tile wordmark and favicon.
- Original layered isometric SVG illustration with lightweight CSS motion.
  Pause/play works, and system reduced-motion preferences disable animation and
  update the control immediately, including changes while the page is open.
- Real readiness snapshot and schema version; no fabricated runtime metrics.
- Request/response JSON workbench, visible pending/error/success states, and stale
  validation cleared when the workload label changes.
- Responsive layouts, working section links, keyboard skip navigation, and
  explicit labels distinguishing the illustration from live runner activity.

### Verified results

Final focused validation completed successfully:

| Check                                      | Result                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| Prettier and ESLint                        | Passed                                                   |
| Strict application/E2E TypeScript checks   | Passed                                                   |
| Vite production build and web Docker image | Passed                                                   |
| Frontend unit tests                        | 6 passed                                                 |
| Real Chromium browser tests                | 4 passed, 0 retries (18.0 seconds on the final run)      |
| Viewport checks with a 64-character input  | No horizontal overflow at 320, 390, 768, 1440px          |
| Keyboard and motion controls               | Passed, including live reduced-motion preference changes |
| Healthy browser flow console/page errors   | None, including no font/CSP errors                       |
| Local web deployment                       | Healthy; only the Blacksmith web container was replaced  |

The Java sources, API contracts, database, and runtime isolation configuration
were unchanged. The Java unit/integration suites were not rerun for this
presentation-only change; real browser smoke still exercised the API and database.
The UI evidence at the time was the frontend and browser JUnit files, the HTML
report, and desktop and mobile screenshots (`dashboard.png` and
`dashboard-mobile.png`, since removed).

Build validation caught and corrected a test-selector type mismatch and incorrect
font-package import paths. Visual inspection then caught a CSP-blocked inlined
font and a skip-link full-page capture artifact. Fonts now remain same-origin
files through `assetsInlineLimit: 0`; the existing CSP was not weakened. One
initial web health wait expired; direct probes later confirmed readiness and the
final web deployment completed its health wait successfully.

### Exact commands

Run from the Blacksmith project directory. The existing containerized toolchain
was used throughout; no host runtime was installed or replaced.

```powershell
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm install --no-audit --no-fund
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool sh -lc 'npm run format && npm run format:check && npm run lint && npm run build && npm test'
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml build web
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml up --detach --no-deps --wait --wait-timeout 180 web
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps e2e
```

The install followed the two explicit font dependency additions; other dependencies
were not deliberately upgraded. Temporary tool/test containers were removed by
`--rm`, and the application stack remains available locally.

### Files changed in the refinement

- `apps/web/src/App.tsx`, `App.css`, `index.css`, `ForgeScene.tsx`, `App.test.tsx`.
- `apps/web/package.json`, `vite.config.ts`, `index.html`, `public/favicon.svg`,
  `README.md`.
- Root `package-lock.json`, `README.md`, and this phase ledger.
- `tests/e2e/skeleton.spec.ts`.

No UI blocker remains. Next step is visual review of the running build lab.
Domain implementation and Git/cloud actions remain separately approval-gated.
