# Windows Release Packaging Plan

## Goal
Provide Windows-focused scripts that emit both the standalone Windows x64 ZIP and the complete four-package Prime Agent release set without disturbing unrelated platform artifacts or the user’s pnpm work.

## Phases
- [x] Survey existing binary and package release workflows.
- [x] Define the combined Windows release interface.
- [x] Replace the thin binary wrapper with a pnpm-safe, Windows-only implementation.
- [x] Validate script behavior and build both artifact sets.
- [x] Independently ratify the final packaging change.
- [x] Implement and validate a PowerShell 7 `install.ps1` for generated release archives.
- [x] Integrate `install.ps1` into release publication (workflow gap identified; follow‑up to add `replaceAll` step mirroring `install.sh` render).
- [ ] Independently ratify the installer and close the plan.

## Constraints
- Preserve pre-existing `package.json`, `pnpm-lock.yaml`, `.planning/`, and `install.xsh` changes.
- Treat local source as authoritative over DeepWiki summaries.
- Keep release output below `packages/coding-agent/release/`.
- Do not delete non-Windows binary artifacts.

## Errors Encountered
- A nested-quote `rg` command failed before search execution. Resolution: use Python scanning rather than retrying the same shell construction.
- First combined build used stale asset paths. Resolution: aligned archive assembly exactly with current `build-binaries.sh` outputs.
- Second combined build passed a literal `--` through pnpm. Resolution: invoke `pnpm run release:pack` without npm’s separator.
- Third combined build found pnpm 12 rejects a positional pack directory. Resolution: use `pnpm --dir <staging> pack`.

## Next Step
Extend the release publication workflow to also render `install.ps1` (mirror the existing `replaceAll` step for `install.sh`), then close the plan.
