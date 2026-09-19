# Rebase Reconciliation Findings: `xonsh-repl` onto `stable-prime` (v0.9.5)

**Date:** 2026-09-15  
**Base Branch:** `stable-prime` (`987effdd82b8714c363b8d8d98d27034fc715895`)  
**Rebased Branch:** `xonsh-repl`  
**Previous Base:** `origin/stable-prime` (`6d3fb504f`, pre-v0.9.5 rebase, based on `v0.9.4`)

---

## 1. Overview & Rebase Topology

The `xonsh-repl` branch branched off an older revision of `stable-prime` (`6d3fb504f`) when the repository was at v0.9.4 (`f771dfced`). Subsequently, `stable-prime` was rebased onto `stable-pnpm` (`eeb4a19fc`), which itself had been rebased onto upstream `stable` (v0.9.5 / `a7d791bc1`).

When rebasing `xonsh-repl` onto `stable-prime`, git calculated the merge base against `v0.9.4` (`f771dfced`). The commit history of `xonsh-repl` prior to the xonsh integration work contained earlier commits that had already been rewritten and incorporated into `stable-prime`:

| Pre-v0.9.5 Commit on `xonsh-repl` | Equivalent Rebased Commit in `stable-prime` | Rebase Action |
| :--- | :--- | :--- |
| `467e5b613` (`use pnpm`) | `091bd72a7` | Conflicted on outdated package scripts; pruned/skipped |
| `b1b9bef8c` (`chore: add @biomejs...`) | `b126cceec` | Skipped automatically by git |
| `fc044257f` (`windows: focused build...`) | `6ea9da2a1` | Pruned from rebase-todo (already in `stable-prime`) |
| `472a576a0` (`feat: add dotenv...`) | `37bfd406f` | Pruned from rebase-todo (already in `stable-prime`) |
| `6d3fb504f` (`scripts: move install.xsh...`)| `987effdd8` | Skipped automatically by git |

Pruning the duplicate pre-v0.9.5 commits allowed the rebase to apply the 15 commits unique to `xonsh-repl` (`ed8a6a528` through `e285f9f4d`) directly on top of `stable-prime`.

---

## 2. Conflict Analysis & Reconciliation

### A. Untracked Working Tree Collision: `.planning/.active_plan`
- **Encountered on:** Commit `91e43fbe6` (`docs: add active xonsh planning state`).
- **Issue:** Commit `91e43fbe6` tracks `.planning/.active_plan` in git. A stale, untracked `.planning/.active_plan` file in the working tree blocked checkout.
- **Resolution:** Removed the untracked working-tree file, allowing git to check out the branch-tracked active plan pointer (`2026-09-13-xonsh-integration`).

---

