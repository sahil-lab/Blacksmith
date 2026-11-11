# Coding and validation conventions

- Stay within the current phase in [the plan](PLAN.md). Keep one owner for edits.
- Prefer small typed records/components and existing framework facilities.
- Format Java using Spotless / Google Java Format; format TypeScript, JSON, YAML,
  CSS, HTML, and documentation with Prettier.
- Use strict TypeScript, no unchecked `any` or network-response type assertions.
- Validate HTTP requests server-side and never accept an execution command.
- Surface failures to callers and logs without logging request bodies or secrets.
- Use OpenAPI as the contract; regenerate frontend types through the npm scripts.
- Use synthetic, deterministic fixtures. Keep DB integration tests separate from
  application state. Do not invent benchmarks or describe unexecuted checks as
  passed.
- Run formatting, compilation, unit tests, integration tests, and the real smoke
  test for this vertical slice. Record exact commands and actual results.
- Use the project scripts/container tooling, not host Node 14 or a globally
  installed Java/Maven. Do not independently replace Docker-managed runtimes.
- Preserve the guide and unrelated user work. No Git operations without approval.

CI is defined for a future approved Git repository. A local passing run is not
evidence that hosted CI has run.
