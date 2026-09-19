# Task Plan: Context7 Skills Module & Specification Research

## Authorship & Collaboration
- **Author:** Jeff Carpenter
- **Co-author:** Gemini Flash 3.8 (agy v1.2.7)

## Goal
Research Context7 skill discovery mechanics, identify changelog specification skills, extract ephemeral driver commands into a cohesive, loosely coupled Node/ESM module of functions within `packages/coding-agent`, and verify with project checks.

## Next Step
Review findings documented. Ready for follow-up refactoring if desired.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Inspect `ctx7` command-line options and interactive behavior
- [x] Document discoveries in findings.md
- **Status:** complete

### Phase 2: Specification-Type Changelog Skill Evaluation
- [x] Search Context7 registry for changelog skills (31 indexed)
- [x] Identify specification-aligned skills (Keep a Changelog, Conventional Commits, SemVer)
- [x] Query metadata and inspect raw `SKILL.md` content for top candidates
- [x] Present comparative recommendations to user
- **Status:** complete

### Phase 3: Ephemeral Driver Reverse-Engineering & Module Design
- [x] Trace `ctx7/dist/index.js` functions (`searchSkills`, `getSkill`, `suggestSkills`)
- [x] Identify REST API endpoint formats and JSON response structures
- [x] Design loosely coupled, functional ESM module without third-party dependencies
- **Status:** complete

### Phase 4: Implementation & Verification
- [x] Implement initial functional module and CLI entry point
- [x] Validate headless search, get, fetch, and specification filtering
- [x] Run `npm run check` (Biome formatting, TypeScript check, installer, browser smoke)
- **Status:** complete

### Phase 5: PWF Planning Documentation
- [x] Initialize PWF planning directory `.planning/2026-09-19-context7-skills-module/`
- [x] Populate `findings.md`, `progress.md`, and `task_plan.md`
- **Status:** complete

### Phase 6: Relocation & Commit
- [x] Relocate `.mjs` files to `packages/coding-agent/scripts/lib/context7-skills.mjs` and `packages/coding-agent/scripts/ctx7-skills.mjs`
- [x] Verify execution from new path
- [x] Update planning documents to reflect new paths
- [x] Commit staged changes
- **Status:** complete

### Phase 7: Code Review & Retrospective
- [x] Dispatch rigorous code review subagent
- [x] Analyze reviewer findings (CLI arg poisoning, 404 unhandled rejection, filter inconsistencies)
- [x] Document architectural reflections and technical debt in findings.md
- [x] Clean up planning artifacts
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|---|---|
| Module placed in `packages/coding-agent/scripts/` | Associates Context7 skill management tooling directly with the Prime Agent (`packages/coding-agent`) package rather than workspace root. |
| Pure functional module in `lib/context7-skills.mjs` | Decouples registry interaction from CLI/UI, enabling reuse in scripts or tests. |
| CLI wrapper in `ctx7-skills.mjs` | Provides quick headless terminal access (`search`, `get`, `fetch`, `suggest`). |
| Native `fetch` and `URLSearchParams` | Zero external dependencies; leverages Node 20+ Web API standard. |
| Built-in `findSpecificationSkills` | Filters skills for Keep a Changelog, Conventional Commits, SemVer, OpenAPI. |

## Errors Encountered
| Error | Resolution |
|---|---|
| Subprocess hanging on `ctx7 skills search` | Bypassed interactive Inquirer prompt by querying Context7 REST API directly. |
| API payload schema assumption (`data.skills`) | Inspected `ctx7` code to confirm API returns `{ results: [...] }`. |
| Unhandled HTTP 404 in `getSkill` on missing skill | Flagged by code review; documented as technical debt to add try/catch in `getSkill`. |
| Positional argument poisoning when CLI flags precede args | Flagged by code review; documented as technical debt to separate positional args from flags in `runCli`. |
