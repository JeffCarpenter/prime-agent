# Task Plan: Rebase `xonsh-repl` onto latest upstream version (v0.10.0)

## Goal

Rebase `xonsh-repl` onto upstream release `v0.10.0` (`8de18adda5d6fdea3dc31843d5955d311c92cb9e`), note divergences in JSON-LD, reconcile all conflicts cleanly in an isolated worktree, verify with quality gates, and adopt onto `xonsh-repl`.

## Scope and approval

- Target: Upstream release `v0.10.0`
- Base: `v0.9.8`
- Source: `xonsh-repl` (`e4ff354a1`)
- Preservation: Protect staged `pkgbuild/PKGBUILD` and untracked artifacts by executing in an isolated worktree.

## Current Phase

Phase 2: Prepare isolated worktree and initiate rebase.

## Phases

### Phase 1: Divergence Analysis and Graph Inspection
- [x] Query latest stable release via GitHub CLI and git tags (`v0.10.0`).
- [x] Inspect graph ancestry and metrics (`v0.9.8` merge base, 37 local commits, 161 upstream commits).
- [x] Catalog overlapping files (53 paths).
- [x] Generate JSON-LD divergence graph at `.planning/2026-10-10-rebase-xonsh-repl-v0.10.0/divergences.jsonld`.
- **Status:** complete

### Phase 2: Isolated Worktree Setup
- [ ] Create isolated branch `xonsh-repl-v0.10.0-rebase` from `xonsh-repl`.
- [ ] Create isolated worktree `.worktrees/xonsh-repl-v0.10.0-rebase`.
- [ ] Confirm original worktree status remains intact.
- **Status:** in_progress

### Phase 3: Rebase and Conflict Reconciliation
- [ ] Execute `git rebase v0.10.0` in the isolated worktree.
- [ ] Systematically reconcile conflicts across REPL manager, session lifecycle, UI cell components, and scripts.
- [ ] Preserve intentional fork features (xonsh REPL, zsh skill, context7 module).
- **Status:** pending

### Phase 4: Validation and Quality Gates
- [ ] Sync dependencies and lockfile if required.
- [ ] Run `TEST_POLICY_BASE=v0.10.0 npm run check` in the isolated worktree.
- [ ] Fix all errors, warnings, and linter issues.
- **Status:** pending

### Phase 5: Adoption and Cleanup
- [ ] Fast-forward / adopt rebased commit onto `xonsh-repl` in main worktree (`git reset --keep`).
- [ ] Verify staged and untracked files in main worktree remain intact.
- [ ] Clean up auxiliary worktree and branch.
- **Status:** pending
