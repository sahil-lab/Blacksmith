# Blacksmith: Predictive Cache-Aware CI Scheduler

An original, independent engineering prototype inspired by Blacksmith's public
product area. It is not affiliated with Blacksmith and uses no private company
systems or real customer data.

## Current scope

This iteration covers **Phase 0 (contract and safety)** and **Phase 1 (working
skeleton)** only. See [the phase ledger](docs/PLAN.md) for verified results.

The skeleton will provide a React/TypeScript dashboard, a Java 21/Spring Boot 3 API,
PostgreSQL, a versioned bootstrap migration, health checks, and a simulation-only
request-validation round trip. It does **not** queue, schedule, execute, or persist
jobs. A successful preflight is not a successful CI run.

Planned domain routes (`POST /jobs`, `GET /jobs/{id}`, `GET /runners`,
`GET /metrics`), runner leases, caches, fairness policies, and benchmarks belong to
later phases and are not implemented here.

## Local development

Prerequisite: Docker Engine with Linux containers and Docker Compose v2 or later.
Use PowerShell from this directory. Java, Maven, Node, and npm run in project
containers; the host's Node 14 is not used and no host runtime is replaced.
Generated dependency trees and caches use `blacksmith`-scoped Docker volumes to
avoid slow Windows bind-mounted package restores. Authored source, lockfiles,
configuration, and test reports remain inside this project.

```powershell
.\scripts\Start-Local.ps1
.\scripts\Verify.ps1
```

- Dashboard: <http://127.0.0.1:18102>
- API information: <http://127.0.0.1:18202/api/system>
- Liveness: <http://127.0.0.1:18202/actuator/health/liveness>
- Readiness, including PostgreSQL: <http://127.0.0.1:18202/actuator/health/readiness>
- API contract: [OpenAPI](packages/contracts/openapi.yaml)

The scripts always select Compose project `blacksmith`. The database has **no
published port**. Local credentials are generated once into ignored local storage,
never printed, and mounted as container secrets. Do not delete or rotate these
credentials while retaining the corresponding database volume.

To stop only this project's application containers without removing its data:

```powershell
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml stop web api db
```

Do not use global Docker cleanup commands. Do not initialize Git, configure a
remote, commit, push, provision cloud resources, or access real data without
separate approval.

## Skeleton walkthrough

1. Open the dashboard and confirm API/database readiness.
2. Submit the synthetic workload label `synthetic-demo`.
3. Confirm the response explicitly says simulation only, with no job persisted.
4. Inspect the documented invalid-request tests; a request to execute real code
   must be rejected.

This is a skeleton demonstration, not the scheduler demonstration or benchmark
requested for Phase 6.

## Repository map

| Directory                                | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| [apps/web](apps/web)                     | Dashboard and frontend tests                            |
| [services/api](services/api)             | API, migration, Java tests                              |
| [services/worker](services/worker)       | Deferred simulated-worker boundary                      |
| [packages/contracts](packages/contracts) | OpenAPI and generated frontend types                    |
| [infra/docker](infra/docker)             | Isolated local stack and validation tooling             |
| [tests/e2e](tests/e2e)                   | Browser/API smoke validation                            |
| [benchmarks](benchmarks)                 | Deferred reproducible evaluation                        |
| [docs](docs)                             | Requirements, architecture, safety, decisions, evidence |

## Engineering references

- [Requirements and measurable acceptance criteria](docs/PRD.md)
- [Architecture and interfaces](docs/ARCHITECTURE.md)
- [Threat model and approval boundaries](docs/THREAT_MODEL.md)
- [Decisions and trade-offs](docs/DECISIONS.md)
- [Coding and validation conventions](docs/CONTRIBUTING.md)
- [Ordered plan, limitations, and verification evidence](docs/PLAN.md)

The source specification is the included
[engineering guide](02_Blacksmith_CI_Scheduler.pdf), read in full (all three pages).
Redis, Kafka, cloud deployment, full tracing infrastructure, authentication,
untrusted workers, and production hardening are deliberately deferred.
