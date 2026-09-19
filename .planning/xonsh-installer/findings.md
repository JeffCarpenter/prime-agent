# Findings

## Current findings (2026-09-16)

### Scope and release boundary

- The live `install.sh` is 2,356 lines with 115 function definitions. It remains the public installer and the input to release publishing.
- The additive port is tracked as `scripts/install.xsh`. Release workflows do not publish it, and this work does not change `install.sh`.
- The focused offline harness is `scripts/install-xsh.test.xsh`. It is intentionally untracked during development.

### Execution model

- Xonsh `CommandPipeline` objects carry process status and output. Their truth value reports exit-code success, iteration consumes output lazily, and `.returncode`, `.rtn`, or `.out` forms an explicit synchronization point.
- Ordinary commands should therefore use Xonsh subprocess syntax: `!()` for captured pipelines, `![]` for inherited terminal streams, and `@()` for structured argument expansion. Paths should use `p""` or `pf""` where Xonsh syntax improves clarity.
- Python `subprocess.Popen` remains justified for lifecycle control that ordinary pipelines do not provide cleanly: process-group cancellation, bounded executable probes, quiet animation capture, and explicit working directories.
- A small result adapter may normalize native and supervised execution, but it must preserve exit-status truthiness rather than reduce pipelines to text prematurely.

### Native installation model

- The compiled installer behaves like a small transactional package manager, not a download-and-copy script. Its invariants include root ownership, exclusive locking, isolated staging, immutable release directories, atomic launcher changes, durable activation intent, rollback, recovery, and conservative pruning.
- The trust chain is cumulative: HTTPS policy, redirect restrictions, exact manifest selection, SHA-256 verification, safe archive inspection, required assets, package metadata, executable probes, and atomic activation all protect one transition. Later checks do not compensate for a weakened earlier check.
- Public command ownership is separate from managed release ownership. The installer may create or preserve its own symlink, but it must reject regular files and foreign links.
- Auto fallback to Node is narrow. A valid Node-only release or an incompatible compiled executable may fall back; checksum, archive, metadata, and explicit `binary` failures must not.

### Testing and parity

- Temporary release feeds, generated archives, fake manifests, and small executable fixtures cover most of the native lifecycle without network access or credentials.
- The focused suite now has 17 tests. Sixteen pass; the intentional RED test requires `Installer.install_native()` to activate a valid offline release, use Node for a Node-only release in `auto` mode, and reject that release in `binary` mode.
- The main remaining risk is omission rather than local correctness. Final acceptance requires a function-by-function review against all 115 `install.sh` definitions, followed by the focused suite, `xonsh check scripts/install.xsh`, and the repository-wide `npm run check`.
- Status reports must keep implemented, tested, reproducible, tracked, committed, and released distinct.

## Historical baseline and reviews

The notes below describe earlier repository revisions and review checkpoints. Current paths, counts, and validation status are authoritative above.

- `install.sh` is the live 1,641-line POSIX installer used by release publishing and docs.
- No Xonsh dependency is declared in the repository. Installed Xonsh is 0.24.2.
- Additive root `install.xsh` is the safe target.
- Context7 `/xonsh/xonsh` documents `#!/usr/bin/env xonsh`, Python statements, structured subprocess arguments, and scoped environment handling.
- Context7 `/jquast/wcwidth` documents `wcswidth` for Unicode terminal display widths; the port uses it with a fallback.
- The port uses Python subprocess APIs with argument lists because commands are dynamic and must not use shell interpolation.

- Shell parity review found the Xonsh method inventory covers all 83 shell functions.
- The POSIX installer remains unchanged (1,641 lines). Unrelated pre-existing work in the tree splits into tracked modifications (`package.json` +1, `pnpm-lock.yaml` 28 lines changed) and untracked additions (`.planning/`); the port itself is the untracked `install.xsh`. Disposition of each group is recorded as open work in `task_plan.md`.
- CLI catches expected filesystem, subprocess, parsing, and runtime errors and reports `error:` instead of exposing a traceback.

## GLM-5.3 review and owner corrections

