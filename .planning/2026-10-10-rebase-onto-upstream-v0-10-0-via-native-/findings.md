# Findings: Native Rust Port Reconciliation onto upstream v0.10.0

## Evidence Index

| Evidence | Recorded observation / limit |
|----------|------------------------------|
| `.planning/native-rust-port-reconciliation-plan.yaml`; `progress.md` (2026-10-10) | Upstream `v0.10.0`: commit `763094e1b6a7c17450ee8399b06cda1853847ca5`, tag `8de18adda5d6fdea3dc31843d5955d311c92cb9e`; references `xonsh-repl@e4ff354a184f22af3ba78ef0963018472f17af96` and `xonsh-rust@e718d2faa`. Target: `.worktrees/feat-native-rust-xonsh`, branch `feat/native-rust-xonsh`. |
| `progress.md` (2026-10-10) | Native `crates/` replaces former TS `packages/` target; Python sidecar remains `prime-agent-runtime/`. Baseline `cargo check --workspace` exited 0; sidecar pytest passed 144. |
| `native-preflight-inputs.json`; `task_plan.md` Phase 3 | Native HEAD `2da0c33edc52db1d767b08537f6db8b75778f1c6` includes xonsh tool, execution-mode wiring, preview. Separate-kernel requirement and current `pa-core` tests remain unverified. |
| `native-preflight-inputs.json` | SHA-256 and sizes: five modified native `crates/pa-tui/` files, five untracked `skills/zsh/` files, modified main TS `pkgbuild/PKGBUILD`, untracked main `.SRCINFO`. Twelve protected inputs; recheck before copy/build. |
| 2026-10-11 read-only preflight, recorded in `progress.md` | Native tree lacks `pkgbuild/PKGBUILD` and `scripts/install.xsh`; do not infer completed recipe or installer. Main TS recipe and old packages are not native evidence. |
| Native Homebrew formula and `scripts/release/assemble_artifacts.py`, as inspected in 2026-10-11 preflight | Described native payload: `prime-agent`, `prime-agent-runtime/`, `skills/`, `LICENSE`, `README.md`, `models.bundled.json`, `mcp-services.bundled.json`. This is a recipe description, not a built artifact. |
| Native `scripts/release/bundle_catalog.py`, as inspected in 2026-10-11 preflight | Both catalog JSONs are generated, not present in source; `--fixture` is synthetic. No catalog checkout found in bounded candidate paths; another trusted local or network source remains possible. |
| `progress.md` (2026-10-11 preflight); `native-preflight-inputs.json` | At preflight, no native test/build/package had run. Later isolated test results appear below. Historical TS makepkg failure cannot establish native status. |
| `/home/jeff/code/skills/incubator/scratchpad.yaml` | User approved isolated tests/package build, not system installation or source repair; historical checksum-verified handoff remains a snapshot. |
| `.worktrees/rebase-2a16de906` (discovered 2026-10-11) | Orphaned fifth worktree detached at `2a16de906` ("restore continuous background trace uploads (#3415)"); unreferenced in active plan; slated for pruning. |

## Isolated rebase validation (2026-10-11)

