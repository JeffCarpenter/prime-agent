# Progress

## Current port session (2026-09-16)

- Confirmed the current source installer is 2,356 lines with 115 function definitions and that the additive target is tracked `scripts/install.xsh`.
- Reworked ordinary command execution around Xonsh 0.24.2 pipeline semantics. Captured and inherited commands use native Xonsh operators and structured arguments; supervised `Popen` use is limited to cancellation, timeouts, quiet output, and explicit working directories.
- Added a reproducible offline harness at `scripts/install-xsh.test.xsh` for URL policy, platform selection, managed-root safety, archive policy, activation, recovery, rollback, public-link ownership, extraction metadata, and backend dispatch.
- Reached 16 passing focused tests and a clean `xonsh check scripts/install.xsh` before starting native orchestration.
- Recorded the current intentional RED: `test_install_native_from_offline_release_feed` fails only because `Installer.install_native()` is not implemented. The test covers compiled activation, automatic Node-only fallback, and binary-mode rejection.
- Preserved `install.sh` and all release workflows unchanged. The Xonsh port is not release-facing.
- Remaining acceptance work: implement native orchestration and PATH handling, restore all focused tests to GREEN, review Node regressions, run Xonsh and repository checks, and complete the 115-function parity review.

## Historical progress

- Inspected repository status and all relevant installer/release references.
- Delegated an independent design review; reviewer confirmed additive `install.xsh` and parity requirements.
- Implemented 949-line `install.xsh` with release resolution, preflight, Node installation paths, checksum verification, npm policy, PATH configuration, prompts, splash rendering, and cleanup.
- Verified `xonsh --no-rc -n install.xsh`, `python -m py_compile install.xsh`, pure version checks, render width cases, and fake noninteractive end-to-end install.
- Fixed Xonsh parser/compiler incompatibilities discovered during validation.

- Revalidated Xonsh parse, CPython compile, Ruff, the original shell installer checker, and the fake end-to-end install after platform and lint fixes.
- Added portable `platform.system()`/`platform.machine()` and effective-UID helpers.

- Reviewed all Python methods against the shell function inventory and inspected parity-critical shell segments.
- Added standalone Node resolution status output, portable platform helpers, CLI-level expected failure reporting, and simplified preflight output reading.
- Ruff now passes; final focused validation and `npm run check` remain.

- Created `.planning/active_plan` with the active plan directory `.planning/xonsh-installer` at the user’s request.
- Final validation is intentionally paused; focused behavior checks, `npm run check`, and final diff/status review remain.

- GLM-5.3 reviewed the pre-correction `FULL-ARTIFACT` rollup and reported findings F1-F6. The owner subsequently corrected the rollup to the `PROCESS`/`TODO` profile via its `:process:` filetag, removed the ghost bibliography apparatus, fixed the base-URL contradiction, narrowed the validation summary, corrected implementation-status wording, and split the status table. F4 remains conditional and moot under `PROCESS`/`TODO`; no implementation changes were requested.
- The line-count drift identified by F6 is corrected here: `install.xsh` is 949 lines. Focused behavioral checks, `npm run check`, and final diff/status review remain open.

- Preparing a second independent engineering-process/documentation review of the planning documents; review scope excludes implementation and rollup edits.
- The second strict process/documentation review reported F1/F2 medium evidence gaps (unreproducible behavioral validation; no parity matrix), F3-F6 low process/documentation gaps (checker scope, unrelated-work wording, untracked-file diff procedure, commit/no-commit disposition), and F7-F8 informational notes. The review was read-only and changed no implementation or rollup files.
- Before updating these planning documents, verified: branch `stable-prime`; `install.xsh` 949 lines and untracked; `install.sh` unchanged (1,641 lines); unrelated modifications in `package.json` (+1) and `pnpm-lock.yaml` (28 lines); `.planning/` untracked; `npm run check` includes `biome check --write --error-on-warnings .`.
- Recorded the review in `findings.md`, corrected the unrelated-work wording to separate tracked modifications from untracked additions, and converted F1-F8 into concrete open next actions in `task_plan.md`. The prior GLM-5.3 F1-F6 remain marked historical and fixed; the rollup is `PROCESS`/`TODO` with no bibliography apparatus.
- Still open: focused behavioral validation, reproducible harness/evidence, parity artifact, `npm run check`, and the final diff/status review including untracked files.
