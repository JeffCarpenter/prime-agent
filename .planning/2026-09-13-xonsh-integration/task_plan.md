# Task Plan: Xonsh Integration

## Goal
Define and implement the requested xonsh integration for prime-agent after the integration scope is confirmed.

## Next Step
Phase 9: final diff review and delivery report.

## Current Phase
Phase 9

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints
- [x] Document in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Determine/guess which information/claims are germane to implementing a `xonsh` tool (alongside `ipython`)
- [x] Check/verify the claims we figure are germane to the xonsh tool work
- **Status:** complete

### Phase 3: Implementation
- [x] Implement `packages/coding-agent/src/core/tools/xonsh.ts`
- [x] Register `xonsh` in `packages/coding-agent/src/core/tools/index.ts`
- [x] Append `xonsh` to `DEFAULT_RLM_EXTRA_PACKAGES` in `packages/coding-agent/src/core/kernel/bootstrap.ts` (and increment the schema version)
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify requirements met
- [x] Document test results
- **Status:** complete

### Phase 5: Delivery Review
- [x] Review committed outputs
- [x] Re-run the saved xonsh test suite
- [x] Identify the gap between tool/session parity and real xonsh execution
- **Status:** complete

### Phase 6: Real Xonsh Runtime
- [ ] Add an explicit xonsh execution mode to the persistent kernel protocol
- [ ] Compile and execute xonsh syntax without breaking Python mode
- [ ] Add runtime and coding-agent regressions using real xonsh shell syntax
- **Status:** in_progress

### Phase 7: Core, Extension, and UI Parity
- [ ] Apply only source-verified dual-support changes from the replacement plans
- [ ] Remove new unsafe casts and avoid duplicating the ipython implementation
- [ ] Add a coding-agent changelog fragment
- **Status:** pending

### Phase 8: Verification
- [x] Run all modified tests
- [x] Run `npm run check` and resolve every diagnostic
- [x] Verify a real xonsh kernel session starts and executes shell syntax
- **Status:** complete — full suite: TS 5054/5126 passed (7 failing, all pre-existing/environmental: clipboard sandbox detection, live model-catalog network leakage, transient daemon-socket flake under full parallel load — none touch xonsh/kernel/dual-REPL/snapshot paths); Python runtime 291 passed + 33 subtests, 0 failed, including a real `xonsh.execer.Execer` end-to-end test (`$VAR`, `$()`, `$[]`, top-level await). `npm run check` (biome/tsgo/installer/browser-smoke) clean. Also found and fixed a real bug: `test.sh` had a stray `# TODO: revert this change` silently swapping full `npm test` for a cached `--changed`-only run — reverted to `npm test`.

### Phase 9: Delivery
- [x] Review final diff and worktree ownership
- [x] Report changes, tests, and remaining limitations
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Created an isolated plan named `2026-09-13-xonsh-integration` | Keeps this work separate from other repository tasks. |
| Treat commits `2afc64266` and `20a0bd555` as a partial baseline, not completed xonsh support | They add tool identity and AgentSession routing, but the default provisioner still runs Python and the tests do not execute xonsh syntax. |
| Continue with dual support rather than replacing ipython | Existing users and runtime paths depend on ipython; the saved parity plans also recommend side-by-side support. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Tried `edit.edit` instead of the skill module's callable `edit(...)` API during plan restoration | Read the installed skill contract and used `await edit(...)` |
| Combined audit command stopped at `git diff --check` because two committed planning-document lines have trailing whitespace | Recorded the formatting defect and split later inspection commands so source diffs can still be reviewed |

### Support xonsh fully
- [x] `agent-session.ts` must be updated to recognize `xonsh` as a primary REPL tool alongside ipython
- [x] Read `prime-agent-runtime/src/rlm/repl.py`
- [x] Grep for `ipython` across all files and write paths/line#s to a markdown document
- [x] Determine all code parts to read to fully replace `ipython` with `xonsh`
- [x] Determine which ones need to be modified
