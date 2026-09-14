# Task Plan: Xonsh Integration

## Goal
Define and implement the requested xonsh integration for prime-agent after the integration scope is confirmed.

## Next Step
Execute two-pronged approach: determine relevant claims, and implement/register the `xonsh` tool.

## Current Phase
Phase 1

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

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Created an isolated plan named `2026-09-13-xonsh-integration` | Keeps this work separate from other repository tasks. |

## Errors Encountered
| Error | Resolution |
|-------|------------|

### Support xonsh fully
- [ ] `agent-session.ts` must be updated to recognize `xonsh` as a primary REPL tool alongside ipython
- [ ] Read `prime-agent-runtime/src/rlm/repl.py`
- [ ] Grep for `ipython` across all files and write paths/line#s to a markdown document
- [ ] Determine all code parts to read to fully replace `ipython` with `xonsh`
- [ ] Determine which ones need to be modified
