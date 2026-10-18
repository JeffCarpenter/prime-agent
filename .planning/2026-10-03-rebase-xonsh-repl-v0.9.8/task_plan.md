# Task Plan: Rebase `xonsh-repl` onto the latest stable release

## Goal

Prepare an isolated, reviewable replay of `xonsh-repl`'s 53 post-`v0.9.6` commits onto upstream release `v0.9.8`, without disturbing the current worktree or silently losing behavior.

## Scope and approval

This file is a proposal, not authorization to fetch, create a worktree, rebase, commit, move `xonsh-repl`, or push. Confirm the target and obtain approval before execution. Pin this plan with `PLAN_ID=2026-10-03-rebase-xonsh-repl-v0.9.8`; do not change the shared active-plan pointer.

## Next Step

Rebased branch adopted into main worktree. All tasks complete.

## Current Phase

Completed: `xonsh-repl` branch updated to rebased tip `04c1251d8` on `v0.9.8`. Auxiliary worktree removed.

## Phases

### Phase 1: Confirm target and protect work
- [x] Confirm `gh release view --repo PrimeIntellect-ai/prime-agent --json tagName,isPrerelease` still identifies `v0.9.8` as latest stable release.
- [x] Record `xonsh-repl` HEAD (`4f108832b` at planning), staged/untracked paths, and upstream tag commit. Check that the proposed branch/path are unused.
- [x] Confirm worktree isolation with the user. Prefer a native worktree facility if available; otherwise use the ignored `.worktrees/xonsh-repl-v0.9.8-rebase` path and new branch `xonsh-repl-v0.9.8-rebase` from current HEAD. Never switch or rebase the dirty `xonsh-repl` worktree.
- **Status:** complete

### Phase 2: Fetch and inspect release
- [x] In the isolated worktree, fetch the exact `v0.9.8` tag from `upstream` and verify `v0.9.8^{commit}` is `7d442aafa985f9342134fac16c2ef41f03fb45c1` (remote observation on 2026-10-03). If the target changed, stop.
- [x] Confirm `v0.9.6` (`e260085dd8f742e0def3d871860c9a888b114851`) is the old branch base; inspect ancestry, overlap, and possible duplicate patches against `v0.9.8`. Record expected replay count and conflict-prone files before rebase.
- [x] Install dependencies in the isolated worktree using the project's supported commands only as needed; avoid generated artifacts in the original worktree.
- **Status:** complete

### Phase 3: Replay on the isolated branch
- [x] Run `git rebase --onto v0.9.8 v0.9.6` on `xonsh-repl-v0.9.8-rebase`, not `xonsh-repl`.
- [x] At each conflict, inspect both versions and preserve intentional behavior. Do not drop commits or functionality just to clear conflicts; ask the user about ambiguous intent. Resolve only files belonging to this isolated replay.
- [x] Record skipped/equivalent commits, conflict decisions, and final branch tip. If a safe resolution is not possible, stop; `git rebase --abort` is allowed only in the isolated worktree.
- **Status:** complete

### Phase 4: Validate equivalence and checks
- [x] Compare `v0.9.6..xonsh-repl` with `v0.9.8..xonsh-repl-v0.9.8-rebase` using `git range-diff`; account for every dropped or rewritten commit and review the final diff.
- [x] Run `TEST_POLICY_BASE=v0.9.8 npm run check` in the isolated worktree and inspect full output. Run focused tests only when authorized; run every test file changed during conflict resolution as required by `AGENTS.md`. Never run `npm test`, `npm run build`, or `npm run dev`.
- [x] Confirm worktree cleanliness, branch ancestry, and that original staged/untracked paths remain intact. Document any release-dependent test or catalog setup blocker rather than bypassing it.
- **Status:** complete

### Phase 5: Present for acceptance
- [x] Report new branch/tip, range-diff summary, resolved conflicts, validation, and any remaining risks.
- [x] Leave `xonsh-repl` in place for user review. Do not move it, merge, push, or force-push without separate approval. If later asked to adopt the rebased branch, first coordinate the original worktree's staged/untracked changes with their owner.
- **Status:** complete

## Decisions Made

| Decision | Reason |
|----------|--------|
| Target `v0.9.8`, not `upstream/main` or `v0.9.9-beta.*` | GitHub's latest non-prerelease is `v0.9.8` as of 2026-10-03. |
| Create a new branch in an isolated worktree | The original worktree contains unrelated staged and untracked files; never stash/reset them. |
| Use explicit `TEST_POLICY_BASE=v0.9.8` after replay | Local `upstream/main` is stale; the test-policy base must reflect the release being replayed. |
| Gate any update to the original branch | Rebase rewrites history and requires explicit review before adoption or push. |
| In `package-lock.json` (commit 1), kept incoming dependencies | Preserved `@types/mime-types` and `@xterm/xterm` entries added by `7bb7584cd`. |
| In `packages/ai/package.json` (commit 2), kept `@opentelemetry/api` & `@smithy/*`, omitted `chalk` | Upstream `v0.9.8` removed `chalk` as unused; `@smithy` and `@opentelemetry/api` are actively imported. |
| In `packages/coding-agent/src/core/model-registry.ts` (commit 37), kept `OPENAI_CODEX_CLIENT_VERSION = "0.159.0"` | Upstream `v0.9.8` bumped client version from `0.153.4` to `0.159.0` with full rationale in #3146. |

## Errors Encountered

Rebase conflicts on commits 1, 2, and 37 resolved cleanly according to intentional changes. Branch tip: `cf6824296ccda35aec7e7bac6ea2cc3fa7ab251d`.
