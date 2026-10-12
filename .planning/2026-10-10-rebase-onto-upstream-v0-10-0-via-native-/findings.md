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
