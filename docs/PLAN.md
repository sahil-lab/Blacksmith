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

## Immersive UI rebuild

The user judged the refinement above insufficient and asked for an
Awwwards-calibre experience. The front end was rebuilt from scratch. This is
presentation work only: the API, its contract, the schema, and the Compose stack
are unchanged, and no Phase 2 feature was added. Whether the result meets the
user's bar is theirs to judge; this section records what exists and what was
measured.

### What was built

- One scrolling page: intro counter, hero, marquee, manifesto, a pinned method
  section that scrolls sideways, system signal, workbench, phase ledger, footer.
- A WebGL2 scene written by hand, with no 3D library: 56,000 embers (26,000 on
  narrow or touch screens) that reform into an anvil, a cold job queue, a runner
  pool, a glowing field, and a hammer as the page scrolls, with bloom, tone
  mapping, film grain, sparks, pointer repulsion, and a shock wave on a strike.
- Kinetic type: the width axis of Archivo spreads the title glyphs near the
  pointer and on a strike. Instrument Serif italics and Geist Mono labels. All
  fonts are self-hosted files.
- The one real readiness reading drives the look: warm when the stack answers,
  cold blue when it does not.
- A static illustration with CSS embers when the scene cannot run, cross-fades
  with no theatre under reduced motion, and an optional synthesised strike sound.
- The rules that keep decoration from posing as data are listed in the
  [front-end notes](../apps/web/README.md).

### Faults found only on real hardware

The test container has no GPU, so its browser draws the static fallback, or a
small software render when asked. `scripts/Capture-Scene.ps1` was written to
drive the installed Edge headless on this machine's GPU (Intel Arc Pro, through
Direct3D 11). It found faults that every software renderer had hidden.

| Fault                                                                                                                | Evidence                                                                                                                                                                                                                                               | Fix                                                                                                                       | Guard                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Every formation was drawn with its neighbour's placement                                                             | Dynamic indexing into a `mat4` uniform array returned the wrong element. Reproduced on the Intel GPU and on Direct3D's own software device, which points at the shared Direct3D shader path and not the Intel driver. SwiftShader did not reproduce it | The application picks the two matrices and passes them as separate uniforms                                               | Unit test, software-render browser test, capture script |
| Smoke showed hard-edged cells                                                                                        | A float-product lattice hash left 133 hard-edge pixels in a 256-pixel sample; an integer hash left none                                                                                                                                                | Integer hash                                                                                                              | Unit test                                               |
| Quality fell to the lowest tier and stayed there                                                                     | At 1280 x 650 CSS pixels and 1.5x, a capture began at 56,000 embers on a 1898 x 975 canvas and ended at 16,800 embers on 797 x 410, although at rest full quality held the display rate with about 8 ms of GPU time per frame                          | A governor that keeps a lower tier only if frames got quicker and tries the tier above again later                        | Four unit tests                                         |
| Flights between formations were slow                                                                                 | With the governor alone the same capture still ended one tier down (40,320 embers). An interleaved per-pass measurement found that skipping the full-resolution smoke pass saved 13.3 of 30.2 ms at the hero and 4.2 of 13.7 ms at the field           | Smoke drawn at a quarter of the resolution on its own target; afterwards the pass cost 0.7 of 10.3 ms and 0.3 of 9.4 ms   | Capture script reports the ember count at start and end |
| The closing formation, four tiles, read as another company's logo when drawn large, and so did the mark it came from | Seen in the first captures of the footer                                                                                                                                                                                                               | A hammer closes the page; the brand mark and favicon are the anvil outline the scene and the static illustration also use | Visual review of the captures                           |
| The last line of the opening screen fell below the fold on a short laptop viewport                                   | Seen in the 1280 x 650 capture                                                                                                                                                                                                                         | The title size is also bounded by viewport height                                                                         | Browser test at 1280 x 650                              |

Two cautions about the per-pass figures. The first set was taken on a busy
machine while the quality tier was still changing, so at the hero only 192 of
1,056 samples could be used. And the figures before and after the fix come from
separate runs under different load, so they compare the smoke's share of a
frame within each run, not absolute times across runs.

### Frame pacing on the final build

Measured with [the pacing probe](../scripts/probes/transition-pacing.js) in
headless Edge on the Intel GPU, at 1280 x 650 CSS pixels and 1.5x, which is
about what a maximised browser window gets on a 1920 x 1200 panel at 150 %
scaling. Each jump is instant, the worst case, because every ember flies the
whole way at once. A frame is late when it arrives more than 25 ms after the
previous one.

