# Architecture

## Phase 1 topology

```mermaid
flowchart LR
    Browser["Browser: 127.0.0.1:18102"] --> Web["Non-root Nginx + React/TypeScript"]
    Web -->|same-origin /api and health proxy| API["Java 21 / Spring Boot 3"]
    Dev["Local tools: 127.0.0.1:18202"] --> API
    API -->|JDBC / bounded connection pool| DB[("PostgreSQL: private network")]
    API --> Flyway["Flyway bootstrap migration"]
    Secret["Ignored local generated secret"] -. read-only mount .-> API
    Secret -. read-only mount .-> DB
    Tests["Isolated checks profile"] --> TestDB[("Ephemeral test PostgreSQL")]
```

All services belong to Compose project `blacksmith`. Only web and API bind host
ports, on IPv4 loopback. The DB and API share a private, internal data network.
The API has a separate frontend network connection for the web proxy.

## Interfaces

| Route                            | Behavior                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/system`                | Read the bootstrap schema marker from PostgreSQL; report application, phase, execution mode, and schema version |
| `POST /api/preflight`            | Validate a synthetic label and `simulation: true`; return a non-persistent acknowledgement                      |
| `GET /actuator/health/liveness`  | Process availability; independent of database availability                                                      |
| `GET /actuator/health/readiness` | Readiness including PostgreSQL connectivity                                                                     |
| `GET /actuator/health`           | Aggregate health with no internal details exposed                                                               |

The [OpenAPI contract](../packages/contracts/openapi.yaml) is the source for
generated TypeScript types. Java contract tests assert exact response properties,
status codes, and validation semantics. The frontend also validates received
data at runtime instead of trusting a type assertion on network input.

Errors use Spring `ProblemDetail` (`application/problem+json`) with stable error
types and field-level messages. They never echo request values, SQL, credentials,
or stack traces. Database access failures on system information return 503, not
fabricated readiness. Missing future domain routes return 404.

## Persistence and migrations

Flyway owns schema history. V1 creates a single constrained `bootstrap_state`
row with schema version 1. It is synthetic infrastructure metadata, not a job.
Application startup requires a valid migration and database connection.

The production-like local DB uses a named project volume; tests use a separate
database container and ephemeral storage. Integration tests never target the
application DB. Domain tables (`jobs`, `runners`, `runner_leases`,
`cache_entries`, `schedule_decisions`) begin in Phase 2.

For this additive bootstrap migration, automatic destructive rollback is
intentionally absent. Recovery uses a forward migration. Dropping a schema or
deleting a volume requires explicit approval and is not part of startup/testing.

## Runtime and observability

- Supported container runtimes: Java 21 and Node 22; Maven in a Java 21 image.
- Spring Boot 3.5 line, with the initial patch selected from Maven metadata.
- Structured JSON console logs and OpenTelemetry-backed local trace context.
- No remote telemetry exporter, cloud account, collector, Redis, Kafka, or worker.
- JDBC connection pool bounded to four connections with finite timeouts.
- Containers have CPU, memory, PID, and log limits; web/API run non-root with
  read-only filesystems and temporary writable directories.
- Database credentials are file-mounted secrets, not embedded in an image,
  manifest, frontend bundle, or checked-in environment file.

## Future boundaries

The API will own contracts, authorization, state transitions, and persistence.
A separate worker will initially simulate execution behind an explicit interface.
An actual untrusted-code runner would require a separately reviewed hardened
isolation design; Docker Compose alone is not such a security boundary.

Redis and asynchronous events are introduced only when a demonstrated requirement
justifies them. Candidate events from the guide are `job.queued`, `runner.ready`,
`job.started`, `job.finished`, and `runner.failed`; none is emitted in Phase 1.
