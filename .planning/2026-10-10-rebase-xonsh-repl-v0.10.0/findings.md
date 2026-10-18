# Findings: Rebase xonsh-repl onto upstream v0.10.0

## Target and baseline identification

- Upstream latest stable release: `v0.10.0` (`8de18adda5d6fdea3dc31843d5955d311c92cb9e`).
- Upstream merge base: `v0.9.8` (`7d442aafa985f9342134fac16c2ef41f03fb45c1`).
- Source branch: `xonsh-repl` (`e4ff354a10df76846feae6dbf4350ea0ae5cf1c8`).
- Commits on `xonsh-repl` since `v0.9.8`: 37 commits.
- Commits on `upstream` since `v0.9.8`: 161 commits.
- Post-`v0.10.0` commits on `upstream/main`: 23 commits.

## Architectural discovery: Upstream Rust migration

- In upstream commit `39bc99a91` (PR #2524, "Port Prime Agent to Rust"), upstream completely removed all TypeScript packages (`packages/agent`, `packages/ai`, `packages/coding-agent`, `packages/tui`, root `package.json`, `package-lock.json`) — deleting 1,181 files.
- Upstream replaced the TypeScript architecture with a Cargo workspace in `crates/` (`pa-core`, `pa-daemon`, `pa-tui`, `pa-cli`, `pa-agent`, `pa-ai`, `pa-models`, `pa-types`, etc.) and `Cargo.toml`.
- `v0.9.8` was the final published stable release of the TypeScript era. `v0.10.0` is the first stable release of the Rust era.
- Upstream retained and extended `prime-agent-runtime/` (Python runtime sidecar, with factory state machines and Rust daemon hooks).

## Divergence inspection

- 53 files overlap between `v0.9.8..v0.10.0` and `v0.9.8..HEAD`.
- Fork branch `xonsh-repl` has 28 commits modifying TypeScript in `packages/coding-agent` (REPL manager, session lifecycle, TUI components, xonsh tools, tests).
- 4 commits modify `prime-agent-runtime/` (Python runtime).
- 3 commits add `skills/zsh`.
- 2 commits add `scripts/install.xsh` and Arch Linux `pkgbuild/PKGBUILD`.
- Staged in main worktree: `pkgbuild/PKGBUILD`.
- Untracked files in main worktree preserved.
- Divergence graph recorded in JSON-LD at `.planning/2026-10-10-rebase-xonsh-repl-v0.10.0/divergences.jsonld`.

## Rebase conflict analysis

- Direct git rebase onto `v0.10.0` immediately conflicts on commit 1 (`eb8c04188 use pnpm`) because `package.json` and `packages/` were deleted upstream.
- Resolving modify/delete conflicts by accepting upstream deletions drops all TypeScript xonsh REPL functionality.
- Reconciling this conflict requires choosing between:
  1. Coexistence / Dual-stack: Preserve `packages/` alongside `crates/` in the fork tree, updating `prime-agent-runtime/src/rlm/repl.py` to reconcile xonsh with upstream's new runtime additions.
  2. Port to Rust: Retain `xonsh-repl` on `v0.9.8` (where `TEST_POLICY_BASE=v0.9.8 npm run check` already passes 100% clean) and plan a dedicated port of xonsh REPL to `crates/pa-core/src/kernel`.
  3. Replay non-TypeScript commits only: Apply Python runtime (`prime-agent-runtime`), zsh skill, and scripts onto `v0.10.0`.