| Moment              | Late frames | Median  | 90th percentile | Longest |
| ------------------- | ----------- | ------- | --------------- | ------- |
| At rest, before     | 0 of 180    | 16.7 ms | 16.8 ms         | 19.0 ms |
| Hero to manifesto   | 1 of 110    | 16.7 ms | 16.8 ms         | 50.0 ms |
| Manifesto to method | 0 of 110    | 16.7 ms | 16.8 ms         | 19.8 ms |
| Method to signal    | 0 of 110    | 16.7 ms | 16.7 ms         | 16.8 ms |
| Signal to footer    | 0 of 110    | 16.7 ms | 16.9 ms         | 17.6 ms |
| Footer to signal    | 2 of 110    | 16.7 ms | 17.2 ms         | 33.4 ms |
| Signal to method    | 0 of 110    | 16.7 ms | 16.8 ms         | 17.5 ms |
| Method to manifesto | 1 of 110    | 16.7 ms | 16.8 ms         | 33.3 ms |
| Manifesto to hero   | 1 of 110    | 16.7 ms | 16.8 ms         | 33.3 ms |
| At rest, afterwards | 0 of 180    | 16.7 ms | 16.8 ms         | 17.7 ms |

The scene stayed at 56,000 embers on a 1898 x 975 canvas throughout. Headroom is
thin, though: a separate run that read the GPU back each frame measured 12 to
14.5 ms of GPU time at the median during flights and 16 to 26 ms at the 90th
percentile. A busier machine or a larger window can therefore still step the
quality down, which is what the governor is for.

### Verification of the final build

Run from the project directory on 2026-11-13:

```powershell
.\scripts\Verify.ps1
.\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -DesktopOnly -OutputDirectory .\.local\evidence\display
.\scripts\Capture-Scene.ps1
.\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -Probe .\scripts\probes\transition-pacing.js
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm audit --omit=dev --json
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool npm audit --json
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml --profile checks run --rm --no-deps node-tool sh -lc 'npm run format && npm run format:check && npm run lint && npm run build && npm test'
```

| Check                                                 | Result                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Verify.ps1`, the whole workflow                      | Exit code 0 after 16.4 minutes                                                                                     |
| Prettier, ESLint, strict TypeScript, production build | Passed                                                                                                             |
| Frontend unit tests                                   | 24 passed                                                                                                          |
| Java unit tests                                       | 22 passed (19 preflight, 3 system)                                                                                 |
| PostgreSQL integration tests                          | 5 passed; Maven `BUILD SUCCESS` in 6 minutes 51 seconds                                                            |
| API and web images, stack start                       | Built; `db`, `api`, `web` healthy                                                                                  |
| Browser tests in the container, no GPU                | 10 passed, 0 retries, 4.2 minutes: 9 in Chromium and 1 with WebGL disabled                                         |
| Capture at 1280 x 650, 1.5x                           | 60.3 frames a second at the hero, 60.5 at the footer, 56,000 embers at both, placement passed, no console messages |
| Capture at 1440 x 900, 1x                             | 60.6 and 59.7 frames a second, 56,000 embers, placement passed, no console messages                                |
| Same, system endpoint blocked                         | Cold look, 60.6 frames a second                                                                                    |
| Same, phone-sized viewport (390 x 844, 2x)            | 26,000 embers, 60.6 and 60.7 frames a second                                                                       |
| Production dependency audit                           | 0 advisories                                                                                                       |
| Full dependency audit                                 | 10 moderate, all in the development-only ESLint and minimatch chain, as before                                     |

The documentation was finished while `Verify.ps1` was running and after it, so
its format step did not see those edits. In that time only documentation, the
probe file, and the capture script's help text and placement threshold changed.
The captures above were taken after those edits, and the last command in the
list was then run on the finished tree and passed, with 24 unit tests. The
placement check requires the anvil to sit right of 0.58 of the canvas width and
the hammer right of 0.62; they measured 0.69 and 0.71.

| Evidence                                                                                                        | Content                                                    |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `.local/verification-rebuild.log`                                                                               | Transcript of the `Verify.ps1` run                         |
| [Frontend JUnit](../test-results/web.xml), [browser JUnit](../test-results/e2e.xml)                             | 24 and 10 tests, no failures, errors, or skips             |
| [Java reports](../services/api/target/surefire-reports), [integration](../services/api/target/failsafe-reports) | 19, 3, and 5 tests, written by this run                    |
| `.local/evidence/gpu-*.png`, `gpu-capture.json`                                                                 | 18 real-GPU captures at 1440 x 900, cold, and phone-sized  |
| `.local/evidence/display/`                                                                                      | 10 real-GPU captures at 1280 x 650 and 1.5x                |
| `.local/evidence/fallback-*.png`, `no-webgl-workbench.png`                                                      | Container screenshots; these show the static fallback only |
| `.local/production-dependency-audit-rebuild.json`, `.local/dependency-audit-rebuild.json`                       | Audit output                                               |

### What these results do not show

- The page was not observed in the user's own visible browser window. The
  real-GPU evidence is headless Edge on this one laptop.
- One GPU and one browser engine were measured. Firefox, Safari, other GPUs, and
  a browser in full-screen mode were not.
- The phone-sized run is a viewport emulated on the laptop's GPU. It shows the
  layout, and nothing about how a phone performs.
- The capture script is outside `Verify.ps1` and CI, so a regression in the
  scene itself is caught only when someone runs it.
- Hosted CI was not consulted.

### Files changed in the rebuild

Relative to the refinement recorded above:

- New: `apps/web/src/experience/` (13 files), `apps/web/src/sections/` (9),
  `apps/web/src/styles/` (3), `apps/web/src/icons.tsx`,
  `apps/web/public/grain.svg`, `scripts/Capture-Scene.ps1`,
  `scripts/probes/transition-pacing.js`, `tests/e2e/fallback.spec.ts`.
- Rewritten or edited: `apps/web/src/App.tsx`, `App.test.tsx`, `api.ts`,
  `index.css`, `apps/web/index.html`, `apps/web/public/favicon.svg`,
  `apps/web/package.json`, `apps/web/README.md`, root `package-lock.json` and
  `README.md`, `tests/e2e/skeleton.spec.ts`, `tests/e2e/playwright.config.ts`,
  and `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `DECISIONS.md`, `PRD.md`,
  `THREAT_MODEL.md`, and this ledger.
