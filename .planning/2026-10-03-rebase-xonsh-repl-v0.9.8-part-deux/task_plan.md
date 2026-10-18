# Task Plan: Rebase `xonsh-repl` (part-deux) onto latest stable release (v0.9.8)

## Goal

Prepare an isolated, reviewable replay of `xonsh-repl` (the 35 post-`v0.9.6` commits up to `243e8be86` / `7fa656118`, excluding model registry/cost commits) onto upstream release `v0.9.8`, without disturbing the current worktree or silently losing behavior.

## Scope and approval

Approved by user to execute. Pin this plan with `PLAN_ID=2026-10-03-rebase-xonsh-repl-v0.9.8-part-deux`; do not change the shared active-plan pointer.

## Next Step

Rebase complete and validated. No further action needed.

## Current Phase

All phases complete. `xonsh-repl` rebased onto `v0.9.8` at `1ba1dc654`. Auxiliary worktree removed.

## Phases

### Phase 1: Confirm target and protect work
- [x] Confirm `gh release view --repo PrimeIntellect-ai/prime-agent --json tagName,isPrerelease` still identifies `v0.9.8` as latest stable release.
- [x] Record `xonsh-repl` HEAD (`243e8be86`), staged/untracked paths, and upstream tag commit (`7d442aafa985f9342134fac16c2ef41f03fb45c1`).
- [x] Confirm worktree isolation. Create isolated worktree `.worktrees/xonsh-repl-v0.9.8-rebase-part-deux` and branch `xonsh-repl-v0.9.8-rebase-part-deux` from current HEAD. Never switch or rebase the dirty worktree.
- **Status:** complete

### Phase 2: Fetch and inspect release
- [x] In the isolated worktree, verify `v0.9.8` tag commit is `7d442aafa985f9342134fac16c2ef41f03fb45c1`.
- [x] Confirm ancestry and inspect overlap. Record expected 35-commit replay count.
- [x] Verify dependency configuration in isolated worktree.
- **Status:** complete

### Phase 3: Replay on the isolated branch
- [x] Ensure isolated branch is rebased cleanly onto `v0.9.8`.
- [x] Inspect conflicts, preserve intentional behavior, and verify all 35 commits are in place.
- [x] Record branch tip.
- **Status:** complete

### Phase 4: Validate equivalence and checks
- [x] Compare with pre-rebase range using `git range-diff`; account for differences.
- [x] Sync `pnpm-lock.yaml` for v0.9.8 dependencies and commit on isolated branch.
- [x] Run `TEST_POLICY_BASE=v0.9.8 npm run check` in the isolated worktree and verify 0 errors/warnings.
- [x] Confirm worktree cleanliness and original worktree preservation.
- **Status:** complete

### Phase 5: Present for acceptance and adopt
- [x] Report branch tip, range-diff summary, and validation results.
- [x] Adopt rebased branch into `xonsh-repl` and clean up auxiliary worktree.
- **Status:** complete

## Decisions Made

| Decision | Reason |
|----------|--------|
| Target `v0.9.8` | Latest stable upstream release. |
| Isolate in `.worktrees/xonsh-repl-v0.9.8-rebase-part-deux` | Preserve original worktree's staged `pkgbuild/.SRCINFO` and untracked files. |
| Scope to 35 commits | Exclude subsequent model registry/discovery track (preserved on `xonsh-and-regi`). |

## Errors Encountered

None for this execution.
