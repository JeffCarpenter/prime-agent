# Task Plan: Context7 Skills Module & Specification Research

## Authorship & Collaboration
- **Author:** Jeff Carpenter
- **Co-author:** Gemini Flash 3.8 (agy v1.2.7)

## Goal
Research Context7 skill discovery, identify specification-aligned changelog skills, extract driver commands into a standalone Node ESM module under `packages/coding-agent`, and verify with project checks.

## Next Step
Catalog technical debt and follow-up fixes in [`future_work.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/future_work.md) for implementation.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Inspect `ctx7` command-line options and interactive behavior
- [x] Document discoveries in [`findings.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/findings.md)
- **Status:** complete

### Phase 2: Specification-Type Changelog Skill Evaluation
- [x] Search Context7 registry for changelog skills (31 indexed)
- [x] Identify specification-aligned skills (Keep a Changelog, Conventional Commits, and SemVer)
- [x] Query metadata and inspect raw `SKILL.md` files for top candidates
- [x] Present recommendations to the user
- **Status:** complete

### Phase 3: Ephemeral Driver Reverse-Engineering & Module Design
- [x] Trace `ctx7/dist/index.js` functions (`searchSkills`, `getSkill`, and `suggestSkills`)
- [x] Identify REST API endpoint formats and JSON response structures
- [x] Design a standalone ESM module without third-party dependencies
- **Status:** complete

### Phase 4: Implementation & Verification
- [x] Implement the module and CLI entry point
- [x] Validate headless search, get, fetch, and specification filtering
- [x] Run `npm run check` (Biome formatting, TypeScript checks, installer, and browser smoke test)
- **Status:** complete

### Phase 5: PWF Planning Documentation
- [x] Initialize planning directory `.planning/2026-09-19-context7-skills-module/`
- [x] Populate [`findings.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/findings.md), [`progress.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/progress.md), and [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/task_plan.md)
- **Status:** complete

### Phase 6: Relocation & Commit
- [x] Relocate scripts to [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) and [`packages/coding-agent/scripts/ctx7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/ctx7-skills.mjs)
- [x] Verify execution from the new path
- [x] Update planning documents to reflect new paths
- [x] Commit staged changes
- **Status:** complete

### Phase 7: Code Review & Retrospective
- [x] Dispatch a code review subagent
- [x] Analyze review findings (CLI flag poisoning, unhandled 404 rejection, and filter inconsistencies)
- [x] Document architectural trade-offs and technical debt in [`findings.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/findings.md)
- [x] Clean up planning artifacts
- **Status:** complete

### Phase 8: Backlog & Technical Debt Cataloging
- [x] Create project backlog in [`future_work.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/future_work.md)
- [x] Create active plan in [`future_work.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-context7-skills-module/future_work.md)
- [x] Evaluate difficulty and complexity on a 0–10 scale
- [x] Synchronize planning files
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|---|---|
| Module placed in `packages/coding-agent/scripts/` | Places Context7 skill tooling in `packages/coding-agent` instead of the workspace root. |
| Pure functional module in `lib/context7-skills.mjs` | Decouples registry interaction from the CLI, enabling reuse across scripts and tests. |
| CLI wrapper in `ctx7-skills.mjs` | Provides headless terminal access (`search`, `get`, `fetch`, and `suggest`). |
| Native `fetch` and `URLSearchParams` | Eliminates external dependencies by using the Node 20+ Web standard. |
| Built-in `findSpecificationSkills` | Filters skills for Keep a Changelog, Conventional Commits, SemVer, and OpenAPI. |

## Errors Encountered
| Error | Resolution |
|---|---|
| Subprocess hung on `ctx7 skills search` | Bypassed the interactive prompt by querying the Context7 REST API directly. |
| API payload schema assumption (`data.skills`) | Inspected `ctx7` source to confirm the API returns `{ results: [...] }`. |
| Unhandled HTTP 404 in `getSkill` on missing skill | Flagged in review; logged technical debt to catch 404 status codes in `getSkill`. |
| Positional argument poisoning when CLI flags precede args | Flagged in review; logged technical debt to separate positional arguments from flags in `runCli`. |
