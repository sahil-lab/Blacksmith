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
- Decoration must never present itself as data. Caption illustrations, show a
  number only if it is measured or real, and keep controls truthful about state.
- The browser tests have no GPU. After any change to the WebGL scene, shaders,
  or formations, run `scripts/Capture-Scene.ps1` on real hardware, look at the
  captures, and record what it reported.

The CI workflow runs on push and pull request. A local passing run is not
evidence that hosted CI has run or passed; this work has not checked any hosted
run.
