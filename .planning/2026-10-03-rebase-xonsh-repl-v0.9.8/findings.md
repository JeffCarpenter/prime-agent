# Findings: latest-release rebase preparation

## Requirements and evidence

- Requested: propose, then create a **new plan** to rebase onto the latest tagged release; do not perform the rebase yet.
- `gh release view --repo PrimeIntellect-ai/prime-agent --json tagName,isPrerelease,publishedAt` returned `v0.9.8`, `isPrerelease: false`, published `2026-09-29T22:06:42Z`.
- `git ls-remote --tags upstream` showed `v0.9.8` pointing to commit `7d442aafa985f9342134fac16c2ef41f03fb45c1`. `v0.9.9-beta.1` through `.38` exist but are prereleases. The release tag has **not** been fetched locally.
- Current `xonsh-repl` HEAD is `4f108832b` (`fix: select test policy base from the active branch`). Local `v0.9.6` / `upstream/main` is `e260085dd8f742e0def3d871860c9a888b114851`, an ancestor of HEAD; `v0.9.6..HEAD` has 53 commits. Remote `upstream/main` is newer (`cfe398105ed8753d0fbcfbeb186934285730a5a3`), but is **not** the requested target.
- Current worktree has an unrelated staged `pkgbuild/.SRCINFO` and multiple untracked planning/probe/artifact paths. `.worktrees/` exists and is ignored. No other linked worktree or `xonsh-repl-v0.9.8-rebase` branch was present when checked.
- The earlier `.planning/2026-10-02-rebase-xonsh-repl-prep/scratchpad.md` addresses rebasing onto an installer branch, not this release; its old branch graph is stale.

## Risks and controls

| Risk | Control |
|------|---------|
| GitHub's latest release changes before execution | Recheck release and tag before fetching or replaying; revise target on change. |
| Tag and branch may have overlapping commits | Inspect patch equivalence and review every omission with `git range-diff`. |
| Rebase conflicts alter intended behavior | Review both sides; ask before removing intentional functionality. |
| `npm run check` chooses an older local main ancestor | Set `TEST_POLICY_BASE=v0.9.8` for post-rebase checks. |
| Dirty original worktree gets overwritten | Rebase only an isolated new branch; leave original staged/untracked files untouched. |
| Worktree has no dependencies or catalog assets | Set up locally as required; do not run forbidden commands or weaken policy. |

## Open questions for execution

- Which of the 53 commits are already represented in `v0.9.8`? Answered: None. `git cherry -v v0.9.8 HEAD v0.9.6` shows all 53 commits have unique patches (`+`).
- Does replay conflict with release changes? 18 files overlap between `v0.9.6..v0.9.8` (17 commits) and `v0.9.6..HEAD` (53 commits). Overlapping paths: `package.json`, `package-lock.json`, `packages/*/package.json`, `repl-manager.ts`, `model-registry.ts`, `session-manager.ts`, `interactive-mode.ts`, `conversation-components.ts`, `model-selector.ts`, `theme.ts`, and test files.
- Should the rebased branch replace `xonsh-repl` after validation? Requires separate user approval.

## Phase 2 Inspection Results

- Upstream tag `v0.9.8` fetched: verified commit `7d442aafa985f9342134fac16c2ef41f03fb45c1`.
- Merge base: `git merge-base v0.9.8 HEAD` is `e260085dd8f742e0def3d871860c9a888b114851` (`v0.9.6`).
- Replay range: exactly 53 commits to replay.
- Upstream changes: 17 commits in `v0.9.6..v0.9.8`.
- Note on package management: `7bb7584cd` ("use pnpm") changed scripts to pnpm; upstream `v0.9.8` uses npm. Rebase may see conflicts on `package.json` and lockfiles.