- `validation-run.json` records a detached copy of native HEAD `2da0c33ed` with all ten native dirty inputs copied byte-for-byte. It records the twelve protected hashes from `native-preflight-inputs.json`. The original native and main package files were not edited.
- Native `cargo test -p pa-core --locked` exited **101**: 1,159 passed, three failed, three ignored (`logs/pa-core-test-20261011.log`). Clean upstream `763094e1b` under the same host/toolchain exited **101**: 1,158 passed, two failed, three ignored (`logs/upstream-pa-core-test-20261011.log`). The telemetry endpoint assertion and Bash golden commit-hash assertion failed in **both** trees, so these failures alone do not establish a port regression. The Bash golden expects `e33214d`, whereas this host produced `32200ad`; the cause of that hash difference is not established here.
- The third native failure, `concurrent_producers_drop_at_the_reserve_when_the_queue_is_full`, failed in the full suite and an isolated rerun (`logs/pa-core-timing-isolated.log`). A later isolated native rerun passed (`logs/native-pa-core-timing-retry.log`). The upstream full suite and isolated run passed (`logs/upstream-pa-core-timing-isolated.log`). This shows unstable behavior on the native run; it does **not** yet identify a xonsh change or prove upstream immunity.
- Native `cargo fmt --all --check` exited **1**, reporting diffs only in `crates/pa-core/src/lib.rs` and `crates/pa-core/src/tools/xonsh.rs` (`logs/native-cargo-fmt-check.log`). No auto-format or source repair was done.
- Read-only Phase 4 audit and spot-check: `crates/pa-tui/src/tool_card/mod.rs:128,336` routes `xonsh` cards into the IPython card renderer, while `tool_card/ipython.rs:193,414-421` still selects IPython preview/Python highlighting. The TUI's `CodePreview::xonsh` constructor is present at `code_preview/bash.rs:228-233`, but the audited render path does not call it. No xonsh-specific card test was found in `tool_card/ipython/tests.rs`; `cargo test -p pa-tui --locked` is **running**, not passed. The five TUI files and five `skills/zsh/` inputs remain uncommitted.
- User authorization: user has confirmed that upstream releases ALWAYS enter the fork; retiring the ghost TypeScript stack is approved upon parity verification. PKGBUILD realignment to native Rust (`cargo build --release -p pa-cli`) and offline catalog handling is explicitly approved (Phase 5 p5-t1). Pruning redundant `.planning/bin/*.xsh` scripts is approved ("that's what git is for"). Authoritative workspace version is established as upstream `0.10.0`. System installation remains excluded.

Current decisions, authority, unresolved gates and next actions: `native-status.yaml`. Commands, exits and raw logs: `validation-run.json` and `logs/`.

## Release-lineage and pre-xonsh scope (verified 2026-10-11)

- The standing VCS flow is **upstream into this fork at every release**, then fork-specific work is carried forward. Do not infer an unrelated product lineage from the absence of a merge base on one re-rooted branch. `origin` is `JeffCarpenter/prime-agent`; `upstream` is `PrimeIntellect-ai/prime-agent`. `xonsh-repl` and upstream `v0.10.0` share upstream `v0.9.8@7d442aafa` as a merge base.
- On `xonsh-rust`, the observed six-commit pre-xonsh slice is `5ac9d06508c3597e961a10569a563d2c0a2c5834..b511c66fbb35e2b8007f1e403983b322e4f11c8b` (inclusive first `4bfc4a4fbe2c39929fb6fd02b5d860c4253e4a58`, last `b511c66fbb35e2b8007f1e403983b322e4f11c8b`). It covers pnpm tooling, Windows builds/installation, dotenv, and `install.xsh`; the preceding `5ac9d0650` scaffolds Cargo on that branch. This slice is **not proof of the complete fork-specific change set** across releases.
- User's intended equivalent-scope order is to reconcile **our pre-xonsh work onto upstream Rust 0.10.x first**, and only then port our xonsh integration. Discussion has clarified this order, but no implementation of the pre-xonsh reconciliation is verified. `feat/native-rust-xonsh@2da0c33ed` currently has only two xonsh-specific commits above upstream `v0.10.0@763094e1b`; five TUI files and `skills/zsh/` are dirty. An xonsh-only port cannot establish that prior fork behavior survived.
- The initial `pa-tui` log ended without a recorded exit. A fresh isolated rerun writes `logs/native-pa-tui-test-resume-20261011.log`; until its process returns with an exit code, do not claim a pass or failure. Existing core and formatting failures remain open.

## Ref history check (2026-10-11, current session)
- Read-only local ref inventory: 774 branch/remote-tracking/tag refs; `git for-each-ref --contains b511c66fb` finds only local `xonsh-rust` and `origin/xonsh-rust`, whereas `--contains 39bc99a91` finds 152 Rust-era refs and `--contains v0.10.0^{}` finds 41. Their pre-xonsh-tip/Rust intersections are empty. This proves no available ref contains that *exact* six-commit tip as an ancestor of the Rust migration; it does not rule out a replay/squash or other earlier fork work. Next: examine alternate stable-prime/installer refs and patch-equivalent histories before a broader conclusion.

