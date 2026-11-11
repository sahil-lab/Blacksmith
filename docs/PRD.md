# Requirements and acceptance criteria

## Product and iteration

The eventual product is a simulated, GitHub Actions-compatible scheduler that
investigates queue delay, cold starts, cache locality, fairness, and compute cost.
This is an independent prototype, not a claim about Blacksmith's private systems.

The approved iteration ends at Phase 1. The source guide's section 06
("start from zero") supplies the implementation prompt. Sections 07-09 and the
benchmark definition of done were read, but do not authorize later-phase work.

## User stories

1. As an evaluator, I can start the local skeleton without installing Java or
   replacing the host Node runtime.
2. As a developer, I can distinguish process liveness from database readiness.
3. As an evaluator, I can submit a synthetic workload label and receive a clearly
   simulation-only, non-persistent validation result.
4. As a developer, I receive a deterministic, sanitized client error for invalid
   or unsupported requests rather than a success-shaped fallback.
5. As a maintainer, I can reproduce formatting, compilation, unit/integration
   tests, and a browser/API/database smoke check using project-local tooling.

## Phase 0 requirements

- Document product requirements, interfaces, non-goals, architecture, threat
  model, coding conventions, acceptance gates, and decisions before application
  implementation.
- Scaffold the monorepo layout, ignore rules, and CI configuration.
- Preserve the supplied PDF. Git metadata is approval-gated separately; the
  existing directory is sufficient for local build and test.

## Phase 1 requirements

- Java 21 / Spring Boot 3 API, React / TypeScript frontend, PostgreSQL, Compose.
- Flyway bootstrap migration; no jobs, runners, or scheduling tables yet.
- Liveness and readiness endpoints with the database included in readiness.
- Database-backed system information and a side-effect-free preflight endpoint.
- Server-side constraints on workload names, strict JSON shape, and mandatory
  `simulation: true`. Reject executable-command fields.
- OpenAPI contracts, structured application logs, environment-based
  configuration, and local OpenTelemetry trace context without an exporter.
- Visible loading/error states in the frontend; never invent health or metrics.
- Resource-limited, non-root web/API containers, private DB networking, local
  secret files, no Docker socket or execution interface.

## Acceptance gates

| ID    | Measurable criterion                                                                                              | Evidence required                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0-01 | All 3 guide pages read; phases and approval boundaries documented                                                 | Guide fingerprint and phase ledger                       |
| P0-02 | Required docs, ignore rules, CI, and conventions present before Phase 1                                           | Phase 0 file inventory                                   |
| P1-01 | Compose project is `blacksmith`; only 127.0.0.1:18102 and :18202 published; no DB port                            | Resolved configuration and running port inspection       |
| P1-02 | API, web, and DB healthy within the documented 180-second startup wait after build                                | Compose health state and actual HTTP responses           |
| P1-03 | Migration version 1 applied once; system information reads schema version 1 from PostgreSQL                       | PostgreSQL integration assertions and runtime smoke      |
| P1-04 | Valid preflight returns 200 with `executionMode: SIMULATED` and `persisted: false`                                | Controller/integration and browser tests                 |
| P1-05 | Blank/oversized/invalid names, missing or false simulation, malformed or unknown JSON fields return 400           | Parameterized Java tests and API smoke assertions        |
| P1-06 | Browser shows API/database health and the preflight result; API failure is visible                                | Frontend unit tests and real browser E2E                 |
| P1-07 | Formatting, TypeScript checks, frontend build, Java build, unit tests, PostgreSQL integration tests, and E2E pass | Exact commands, counts, and retained reports             |
| P1-08 | Tests do not execute code, expose secrets, access real data, or touch other Compose projects                      | Boundary tests, configuration inspection, command ledger |

The startup wait is an operational bound, not a performance benchmark. Image
downloads and compilation are outside that bound.

## Explicit non-goals

No GitHub access, webhook ingestion, authentication claims, permissions model,
job CRUD, idempotency keys, state machine, scheduling, cache scoring, runner
execution, tenant isolation, agents, Kafka, Redis, retries, rate limiting, chaos
suite, benchmark results, or cloud provisioning. Those require subsequent phases.
The skeleton is not safe to expose beyond the developer's machine.

## Future evaluation, not yet measured

Phase 6 will compare FIFO and locality-aware policies on a reproducible synthetic
trace, reporting p95 queue delay, cache hit rate, cost/job, and tenant fairness.
There are no scheduler measurements or performance claims in this iteration.