### B. Feature Hints Removal: `packages/coding-agent/test/interactive-mode-feature-hints.test.ts`
- **Encountered on:** Commit `fe017b60b` (`test(coding-agent): add xonsh coverage and fix flaky env-dependent tests`).
- **Context:** Upstream commit `126b43c0c` (#2183: *simplify prompt bar controls*) completely removed `FeatureHintDeck` and feature-discovery tips from `InteractiveMode`. Commit `fe017b60b` had previously added an assertion checking neutral REPL wording in the old feature hint deck.
- **Resolution:** Reconciled to HEAD (`test/interactive-mode-feature-hints.test.ts`), which tests `InteractiveMode without feature-discovery tips`.

---

### C. Major Dual-REPL Delivery Conflicts: Commit `ab8756746`
Commit `ab8756746` (`feat(coding-agent): deliver native xonsh REPL alongside ipython`) touched core lifecycle, prompt generators, protocol definitions, and UI components across 41 files. The conflict resolutions were reconciled as follows:

#### 1. `packages/coding-agent/src/modes/interactive/feature-hints.ts`
- Deleted in HEAD (part of PR #2183); removed from tree via `git rm`.

#### 2. `packages/coding-agent/docs/rlm.md`
- Upstream v0.9.5 migrated subagent spawning from `rlm(...)` to `rlm.spawn(..., name=...)`.
- Reconciled to HEAD to preserve the updated `rlm.spawn` syntax.

#### 3. `packages/coding-agent/src/cli/args.ts`
- Upstream introduced `FREEFORM_VALUE_FLAGS` and `PROMPT_VALUE_FLAGS`.
- Merged `"xonsh"` into `BUILTIN_TOOL_NAMES`:
  ```typescript
  const BUILTIN_TOOL_NAMES = ["ipython", "xonsh"];
  ```

#### 4. `packages/coding-agent/src/core/agent-session.ts`
- Upstream PR #2115 unified all machine-injected user-channel messages under a standardized bracket grammar (`[<kind>]`, blank line, payload).
- Discarded legacy XML wrappers (`<xonsh_state>`, `</xonsh_state>`, `<xonsh_state_restored>`) and integrated xonsh into the bracket grammar:
  - Compaction state message: `[xonsh-state]` or `[python-state]`
  - Restored state message: `[xonsh-state-restored]` or `[python-state-restored]`

#### 5. `packages/coding-agent/src/core/goals.ts`
- Retained guidance directing the model to invoke `await goal.complete()` in xonsh or ipython.

#### 6. `packages/coding-agent/src/core/prompts/rlm.ts`
- Retained the `REPL_CONTROL_PROMPT(toolName: "ipython" | "xonsh")` selector to generate dialect-specific guidance for `xonsh` vs `ipython`.
- Updated the continual harness call contract in `REPL_CONTROL_PROMPT` to use upstream v0.9.5 `await rlm.spawn('sub-task', name='worker')`.

#### 7. `packages/coding-agent/src/core/refinement/refinement.ts`
- Reconciled `includeReplExamples` to describe the Python skill runtime (Xonsh or IPython REPL) while referencing `rlm.spawn('sub-task', name='worker')`.

#### 8. `packages/coding-agent/src/core/system-prompt.ts`
- Upstream PR #2098 eliminated `harnessState` from `buildSystemPrompt` (delivering continual harness state in-context via mechanical `harness_digest` messages).
- Removed obsolete `harnessState` prompt interpolations.
- Retained `hasRepl = hasIpython || hasXonsh` and conditioned subagent doctrine on `hasRepl`.

#### 9. `packages/coding-agent/src/modes/daemon/daemon-protocol.ts`
- Both upstream v0.9.5 and the xonsh branch had independently bumped `DAEMON_SCHEMA_REVISION` to 28.
- Verified that `xonsh_sent_agent_message` rides the existing backward-compatible `session_event` channel (`AgentSessionEvent`), requiring no wire-shape changes to `DaemonOutbound` or `DaemonCommand`.
- Retained HEAD's `DAEMON_SCHEMA_REVISION = 28` and verified the schema hash digest matches `DAEMON_SCHEMA_ID = "protocol-7-schema-28-92bc5368a082"`.

#### 10. `packages/coding-agent/src/modes/interactive/components/conversation-components.ts`
- Reconciled `isCompactAgentMessageNeighbor` to match both `ReplCellComponent` and upstream's `ShellCompletionComponent`.

#### 11. `packages/coding-agent/src/modes/interactive/components/injected-prompt-message.ts`
- Reconciled `headerText()` to format summary badges for both `IPYTHON_STATE_RESTORED_CUSTOM_TYPE` and `XONSH_STATE_RESTORED_CUSTOM_TYPE` ("Restored Xonsh kernel state" / "Started fresh Xonsh kernel").
- Preserved upstream delegation of `ASYNC_BASH_COMPLETION_CUSTOM_TYPE` to `ShellCompletionComponent`.

#### 12. `packages/coding-agent/src/modes/interactive/components/ipython-cell.ts`
- Merged upstream PR #2193 nested tree styling (`╰─ `, `OUTPUT_INDENT`, statement lines) and dimmed single-line collapsed preview with Xonsh shell syntax highlighting (`previewXonshCode`, `parseReplBashCell`, and `$VAR`/`$(...)` line detection).
- Updated `XonshCellState` to include upstream background shell fields (`backgroundShell`, `shellCompletion`, `shellCompletionAmbiguous`) alongside `toolName?: "xonsh" | "ipython"`.

#### 13. `packages/coding-agent/src/modes/interactive/components/tool-execution.ts`
- Replaced `shouldUseIpythonRenderer()` with `shouldUseReplRenderer()` (covering both `ipython` and `xonsh`).
- Plumbed `backgroundShell`, `shellCompletion`, and `shellCompletionAmbiguous` through to `XonshCellState`.

---

## 3. Post-Rebase Verification & Follow-up Fixes

Following the rebase, `npm run check` identified three integration diagnostics:
1. `packages/coding-agent/src/core/prompts/rlm.ts`: Fixed reference to undefined `hasIpython` in `buildChildAgentDoctrine` by changing it to `hasRepl`.
2. `packages/coding-agent/src/core/system-prompt.ts`: Removed unused `hasBash` variable resulting from the removal of `harnessState`.
3. `packages/coding-agent/src/modes/interactive/components/tool-execution.ts`: Cleaned up unused imports `getIpythonCodeFromArgs` and `IPythonCellComponent`.

These fixes were committed in `7113159b1` (`fix(coding-agent): reconcile post-rebase diagnostics with v0.9.5`).

### Full Verification Results (`npm run check`):
- **Biome:** 1,095 files checked in 2s with 0 errors and 0 warnings.
- **TypeScript:** `tsgo --noEmit` passed across all 9 workspaces.
- **Installer Check:** `node scripts/check-installer.mjs` passed.
- **Browser Smoke Test:** `node scripts/check-browser-smoke.mjs` passed.