- GLM-5.3 reviewed the pre-correction `FULL-ARTIFACT` `PLAN-ROLLUP.org`. It found six issues: ghost bibliography apparatus (F1), the base-URL override contradiction (F2), an overstated validation summary (F3), uncited external claims about Xonsh and `wcswidth` (F4), overstated implementation completeness while `install.xsh` was uncommitted (F5), and a mixed evidence/action table plus the 950-versus-949 line-count drift (F6).
- The owner corrected the rollup profile to `PROCESS`/`TODO` via its `:process:` filetag, removed the bibliography apparatus (F1), fixed the base-URL wording (F2), narrowed the validation summary (F3), softened implementation status (F5), and split the status table (F6).
- F4 is moot under the `PROCESS`/`TODO` profile unless external claims are later cited. No implementation changes were requested. Focused behavioral checks, `npm run check`, and final diff/status review remain open.


## Strict process/documentation review (second review, read-only)

- F1 (medium, evidence gap): Behavioral validation is not reproducible. The Xonsh parse, CPython compile, Ruff, checker, and fake noninteractive end-to-end install exist only as prose in `progress.md`; no rerunnable harness or persisted evidence artifact lets a third party re-execute them.
- F2 (medium, evidence gap): No parity artifact. The all-83-shell-functions parity conclusion is asserted in notes only; no persisted matrix maps each shell function to its Xonsh counterpart.
- F3 (low, process/documentation): Checker scope is undocumented. `npm run check` runs `biome check --write --error-on-warnings .` (a mutating, repository-wide pass) plus `tsgo --noEmit`, `check:installer`, and `check:browser-smoke`; the plan does not state how that interacts with the untracked `install.xsh` and unrelated tracked modifications.
- F4 (low, documentation): Unrelated-work notes previously lumped tracked modifications and untracked additions together; wording corrected above and disposition left as an open action.
- F5 (low, process): The final diff review procedure omits untracked files, which plain `git diff` does not show.
- F6 (low, process): No recorded commit/no-commit disposition for `install.xsh` and `.planning/`, nor an explicit statement that nothing is released while `install.sh` stays the sole release-facing installer.
- F7 (informational): Status claims must keep implemented, tested, reproducible, committed, and released distinct (see `task_plan.md` Status distinctions).
- F8 (informational): The first GLM-5.3 review (its F1-F6) is historical and fixed; the rollup is now `PROCESS`/`TODO` with no bibliography apparatus, so no rollup action is open.

Verified state at review incorporation: branch `stable-prime`; `install.xsh` 949 lines, untracked; `install.sh` unchanged; unrelated `package.json`/`pnpm-lock.yaml` modifications present; `.planning/` untracked.

## Owner verification (post-review session observations)

- Process-execution research (GPT-5.6 Luna, against Xonsh main docs and 0.24.2): the generic Python `subprocess.run` wrapper stays. Xonsh `$()` captures stdout only and raises on failure; `!()` is nonblocking/detached unless `@unthread`; `![]`/`$[]` stream the raw terminal and bypass `contextlib.redirect`, breaking animation capture; `xonsh.api.subprocess.run/check_output` lack env/stdin/stderr control; operator forms use `XSH.env`, not the installer's scoped `self.env`. Narrow safe use (`$( @(args) )`) exists for fixed, noninteractive, stdout-only probes, but is not worth replacing the wrapper. `$COMMAND` interpolation, `@$(...)` output splitting, and `shell=True` remain unsafe for dynamic data.
- Verified directly on 2026-09-10 (Xonsh 0.24.2): `printf 'print(1+1)\n' | xonsh --no-rc` executes piped stdin (exit 0, prints `2`), while an explicit `-` argument fails (`xonsh: -: No such file.`, exit 1). A `curl ... | xonsh` distribution pattern would therefore behave like `curl | sh`, but any future documentation must not use `xonsh -`. The current invocation contract stays `xonsh --no-rc install.xsh [stable|beta|version]`.
- Re-verified `package.json`: `check` = `biome check --write --error-on-warnings . && tsgo --noEmit && pnpm run check:installer && pnpm run check:browser-smoke`, matching F3 above. The first stage mutates the repository; run the project check only with the unrelated tracked `package.json`/`pnpm-lock.yaml` changes in mind and re-check `git status` afterward.
