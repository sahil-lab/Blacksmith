# Threat model and safety contract

## Scope and assets

The local skeleton processes synthetic labels only. Assets are the developer
machine, Docker daemon, local credentials, project database, source files, and
other concurrently running projects. Treat all HTTP input as untrusted, even on
localhost. No customer data, CI source code, tokens, or provider credentials are
required or accepted.

## Threats and controls

| Threat                                    | Phase 1 control                                                                                                                       | Verification / residual risk                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Accidental real CI execution              | No worker, shell, process-launch, command, or upload interface; preflight requires `simulation: true`                                 | Reject false/missing simulation and unknown executable-command fields; labels are never executed |
| Input injection or oversized metadata     | Bean validation, explicit length/character constraints, strict JSON decoding; parameter-free bootstrap query                          | Test malformed/invalid requests; general API body/rate limiting is deferred                      |
| Secret disclosure                         | Generated ignored secret file, Compose secret mounts, sanitized errors, no request-value logging                                      | Inspect tracked-intent files/config; local files still depend on host account permissions        |
| Accidental external exposure              | Fixed IPv4 loopback publications; no DB port; health details suppressed                                                               | Inspect effective bindings; no authentication or production TLS is claimed                       |
| Cross-project interference                | Fixed `blacksmith` Compose project, namespaced networks/volumes, exact service commands                                               | Never use Docker prune, wildcard removal, global stop, or another project name                   |
| Host compromise through containers        | No Docker socket, privileged mode, host networking, or source execution in runtime containers; non-root web/API, dropped capabilities | These controls do not make Compose safe for untrusted CI workloads                               |
| SQL/data-state failures hidden as success | Fail startup on migration errors, DB-backed readiness, 503 on system-query failure                                                    | Integration tests plus API failure tests; no default healthy values                              |
| Browser injection                         | React text rendering, bounded labels, same-origin API, restrictive static-server headers                                              | Frontend and browser smoke tests; no raw HTML rendering. The immersive rebuild left the Content Security Policy unchanged: no inline script or style, no remote font, script, or media |
| Decoration mistaken for data              | Every formation is captioned as an illustration; real values appear only in the signal and workbench sections; planned modules are labelled as not built | Tests assert that formation captions exist only while the scene is drawn and that the page turns cold, not healthy, when the API is down |
| Client-side load from the WebGL scene     | Capped pixel ratio and fixed ember counts, a quality governor, a pause control, reduced-motion support, refusal of software renderers | Measured on one integrated GPU only; other devices can still drop frames. The page stays usable because the scene is not required |
| Real-GPU capture tooling                  | Opt-in local script; headless browser on a throwaway profile under `.local`; ephemeral loopback DevTools port; stops only processes started on that profile | While it runs, other local processes could reach that port and drive the throwaway browser. A `-Probe` file runs as page script, so only run your own |
| Resource exhaustion                       | CPU/memory/PID limits, bounded JDBC pool, bounded validation requests and browser timeouts                                            | Not a denial-of-service defense; public exposure and load testing are out of scope               |
| Supply-chain drift                        | Package lockfile, fixed major runtime lines, Maven parent version, reproducible test commands                                         | Not a completed dependency/security audit; immutable image digests are future hardening          |
| Destructive test behavior                 | Separate ephemeral test DB; no DB publication or application-table mutation in preflight                                              | Check migration/table counts and cleanup only named check services                               |

## Human approval boundaries

Separate explicit approval is required for:

- Git initialization, branches, commits, remotes, pushes, or PR changes.
- Destructive operations, volume deletion, data resets, or credential rotation.
- Accessing real repositories, customer data, credentials, or production systems.
- Cloud spending, provisioning, deploying, or opening network access.
- Adding actual CI execution, hardened workers, optional agents, or broad upgrades.
- Editing files outside this Blacksmith project.

Starting and validating this local synthetic skeleton is authorized. This
directory is now a Git repository with a remote, set up outside the agent work
recorded here (see the [phase ledger](PLAN.md#repository-state-observed-on-2026-11-13)).
That does not widen the boundary above: commits, pushes, and branch, remote, or
pull-request changes by an agent still need explicit approval, and an approval
given for another project does not apply here. No global runtime
installation/replacement or global Docker cleanup is allowed.

## Not a security certification

This is a design-time threat model with focused safety tests, not an independent
penetration test or a claim of production readiness. Authentication, tenant
authorization, quotas, retry semantics, rate limits, and hardened worker execution
must be designed and tested in later phases before any non-local use.
