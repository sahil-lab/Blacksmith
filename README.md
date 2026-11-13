# Blacksmith: Predictive Cache-Aware CI Scheduler

An original, independent engineering prototype inspired by Blacksmith's public
product area. It is not affiliated with Blacksmith and uses no private company
systems or real customer data.

## Current scope

This iteration covers **Phase 0 (contract and safety)** and **Phase 1 (working
skeleton)** only. See [the phase ledger](docs/PLAN.md) for verified results.

The verified skeleton provides a React/TypeScript dashboard, a Java 21/Spring Boot 3 API,
PostgreSQL, a versioned bootstrap migration, health checks, and a simulation-only
request-validation round trip. It does **not** queue, schedule, execute, or persist
jobs. A successful preflight is not a successful CI run.

The interface is an immersive single page rather than a dashboard. A hand-written
WebGL2 scene of embers forms an anvil, a cold job queue, a runner pool, a glowing
field, and a hammer as you scroll, with kinetic variable type, a pinned sideways
method section, and a strike interaction. All of that is decoration over a page
that works without it: every figure is captioned as an illustration, the warm or
cold look follows the one real readiness reading, and the workbench is the only
functional surface. Without WebGL2, on a software renderer, or with reduced
motion, the same page runs with a static illustration. See the
[front-end notes](apps/web/README.md) and the
[immersive UI rebuild evidence](docs/PLAN.md#immersive-ui-rebuild).

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

The test containers have no GPU, so they exercise the static fallback and a
small software render of the scene. To see and check what a real GPU draws, an
optional Windows-only script drives an installed Edge or Chrome headless on a
throwaway profile and saves screenshots plus a JSON summary to ignored local
storage. It needs the stack to be running and is not part of `Verify.ps1` or CI:

```powershell
.\scripts\Capture-Scene.ps1
.\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -DesktopOnly -OutputDirectory .\.local\evidence\display
.\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -Probe .\scripts\probes\transition-pacing.js
```

The scripts always select Compose project `blacksmith`. The database has **no
published port**. Local credentials are generated once into ignored local storage,
never printed, and mounted as container secrets. Do not delete or rotate these
credentials while retaining the corresponding database volume.

The runtime networks use local-lab subnets `198.18.102.0/28` and
`198.18.102.16/28`, checked as unoccupied on this host. If another host reports a
subnet collision, stop and choose non-overlapping addresses in the Compose file;
never prune or reconfigure unrelated networks. Keep sufficient free disk space
for dependency caches and Docker images; disk-full errors must be resolved before
retrying a failed build.

To stop only this project's application containers without removing its data:

```powershell
docker compose --project-name blacksmith --file .\infra\docker\compose.yaml stop web api db
```

Do not use global Docker cleanup commands. Do not commit, push, change Git
remotes, provision cloud resources, or access real data without separate
approval.

## Skeleton walkthrough

1. Open the page and wait for the intro; the header shows `Stack ready` once the
   API and database have answered.
2. Scroll. The embers reform for each section; click the opening screen or use
   `Strike the anvil`. None of this touches the API.
3. In the workbench, submit the synthetic workload label `synthetic-demo`.
4. Confirm the response explicitly says simulation only, with no job persisted.
5. Inspect the documented invalid-request tests; a request to execute real code
   must be rejected.

This is a skeleton demonstration, not the scheduler demonstration or benchmark
requested for Phase 6.

## Repository map

| Directory                                | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| [apps/web](apps/web)                     | Front end, WebGL scene, and frontend tests              |
| [services/api](services/api)             | API, migration, Java tests                              |
| [services/worker](services/worker)       | Deferred simulated-worker boundary                      |
| [packages/contracts](packages/contracts) | OpenAPI and generated frontend types                    |
| [infra/docker](infra/docker)             | Isolated local stack and validation tooling             |
| [scripts](scripts)                       | Start, verify, and real-GPU capture workflows           |
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
