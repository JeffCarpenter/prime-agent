# Build Engineering Planning Review: Rebase onto upstream/v0.10.0 via Native Rust

> **Review Target:** [`.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/)  
> **Auditor:** Build Engineering Pair / Antigravity  
> **Review Date:** 2026-10-11  
> **Evaluation Focus:** Strict verification, redundancy reduction, ambiguity elimination, and build engineering feasibility  

---

## 1. Executive Summary & Review Verdict

This review conducts an inquisitive, strict, and rigorous build engineering audit of the planning architecture governing the rebase and native Rust port of `prime-agent` onto upstream release `v0.10.0`.

### Overall Verdict: **CONDITIONAL PASS — REMEDIATION REQUIRED**
The rebase plan establishes sound provenance tracking (`pre-port-lineage.json`) and correctly identifies the upstream architectural pivot (PR #2524 / commit `39bc99a91` replacing 1,181 TypeScript files with a native Cargo workspace). However, the planning artifacts suffer from **five-way state synchronization drift**, **linguistic partitioning**, a **critical bootstrap dependency omission**, **semantic ambiguity regarding single- vs. multi-kernel execution**, **stale permission flags**, and **worktree / script sprawl**.

---

## 2. Redundancy Analysis: Multi-Tracking & Sprawl

### 2.1 Five-Way State Synchronization Drift
The execution state of the project is tracked across five separate files that have drifted:
1. [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md): Phases 1 & 2 marked `completed`, Phase 3 `in_progress`, Phase 5 `approved`.
2. [`.planning/native-rust-port-reconciliation-plan.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/native-rust-port-reconciliation-plan.yaml): Phases 1–4 are **all still recorded as `status: pending`**, while Phase 5 is `status: approved`.
3. [`native-status.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/native-status.yaml): Tracks progress in Literary Chinese (`已立隔離樹... 核心工具已入 HEAD...`).
4. [`context-checkpoint.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/context-checkpoint.json): Uses prose phase identifiers (`Phase 0: provenance inventory done; capability parity next`).
5. [`validation-run.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/validation-run.json): Contains isolated execution records with a stale authorization block.

**Remediation:** Designate [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md) and [`native-status.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/native-status.yaml) as the canonical operational status records and synchronize [`.planning/native-rust-port-reconciliation-plan.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/native-rust-port-reconciliation-plan.yaml) to reflect actual completions.

### 2.2 Worktree Sprawl
Running `git worktree list` reveals five distinct worktrees on disk:
- `/home/jeff/code/fork/prime-agent` (`xonsh-rust`, commit `5abfb4186`)
- `.worktrees/feat-native-rust-xonsh` (`feat/native-rust-xonsh`, commit `2da0c33ed`)
- `.worktrees/native-rust-validation-20261011` (detached `2da0c33ed`)
- `.worktrees/native-rust-upstream-baseline-20261011` (detached `763094e1b`)
- `.worktrees/rebase-2a16de906` (detached `2a16de906`) — **completely undocumented in the active plan**.

In addition, separate build output folders (e.g. `.worktrees/native-rust-validation-target`) duplicate compilation cache artifacts, taking multiple gigabytes of disk space.

### 2.3 Script Duplication & Churn (`.planning/bin/`)
The user explicitly authorized pruning redundant `.planning/bin/*.xsh` scripts (`"that's what git is for"`). While bash scripts were pruned, four `.xsh` scripts (`show-active-outstanding.xsh`, `show-outstanding.xsh`, `show-section.xsh`, `show-item.xsh`) and `phase-status.awk` were re-committed in commit `36e03b519`. These scripts duplicate functionality that can be achieved with standard tooling or `link_kernel_state.py`.

### 2.4 Multi-Snapshot Hash Redundancy
The 12 protected inputs (5 modified `crates/pa-tui/` files, 5 untracked `skills/zsh/` files, `pkgbuild/PKGBUILD`, and `pkgbuild/.SRCINFO`) are redundantly hashed and indexed across `native-preflight-inputs.json`, `context-checkpoint.json`, `validation-run.json`, `findings.md`, and `native-status.yaml`.

---

## 3. Ambiguity & Architectural Defects

### 3.1 Kernel Architecture: "Dual-Kernel" vs Single-Kernel Mode Switching
The planning documents repeatedly claim:
> *"Expose xonsh tool and dual-kernel management in native Rust core"* (reconciliation plan line 61, `task_plan.md` line 51)

**Reality:** The actual code in [`crates/pa-core/src/tools/xonsh.rs`](file:///home/jeff/code/fork/prime-agent/crates/pa-core/src/tools/xonsh.rs) and [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py) **does not manage two kernel processes**. It is a single Python kernel daemon that accepts execution requests tagged with `mode: Some("xonsh")`. Upstream's terminology ("kernel management") introduced ambiguity, misleading planners into treating mode switching as dual daemon lifecycle management.

### 3.2 Silent Killer: Bootstrap Virtualenv Omits `xonsh`
Identified via compiler-grade inspection in [`kernel-mcpls-audit.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/kernel-mcpls-audit.json#L85-L94):
- [`crates/pa-core/src/kernel/bootstrap/venv.rs`](file:///home/jeff/code/fork/prime-agent/crates/pa-core/src/kernel/bootstrap/venv.rs) provisions 12 default packages for the runtime virtualenv. **`xonsh` is absent from this list.**
- [`crates/pa-core/src/kernel/bootstrap/venv/probe.rs`](file:///home/jeff/code/fork/prime-agent/crates/pa-core/src/kernel/bootstrap/venv/probe.rs) probes readiness without checking for `xonsh`.
- [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L42-L51) imports `xonsh` conditionally; if missing, execution raises an unhandled `RuntimeError`.

**Build Engineering Defect:** In a clean environment without global xonsh packages, the agent builds and passes isolated tests, but crashes at runtime upon the first xonsh prompt.

### 3.3 Authorization Contradiction
In [`validation-run.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/validation-run.json#L7):
```json
"authorization": {
  "source_repairs": false
}
```
This contradicts [`context-checkpoint.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/context-checkpoint.json#L9) and [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md#L18), where scoped source and test repairs are explicitly authorized. `validation-run.json` preserved an obsolete preflight freeze.

### 3.4 Linguistic Partitioning
[`native-status.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/native-status.yaml) and [`kernel-mcpls-audit.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/kernel-mcpls-audit.json) are authored in Literary/Traditional Chinese, while the rest of the planning suite and codebase are in English. This creates schema friction, token overhead, and ambiguity for automated tooling and cross-team audits.

### 3.5 Catalog Asset Strategy in Isolated Linux Builds
`scripts/release/assemble_artifacts.py` expects `models.bundled.json` and `mcp-services.bundled.json`. In offline Arch Linux `makepkg` chroots, network access is disabled. The packaging docs in `pkgbuild/findings.md` suggest three mutually competing options (pre-fetch, checksum in `source=()`, or static fallback fixture) without standardizing on a single implementation path.

---

## 4. Test Gate Status & Non-Determinism Audit

| Gate / Test Suite | Command | Result | Analysis |
|-------------------|---------|--------|----------|
| `cargo check --workspace` | Baseline upstream check | **PASS** (exit 0) | Clean compile baseline on `v0.10.0@763094e1b`. |
| `pytest prime-agent-runtime/test/test_repl.py` | Python sidecar tests | **PASS** (exit 0) | 144 passed (26.54s) on commit `33489b01b`. |
| `cargo test -p pa-core` | Native Core tests | **FAIL** (exit 101) | 1,159 passed, 3 failed, 3 ignored. Upstream fails 2 identical tests (telemetry + Bash golden). 1 native timing test (`concurrent_producers_drop_at_the_reserve_when_the_queue_is_full`) is intermittent. |
| `cargo fmt --all --check` | Formatting check | **FAIL** (exit 1) | Unformatted diffs in `crates/pa-core/src/lib.rs` and `crates/pa-core/src/tools/xonsh.rs`. |
| `cargo test -p pa-tui` | Native TUI tests | **UNRESOLVED** | Log ends with compilation warnings (crossterm + unused `CodePreview::xonsh`); test exit was not captured. |

---

## 5. Scope Boundary Triage (The 322-Commit Candidate Pool)

[`pre-port-lineage.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/pre-port-lineage.json) cleanly isolated:
1. **The 6 release-replay pre-xonsh commits** (`eb8c04188..06bdcf1cb` on `v0.9.8`): Cover pnpm tooling, Windows builds, dotenv, and `install.xsh`.
2. **The 322 commits on `origin/main`** (split at `a9b5d88b`, containing 63 Jeff C commits): A separate line of development.

**Rule of Thumb for Phase 0 Step 2:** Do NOT blindly port from the 322-commit candidate pool. Upstream releases are authoritative. Only capabilities verified to be missing in Rust v0.10.0 and specifically requested as essential fork features should enter the capability ledger.

---

## 6. Remediation Action Matrix

1. **Rectify Missing Planning Review File:** [x] Authored this file ([`build-engineering-planning-review.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/build-engineering-planning-review.md)).
2. **Surface Bootstrap Dependency:** Add task to Phase 3 in [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md) and risk matrix in [`.planning/native-rust-port-reconciliation-plan.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/native-rust-port-reconciliation-plan.yaml) to ensure `xonsh` is installed in `crates/pa-core/src/kernel/bootstrap/venv.rs`.
3. **Reconcile Status Drift:** Update [`.planning/native-rust-port-reconciliation-plan.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/native-rust-port-reconciliation-plan.yaml) to mark Phase 1 & 2 as completed and Phase 3 as in progress.
4. **Reconcile Authorization Flags:** Update [`validation-run.json`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/validation-run.json) to record authorized scoped repairs.
5. **Clarify Kernel Semantics:** Update [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md) and [`findings.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/findings.md) to explicitly state that "dual-kernel" refers to upstream's terminology for single-kernel mode switching.
6. **Track Ghost Worktree:** Add `.worktrees/rebase-2a16de906` to [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md) Housekeeping TODOs.
7. **Tersely Note Script Pruning:** Record status of `.planning/bin/*.xsh` in [`task_plan.md`](file:///home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/task_plan.md) and [`.planning/bin/scripts.yaml`](file:///home/jeff/code/fork/prime-agent/.planning/bin/scripts.yaml).
