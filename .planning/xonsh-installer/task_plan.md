# Xonsh installer port

## Goal
Add a rigorous, executable Xonsh port of `install.sh` without changing the release-facing POSIX installer.

## Status distinctions
- Implemented: partial. Tracked `scripts/install.xsh` contains the native state, security, extraction, rollback, and Node backends; native install orchestration and final PATH parity remain open.
- Tested: partial. Sixteen focused offline tests pass. A seventeenth intentional RED test defines the missing `Installer.install_native()` behavior.
- Reproducible: yes for the focused behavior covered by `scripts/install-xsh.test.xsh`; the final 115-function parity review and repository check remain open.
- Tracked: `scripts/install.xsh` is tracked and modified. `scripts/install-xsh.test.xsh` and `.planning/` remain intentionally untracked during development.
- Committed: no commit has been made for the current port work.
- Released: no. `install.sh` remains the sole release-facing installer and is unchanged.

## Phases
- [x] Inspect installer, release surfaces, tooling, and Xonsh guidance.
- [x] Establish the additive tracked port at `scripts/install.xsh` without changing release publishing.
- [x] Record the GLM-5.3 pre-correction review and owner corrections.
- [x] Add the reproducible focused harness at `scripts/install-xsh.test.xsh`.
- [x] Implement and validate native state, security, extraction, recovery, rollback, and public-link subsystems.
- [ ] Implement `Installer.install_native()` and restore the 17-test suite to GREEN.
- [ ] Complete native PATH behavior and remaining Node regressions.
- [ ] Produce the 115-function parity artifact.
- [ ] Run `xonsh check scripts/install.xsh` and the full repository `npm run check`.
- [ ] Review diff/status including untracked files and report the final result.

## Next actions
1. Implement the native install transaction defined by `test_install_native_from_offline_release_feed`.
2. Complete native PATH behavior and targeted Node regressions.
3. Map all 115 current shell function definitions to Xonsh counterparts or explicit non-applicable decisions.
4. Run the focused suite, `xonsh check scripts/install.xsh`, and the repository-wide, mutating `npm run check`; inspect repository status after the check.
5. Capture `git status --porcelain`, `git diff --stat`, and `git ls-files --others --exclude-standard` so the final review includes untracked work.
6. Decide and record the commit disposition while preserving unrelated user changes.

## Open work
- One intentional RED focused test for `Installer.install_native()`.
- Native PATH parity and remaining Node regressions.
- The 115-function parity artifact.
- `npm run check` and final status review.

## Review history
- First review (GLM-5.3, pre-correction `FULL-ARTIFACT` rollup): its F1-F6 (ghost bibliography apparatus, base-URL override wording, overstated validation summary, uncited external claims, implementation-status wording, mixed evidence/action table plus the 950-vs-949 line drift) are historical and fixed. The owner moved the rollup to `PROCESS`/`TODO` via its `:process:` filetag and removed the bibliography apparatus; F4 was moot under the new profile. The 949-line count is corrected here.
- Second review (strict, read-only process/documentation): F1/F2 medium evidence gaps, F3-F6 low process/documentation gaps, F7-F8 informational notes, recorded under Findings. The review was supplied read-only; the owner authorized incorporating it into the planning documents and the rollup as open actions, with no implementation edits.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| REPL BashResult misuse | 1 | Used `.output` field rather than calling it. |
| Xonsh parsed generator variable `part` as a command | 1 | Replaced generator expression with explicit version components. |
| Xonsh rejected annotated instance assignment | 1 | Removed the instance attribute annotation; retained valid type annotations elsewhere. |
| Bulk platform edit matched duplicate euid text | 1 | Inspected exact occurrences and applied targeted edits. |