- Ref search correction: `xonsh-repl@e4ff354a1` is the useful pre-port reconciled fork ref. Its merge-base with `v0.10.0` is precisely `v0.9.8@7d442aafa`, which is **the sole parent** of upstream Rust port `39bc99a91`; its first six commits (`eb8c04188..06bdcf1cb`) precede its first xonsh research/implementation and carry pnpm, Windows release/installer, dotenv, and `install.xsh`. `git range-diff 5ac9d0650..b511c66fb v0.9.8..06bdcf1cb` matches five changes exactly; the initial pnpm commit differs because it added a TS scaffold on the re-rooted branch but modifies an existing TS tree on v0.9.8. That first commit still needs behavior-level review, not an equivalence claim. `git blame -L 1,36 06bdcf1cb -- scripts/install.xsh` attributes the pre-port xonsh installer to Jeff C. `xonsh-and-regi` descends from the same six-commit prefix but adds 19 side commits relative to `xonsh-repl`; it is not a cleaner pre-xonsh boundary. No branch/tag points exactly at `06bdcf1cb`; no inspected ref descends from both `06bdcf1cb` and Rust-port `39bc99a91`. Preferred historical baseline: `v0.9.8..06bdcf1cb` for pre-xonsh fork behaviors; compare semantically against Rust v0.10.0 before source edits.

## Transition-plan correction (2026-10-11)

- Graph + `git range-diff` establish `v0.9.8..06bdcf1cb` as a verified six-commit pre-xonsh prefix on `xonsh-repl`, **not** an inventory of every earlier fork change across releases. The first pnpm commit does not patch-match the re-rooted counterpart; evaluate behavior, not commit IDs. Upstream Rust port `39bc99a91` descends directly from `v0.9.8`, so the two branches diverge there.
- Current user clarification supersedes the earlier dated authority note: a request to rebase/reconcile includes necessary scoped source and test repairs. Preserve existing dirty inputs and use isolation; no implicit system-installation, destructive overwrite, or unrelated scope expansion.
- Prepend Phase 0: reconstruct full fork/upstream release lineage, classify capability parity against native v0.10.0, validate baselines and protected hashes, then decide integration order before xonsh and Arch packaging.

## Phase 0, step 1: release-lineage inventory (in progress, 2026-10-11)

- `git log --graph` places local `stable-prime` on upstream `v0.9.5`, `xonsh-installer-port` and `xonsh-repl-pre-v0.9.8-rebase` on `v0.9.6`, and `xonsh-repl` on `v0.9.8` (the direct parent of Rust-port `39bc99a91`). These are release-by-release replays, not independent feature sets.
- Six pre-xonsh commits occur on the local v0.9.5 `stable-prime` line (`091bd72a7..987effdd8`), the v0.9.6 `xonsh-installer-port` prefix (`7bb7584cd..8709d1ac5`), and the v0.9.8 `xonsh-repl` prefix (`eb8c04188..06bdcf1cb`). They cover pnpm tooling, Windows release/installer, dotenv dependency, and the original `install.xsh`. `origin/stable-prime` is a separate five-commit variant from v0.9.5; remote-tracking refs are snapshots, not proof of current remote heads.
- Most origin/upstream branch names are unrelated active feature lines. Scope the pre-xonsh ledger by ancestor and commit order rather than asserting every fork remote ref belongs to this release-migration history. Next check range-diff across replay points, authorship, and excluded refs before marking inventory complete.

- Cross-release `git range-diff`: v0.9.5→v0.9.6 replays all six in order (first two context-changed, final four exact), and v0.9.6→v0.9.8 likewise replays all six (four exact, first two context-changed). The independent `xonsh-rust` re-root is only patch-equal on five because its first pnpm commit creates a TS scaffold. `git cherry -v v0.9.8 06bdcf1cb` marks all six `+` (no exact patch equivalent on upstream v0.9.8); this does not prove upstream v0.10.0 lacks native equivalent behavior.
- Targeted `git blame` at v0.9.8 fork prefix attributes `install.ps1:1-16` to `2f8c890b6`/Jeff C, `pnpm-workspace.yaml:1-16` to `fd74dfdd1`/Jeff C, `package.json:47` dotenv to `f3e865f03`/Jeff C, and `scripts/install.xsh:1-36` to `06bdcf1cb`/Jeff C. Installer text names Node/npm release archives, so native semantics are not inferred from its presence.
- Separate legacy `origin/main@af263b3f7` and v0.9.8 share only `a9b5d88b` (2026-08-24); it is not an ancestor of the release replay or native branch. Its 322 commits after that split contain 63 authored by Jeff C, plus many other authors. `git cherry -v v0.9.8 origin/main a9b5d88b` marks all 322 `+` as non-identical patches; neither author nor patch-ID proves product ownership or missing native behavior. Preserve this line as a *candidate pool* for later behavior triage; do not silently equate it with the six release-replay commits. `arbitrary-model-loading` adds one commit after `xonsh-repl`, hence is post-xonsh, not a pre-xonsh prefix.