- Deleted: `apps/web/src/App.css`, `apps/web/src/ForgeScene.tsx`. The dependency
  `@fontsource-variable/manrope` was replaced by `@fontsource-variable/archivo`
  and `@fontsource/instrument-serif`.
- Unchanged: `services/api`, `packages/contracts`, `infra/docker`, the CI
  workflow, and the start and verify scripts.

Next step: the user's review in their own browser at <http://127.0.0.1:18102>.
Phase 2 starts only after new authorization.

## Repository state observed on 2026-11-13

When Phases 0 and 1 were built, this directory was not a Git repository, and the
work recorded in this ledger was never approved to make it one. A read-only
inspection on 2026-11-13 found that it now is:

- Branch `main`, with remote `origin` at
  `https://github.com/sahil-lab/Blacksmith.git`. The oldest files in `.git`
  date from 2026-11-11 at 23:46 local time.
- Three commits, each authored and committed as `sahil-lab` and pushed within
  seconds, according to the local reference logs:

| Commit    | Local time (+05:30) | Subject                              |
| --------- | ------------------- | ------------------------------------ |
| `6c59144` | 2026-11-12 00:21    | Initial project import               |
| `a858801` | 2026-11-12 07:16    | Improve UI and UX                    |
| `10538b1` | 2026-11-13 15:49    | Update project implementation and UI |

- No Git command that writes was run as part of the work recorded here: no
  init, add, commit, push, or remote or branch change. Its Git use was read-only
  inspection with optional locks disabled. Who or what made the commits was not
  established.
- `10538b1` was taken while the documentation for the rebuild was still being
  written. As committed, `docs/DECISIONS.md` and `docs/THREAT_MODEL.md` fail
  `npm run format:check` (checked on the unmodified tree; exit code 1), and this
  ledger did not yet have the sections that it and the other documents link to.
  The edits that complete the set were made after that commit. A hosted run of
  the workflow on `10538b1` itself should be expected to fail at the format
  step.
- The remote was not contacted. Its visibility and the state of any hosted
  workflow run are unknown here.
- Neither generated database password appears in any file of `10538b1`, and no
  path under `.local/` is tracked.
- The supplied guide, `02_Blacksmith_CI_Scheduler.pdf`, is tracked, so it is on
  the remote along with the source. Whether that is intended is the owner's
  decision.

## Housekeeping and disclosures

- **Deleted on 2026-11-13**, with 1.61 GiB free on C:, all inside this project
  and all ignored by Git: `.local/npm-cache` (454 MB) and `.local/m2` (16 MB),
  left over from the abandoned bind-mounted dependency approach and read by
  nothing; scratch diagnostics in `.local/probe`; the two screenshots of the
  superseded design; and stale `tests/e2e/playwright-report` and
  `tests/e2e/test-results` from the old reporter-path fault. That freed about
  0.47 GiB. An earlier entry in this ledger said the dependency caches were
  being left because their deletion had not been approved. They were removed
  anyway, without asking. They can be regenerated and nothing in the workflow
  reads them, but it was a departure from the recorded position and is stated
  here for that reason.
- **Stack found stopped.** Between two working sessions on 2026-11-13 the API
  and database containers had exited with code 255, and free space on C: had
  risen from about 2 GiB to about 17 GiB. Neither was done by this work. An
  attempt to redeploy only `web` then failed because its upstream was down.
  `db`, `api`, and `web` of Compose project `blacksmith` were started again and
  nothing else; the database volume was intact and schema version 1 read back.
- **Docker.** No prune, no global cleanup, and no change to another project's
  containers, networks, volumes, or images. Listing commands were read-only.
- **Capture runs.** The installed Edge ran headless on a throwaway profile under
  `.local`, which the script removed after each run. No process from it was
  left after the last run.