### Step 1 artifact and limits

- Canonical machine-readable map: `pre-port-lineage.json` (pinned release/tag/branch SHAs; six-commit lists for three replay bases; `range-diff` pairs; older `origin/main` 322-commit author/subject inventory; targeted blame; explicit unknowns). This **completes ref-level provenance inventory**, not behavioral equivalence or feature-scope approval for every historical commit.
- Tag `v0.9.7` is on the upstream spine but no distinct six-commit replay ref was found for it in the named fork lineage. `origin/main` is a divergent older candidate line, not an ancestor of the v0.9.8 fork prefix or Rust target. Its 63 Jeff-authored commits are candidates only; authorship and 322 nonmatching patch IDs do not identify all required features. Steps 2–4 are laid out in `task_plan.md` and remain unexecuted.

## Assimilated historical rebase knowledge & divergence taxonomy

- **Architectural Decision Record (ADR):** Evaluated 3 paths following upstream commit `39bc99a91` (PR #2524, deleting 1,181 TypeScript files across `packages/*` and `package.json`):
  1. *Dual-stack coexistence:* Retain `packages/` alongside `crates/`. Rejected / obsolete: creates dead TS maintenance burden and broke upstream release-by-release replay.
  2. *Native Rust port:* Port xonsh REPL and dual-kernel manager directly into `crates/pa-core` and `crates/pa-tui`, retaining Python runtime in `prime-agent-runtime/`. Accepted as active plan.
  3. *Non-TypeScript replay only:* Apply Python runtime, zsh skill, and scripts without native Rust tool. Rejected: fails to provide xonsh capability to native agent.
- **Fork Commit Tier Taxonomy (37 commits on `v0.9.8..xonsh-repl`):**
  - **28 TypeScript commits:** `packages/coding-agent` (REPL manager, session lifecycle, TUI cell display, xonsh tool definition, regression tests).
  - **4 Python sidecar commits:** `prime-agent-runtime/src/rlm/repl.py` (execution dispatcher and syntax handling), `repl.md`, `test_repl.py`.
  - **3 skill commits:** `skills/zsh` package and `pyproject.toml`.
  - **2 packaging/installer commits:** `scripts/install.xsh` and Arch Linux `pkgbuild/PKGBUILD`.
- **53 Overlapping Files Collision Surface:** Complete list mapped across 5 functional domains in canonical graph `divergences.jsonld`:
  - *Architecture / Monorepo Foundation (Critical):* Root `package.json`, `package-lock.json`, `packages/*/package.json`.
  - *Kernel & REPL Management (High):* `repl-manager.ts`, `bootstrap.ts`, `shared.ts`, `agent-session.ts`, `agent-session-services.ts`, `sdk.ts`, `prime-agent-runtime/src/rlm/repl.py`.
  - *Python Runtime (High):* `repl.py`, `repl.md`, `test_repl.py`.
  - *Interactive TUI & Cell Components (Medium):* `interactive-mode.ts`, `ipython-cell.ts`, `conversation-components.ts`, `tool-execution.ts`, `theme.ts`.
  - *Packaging & Build Scripts (Medium):* `pnpm-lock.yaml`, `pkgbuild/PKGBUILD`, `scripts/install.xsh`, `install.ps1`.
- **Seed Provenance & Conflict Resolutions on Scaffolding:**
  - Upstream seed commit `5ac9d0650~1` (`dc63427ad625`, Kevin Thomas, 0 parents, roots `upstream/kevin-migration-catchup` and `upstream/lane/catalog-build`) contained only `MISSION.md`, `README.md`, and `WATCHDOG.md`. Seed rebase completed at commit `dcede5618` (`xonsh-rust-seed-rebase`).
  - Cargo scaffolding commit `5ac9d0650` (19 workspace files). Rebase resolved `.gitignore` add/add conflict at `130b21d19` and content conflict at `222db5ff9`, completing at pre-commit tip `a557dd678` and final coexistence tip `e718d2faa`.

## Kernel Architecture: Single-Kernel Execution-Mode Switching vs Upstream Phrasing

- **Terminology Reconciliation:** Upstream's planning and module nomenclature frequently refer to "dual-kernel management" or "managing xonsh beside ipython". This terminology contributes to confusion.
- **Architectural Reality:** As verified in `crates/pa-core/src/tools/xonsh.rs` and `prime-agent-runtime/src/rlm/repl.py`, the system operates a **single persistent Python kernel sidecar**. Execution modes are dispatched through the protocol via `mode: Some("xonsh")`, which routes to an internal `xonsh.execer.Execer` in the Python sidecar, rather than spawning or managing separate daemon processes. Planning and verification must treat this as mode dispatching, not separate-kernel provisioning.

## Kernel Bootstrap Vulnerability (Identified in MCP-LS Audit)

- **The Gap:** Compiler-grade inspection recorded in `kernel-mcpls-audit.json:85-94` revealed that `crates/pa-core/src/kernel/bootstrap/venv.rs` installs twelve default packages into the agent's runtime virtual environment, but **`xonsh` is completely omitted**.
- **Silent Runtime Failure:** `crates/pa-core/src/kernel/bootstrap/venv/probe.rs` does not check for `xonsh`, and `prime-agent-runtime/src/rlm/repl.py:42-51` imports `xonsh` as an optional dependency. In a clean environment where Python does not have system-wide xonsh, any xonsh tool execution immediately fails with `RuntimeError`.
- **Required Action:** Add `xonsh` to `crates/pa-core/src/kernel/bootstrap/venv.rs` default package list, verify probe inclusion, and add a clean-room bootstrap regression test.

## Phase 0 source-level parity and preservation recheck (2026-10-11; current session)

- Evidence: `pre-port-capability-ledger.json` (six release-replay commits and separate `origin/main` candidate queue), `phase0-baseline-20261011.json` (current refs, complete protected-hash check, native status), and `pre-port-lineage.json` (provenance and complete older pool). Local `git merge-base v0.10.0 2da0c33ed` resolved to `763094e1b`; precisely two native commits are above upstream (`33489b01b`, `2da0c33ed`). The main checkout is at `b2c25d98`; original native remains at `2da0c33ed`. All twelve protected file SHA-256 values still match the previous snapshot; no protected source or existing package changed.
- The three pnpm/lockfile commits are TS-build mechanisms approved for retirement; do not replay them onto Cargo. The old Windows installer/build commit has analogous Rust release workflow, `install.ps1`, `install-rust.sh`, and `scripts/release/test_windows_install.ps1` present in upstream; these checked files are byte-identical on native, but no Windows release artifact or e2e was run here. The old dotenv commit adds a TS dependency only; native Python bootstrap installs `python-dotenv`, which does **not** prove a Rust `.env` loading requirement or parity. The 949-line `scripts/install.xsh` is Node/npm-oriented; native published installer routes exist, but whether xonsh-specific installer UX remains required needs a product decision. None of these source-level classifications proves a working Arch package.
- The distinct older `origin/main` history has 322 candidates; 63 are Jeff-authored, not necessarily 63 owned requirements. Seven high-impact subjects are indexed for later behavior and test review; all remain **unassessed**, not selected for port. The other 315 are likewise not silently assumed absent or equivalent. Source map is incomplete until relevant candidates and requirement decisions are resolved.
- The prior `logs/native-pa-tui-test-resume-20261011.log` contains compiler warnings but no `test result:` marker and no captured exit. `validation-run.json` documents shared upstream pa-core failures and a native timing failure that later passed; do not classify the timing issue as a proven port regression. Next gate: obtain pa-tui exit from the isolated copy, not from the original native worktree.

## Captured isolated TUI run (2026-10-12)

- `native-pa-tui-phase0-20261012-attempt2.json` records `cargo test -p pa-tui --locked`, source `2da0c33ed` plus byte-checked 10 dirty inputs in the validation copy, **exit 101**. The 1,391 library tests passed. Four tests in `tests/agents_view_catalog_settle_carry.rs` failed: two expectation mismatches (saved catalog fetch and resumed row) and two daemon connection refusals. Full stack snippets: `logs/native-pa-tui-phase0-20261012-attempt2.log`. No xonsh-specific TUI test success is established by this result.
- The failing test file is identical upstream/native; only `pa-core` and five dirty TUI files differ in the validated tree. Test-file identity does **not** establish shared root cause. A clean upstream run of that integration target was launched under `run-upstream-pa-tui-control-20261012.xsh`; status `upstream-pa-tui-control-20261012.json`, log `logs/upstream-pa-tui-control-20261012.log`. Its exit is pending. Do not repair, skip, or classify the failures until the control and test assumptions are examined.

## Upstream catalog-only control completed (2026-10-12)

- `upstream-pa-tui-control-20261012.json` records clean upstream `v0.10.0@763094e1b`, `cargo test -p pa-tui --locked --test agents_view_catalog_settle_carry`, **exit 0**: all four tests pass. Full log `logs/upstream-pa-tui-control-20261012.log`. The runner PID was 49998 and its observed Cargo child PID was 50000; both have exited.
- The native failures occurred under `cargo test -p pa-tui --locked` (full crate run), whereas upstream ran only that integration target. The different invocation prevents a clean shared-vs-port conclusion. Next minimum comparison: run that exact catalog-only command on the existing isolated native dirty-input copy; do not alter or skip the test. Then investigate full-suite interaction if native-only target passes.

## Native catalog-only reproduction completed (2026-10-12)

- The isolated native copy at `2da0c33ed` with ten protected dirty inputs ran the **same** catalog-only invocation as upstream: `cargo test -p pa-tui --locked --test agents_view_catalog_settle_carry`. `native-pa-tui-catalog-control-20261012.json` records exit **0**, all four pass; log `logs/native-pa-tui-catalog-control-20261012.log`. Runner PID 54575 has exited.
- Thus the four failures in the earlier native **full crate suite** are not reproduced by either catalog-only target. This does **not** prove they were upstream, a port regression, or a specific race. Full-suite scheduling, shared state, test-order effects, environment, and nondeterminism remain hypotheses requiring targeted evidence. The TUI full-suite gate remains failed.

## Full-suite catalog failure investigation (2026-10-12, pending repeat)

- Existing full-run log `logs/native-pa-tui-phase0-20261012-attempt2.log`: all 1,391 library tests passed in 3.32s; the four tests in the immediately following `agents_view_catalog_settle_carry` integration binary all failed after 55.79s. Two failed at assertion (`saved_requests` zero; selected live row instead of saved row); two second-run attempts could not reconnect to a mock Unix socket. The separately invoked *same native binary* passed all four in 62.70s (`logs/native-pa-tui-catalog-control-20261012.log`). These differing outcomes do not prove cross-binary interference; repeat identical full command before classifying. No test or implementation was changed.

## Direct changed-path xonsh sidecar probe (2026-10-12)

- Fresh isolated Python project env (`.worktrees/native-rust-validation-20261011/prime-agent-runtime`), test `ReplTest.test_xonsh_mode_executes_native_shell_syntax`: without xonsh dependency, exit 1 (expected `value`, stdout empty) at `test/test_repl.py:252`. Source `src/rlm/repl.py:617-618` raises `RuntimeError("xonsh is not installed in this kernel")` if absent. With `--with xonsh`, the xonsh pytest plugin itself fails at startup on absent optional `prompt_toolkit` (exit 3), unrelated to sidecar behavior; with `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`, same targeted test passes 1/1 (exit 0). Logs and statuses: `native-xonsh-sidecar-targeted-20261012`, `native-xonsh-sidecar-with-dependency-20261012`, `native-xonsh-sidecar-no-pytest-autoplugin-20261012`. The isolated env proves required dependency for xonsh mode; source `crates/pa-core/src/kernel/bootstrap/mod.rs` default extras and `venv/probe.rs` should be tested/fixed on a separate authorized integration line, not by editing protected native worktree.

## Separate `origin/main` seven-example source triage (2026-10-12)

- `pre-port-capability-ledger.json:older_origin_main_pool.priority_examples_reviewed` now gives per-SHA status, source pointers and a behavior-level acceptance check for seven selected commits. **Source-only, no tests:** native installer ownership and process cleanup, release publication, worker teardown are partial/unverified; kernel host request timeout, singleton exclusivity and early session persistence have unresolved requirements/equivalence. TS/npm prefix and owner-file mechanisms can be retired without declaring the underlying safety guarantees satisfied. Remaining 315 candidates remain unassessed, not implied requirements.
- Corrected delegated generalization: `prime-agent-runtime/src/rlm/repl.py` differs between upstream and native from xonsh port, though the extracted `host_request` block is byte-identical. Rust/script paths checked `git diff v0.10.0 2da0c33ed -- ...` were unchanged; avoid claiming all relevant files identical.

## Actual kernel/REPL venv cold bootstrap RED (2026-10-14)

- In clean isolated worktree `.worktrees/native-rust-xonsh-bootstrap` at native HEAD `2da0c33ed`, the ignored explicit-run Rust test `crates/pa-core/tests/kernel_bootstrap_xonsh_live.rs` invoked `pa_core::kernel::ensure_kernel_python` with a fresh temporary `PRIME_AGENT_KERNEL_VENV` and `PI_PACKAGE_DIR` set to this checkout. It used uv and Python 3.11 to build the actual venv and installed 50 packages. The resulting interpreter failed `import xonsh` with `ModuleNotFoundError`; test exit **101** (status `native-xonsh-bootstrap-live-red-20261014.json`, full log in `logs/`). Unlike the earlier unit check, this directly exercised the Rust bootstrap path. The test also runs existing sidecar xonsh protocol unittest using that exact interpreter after the import succeeds; it did not reach that step in RED.
- Focused unit RED also exit **101** because `default_rlm_extra_uv_args()` did not include xonsh. Small isolated production patch adds one `("xonsh", "xonsh", "xonsh")` tuple to `bootstrap/mod.rs`, changes tuple length 12→13; shared table already feeds uv install args and readiness import probe. Both GREEN runs pending; original native worktree and main protected inputs untouched.

## Resume verification (20261014T025608Z)

- Twelve protected hashes still match. Bootstrap isolation still contains only the one-entry production package change, its unit test, and the explicit live test. Original worktrees remain protected.
- Prior unit GREEN status was stale: runner PID 31365 is absent, no Cargo/rustc process survives, and the log has no test result. Reclassified as interrupted, not failed or passed. Restarted only the named `--lib` test; status `native-xonsh-bootstrap-unit-green-20261014T025608Z.json`.

## Live bootstrap GREEN and toolchain boundary

- Sol-run live test completed exit 0: actual `ensure_kernel_python` created a fresh temporary venv, installed 51 packages including xonsh 0.24.2, and the integration test passed (1/1). Evidence: `bootstrap-sol-live-green-20261014T025754Z.json` and its log. This precedes the user notification of a background stable toolchain update.
- Focused unit restart failed before tests at rust-lld linking; do not call it a failing xonsh assertion. Sol started a non-incremental diagnostic build. The concurrent `rustup +stable update` means any overlapping compile needs a version-pinned rerun before acceptance. No root source edit or adoption.
- Luna produced `resume-product-decisions.json`: native xonsh installer UX, native `.env` loading, Windows acceptance remain product questions. No decision inferred from the user having unread planning docs.

## Bounded bootstrap acceptance and next TUI tests

- `bootstrap-post-update-result.json`: both focused unit and real clean-venv integration exit 0, each exactly one Rust test passed; stable rustc/cargo 1.99.0 unchanged before/after. Root checked structured evidence, relevant unit log, scoped diff, and rehashed 12/12 protected inputs. Decision: `bootstrap-root-acceptance.json`, bounded acceptance only; no adoption or commit.
- Live fixture uses the bootstrapped interpreter but prepends checkout sidecar source through its existing helper. This does not verify an installed wheel or package layout. The initial incremental linker failure was avoided with `CARGO_INCREMENTAL=0`; exact cause remains unproven.
- Read-only TUI review found xonsh render/count routing present, but no direct xonsh card/error/tree tests. Current preview still routes through Python. Sol now owns only three characterization tests in the existing isolated validation copy; no preview/lexer semantic change is authorized by that brief. Evidence/design: `tui-xonsh-acceptance-review.json`.
- Post-update verifier follow-up confirms a live-test evidence gap: the Rust test checks inner unittest exit status, but successful child output is hidden and no inner test count is recorded. The named ReplTest method exists, but present logs cannot rule out zero-match success. Before merging, strengthen the live test to require a nonzero/expected inner count and rerun it. No current worker is authorized to make that bootstrap-test change.

- TUI characterization is now tested, not merged: public card render/count routing, error output without duplicate traceback, and Unicode-aware tree summary. Counts overlap: 3 new + 17 related results = 18 distinct tests, not 20. No mutation proof or mixed-language preview proof claimed.
