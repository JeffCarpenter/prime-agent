# Progress

## 2026-09-25 — Requirements and discovery

- Read the provider/model discovery findings and traced Prime Agent's model sources.
- Updated global Prime Agent settings separately: provider is `openai-codex`, model is `gpt-6-luna`; verified effective settings.
- Confirmed the request: Codex live models should be selectable in `/model` before they enter the shared catalog.
- Confirmed unknown-price models stay selectable and receive a non-modal, non-disruptive warning.
- Used tree-sitter-backed `ast-grep` patterns and `jq` to trace `getAvailable()`, `getExecutableModels()`, the Codex filter, and pricing consumers. Added reproducible commands to `findings.md`.
- The registry filters catalog Codex models against live IDs. It does not create model objects for live-only IDs. The picker and RLM path currently obtain model lists through distinct call sites.
- No source code or tests changed. No provider API/model completion was called.

## 2026-09-25 — Deeper metadata, cost, and Codex Rust audit

- Confirmed the Codex endpoint parser in Prime Agent currently keeps only `models[].slug`; existing tests mock only slugs.
- Queried official OpenAI API docs with Context7. Public `GET /v1/models` exposes identifiers/ownership/timestamps, not price or model capabilities; it is distinct from the authenticated ChatGPT/Codex `/codex/models` endpoint.
- Spawned and accepted a read-only audit of `/home/jeff/code/fork/codex/codex-rs`. It found Codex-specific metadata fetching, ETag/cache/merge behavior, app-server exposure, and TUI selection. Rust `ModelInfo` has display name, reasoning, modalities, context, and API-visibility metadata, but no price field.
- Spawned and accepted a read-only audit of Prime Agent's unknown-cost pipeline. Numeric model prices feed cost calculation and then usage aggregation, subtraction, session summaries, telemetry, and UI displays. Zero or numeric sentinels would misstate cost; explicit pricing knowledge is needed throughout the pipeline.
- Attempted MCPLS and Rust Analyzer semantic navigation for the external Rust workspace. MCPLS is rooted at Prime Agent and rejected external files; switching the Rust Analyzer workspace exited before responding. I inspected and cited the external call chain, but did not verify it with compiler navigation.
- Updated `findings.md` with the cross-repo comparison, cost-flow evidence, reproducible ast-grep/`jq` commands, and a quick reference for future investigators. Updated `task_plan.md` to define the remaining tagged pricing-state design and approval gate.
- User-owned `.planning/.active_plan` was left untouched. No source code or tests changed; no live provider calls were made. Both research agents completed and were released.

## 2026-09-25 — Xonsh and Plumbum pipeline follow-up

- Recorded the user's Xonsh `0.24.2` runtime path and working directory in `findings.md`.
- Clarified the shell boundary: the user's `$(date +%s)` run was interpreted by `/bin/bash`, which expanded the value and then tried to execute the timestamp (exit 127). The plain `date +%s` command succeeded. Xonsh syntax must be executed in the native Xonsh REPL; do not call `bash()` for it.
- Verified in Xonsh 0.24.2 that `!(...)` captures a `CommandPipeline` and `![...]` returns a `HiddenCommandPipeline`. Inspected `CommandPipeline` source and tested `false | true`: `.returncode` and `.itercheck()` only reported the final stage, so a successful `jq` can hide an earlier producer failure.
- Evaluated Plumbum: it can help a reusable Python helper with argument-safe command binding and explicit exit/stdout/stderr handling. It is unnecessary for a one-off Xonsh query; separate producer/consumer calls when exact failure reporting matters.
- Added these findings and targeted DeepWiki questions to `findings.md`, and added the Xonsh/Bash boundary to `task_plan.md`. No source code or tests changed; no provider calls were made.

## 2026-09-25 — DeepWiki query buffer completed

- Prepared 18 independent Xonsh string/operator questions as deferred thunks and drained them sequentially at an 8-second minimum interval, with exponential retry backoff configured. All 18 succeeded on the first attempt; the deque is empty.
- Question buffer: `.planning/2026-09-24-provider-model-discovery/deepwiki-xonsh-string-query-queue-20260925T081201Z.json`. Answers: `.planning/2026-09-24-provider-model-discovery/deepwiki-xonsh-string-query-results-20260925T081201Z.jsonl`.
- Cross-checked answers against Context7 and Xonsh 0.24.2. Quotes shield syntax-collision text (such as `${`) and group one argument, but regular quoted strings still expand `$HOME`; `r'...'` and `@(...)` preserve it. The raw-string probe also preserved both source backslashes; `repr()` doubles backslashes for display. DeepWiki was wrong about single quotes suppressing environment expansion, `![...]` returning `CommandPipeline`, and `itercheck()` checking every pipeline stage. The earlier pipeline probe showed only the final stage affects `returncode`/`itercheck()`.
- No source code or tests changed; no live provider calls were made.

## 2026-09-25 — AST-grep and JMESPath helper

- Added `scripts/query_cost_calls.py`, which queries the two TypeScript source trees with `ast_grep_py` and uses compiled JMESPath projection to print file, one-based line, and expression as TSV.
- Added `scripts/tests/test_query_cost_calls.py`. The process-level test failed before the script existed and passed after implementation. The script's five live results matched the prior AST-grep CLI/Python-binding rows.
- `npm run check` passed. No model-discovery behavior changed and no provider API calls were made.

## 2026-09-25 — Phase 2 pricing design proposal

- Rechecked the shared `Model`/`Usage` contracts, reversible usage rollups, session JSONL migration path, telemetry events, and user-facing cost summaries.
- Finalized a tagged known/unknown design proposal with a reversible unknown-contributor count. It preserves authoritative per-call billing, keeps telemetry token-only, and specifies a v3-to-v4 session migration.
- Recorded the proposal and rejected alternatives in `findings.md`; updated `task_plan.md` to mark Phase 2 design ready for approval. No feature code changed and no provider API calls were made.

## 2026-09-24 — Phase 3 implementation checkpoint

- User approved the Phase 2 design and authorized Phase 3.
- Added `ModelCost`/`UsageCost` types and an unknown-price branch in `calculateCost()`. The new AI regression failed first with `NaN`, then passed after the implementation change.
- Added `test/usage.test.ts` for adding known plus unknown usage and subtracting the unknown contribution. It failed first with `NaN`, then passed after reversible unknown-contributor accounting was added in `core/usage.ts`.
- Added a model-registry regression for a live-only Codex slug. It currently fails as expected because the registry still does not synthesize/merge live-only models.
- Began cost-aware changes in AI provider pricing, core usage/session summaries, selector/context displays, and extension model config types. I made several display edits before adding tests. Treat them as provisional; add failing tests before keeping them.
- Compatibility deviation under review: `ModelCost` and `UsageCost` currently include untagged numeric known-cost variants because generated model data still uses numeric cost objects and `models.generated.ts` must not be edited directly. Dynamic unknown costs and newly calculated known usage use tagged variants. Confirm this remains safe and acceptable before marking the contract complete.
- `pnpm exec tsgo --noEmit` currently exits 2 with 31 diagnostics across 18 files. Most are tests/examples not yet migrated to cost accessors; remaining production diagnostics include `ProviderModelConfig` versus `ProviderConfigInput` cost-type mismatches. `npm run check` has not passed.
- `npm run check` reached Biome and test-policy successfully, then failed in TypeScript during the incomplete migration. Do not claim full validation.
- `test/model-registry.test.ts`: 47 passed, 9 failed. The live-only test is the intended RED. Eight existing OpenRouter cases also fail; the bundled model query returned no OpenRouter models, so this appears to need catalog fixture setup or baseline verification.
- Feature edits span AI, agent, and coding-agent source/tests, plus this planning directory. Existing unrelated untracked paths and `.planning/.active_plan` were left untouched. No commit created; no real provider request made.

## Next actions

1. Fix the 31 current TypeScript diagnostics and run `pnpm exec tsgo --noEmit` again.
2. Add a failing selector/summary regression before retaining the current display changes.
3. Implement live Codex model construction and merge in `refreshModelCatalog()` and `getExecutableModels()`; preserve existing catalog models on discovery failures.
4. Add session v3-to-v4 migration and provider-reported-cost override coverage.
5. Run focused tests, resolve catalog test setup, then run `npm run check` and `npm run check:test-policy`.

## Phase 3 resumed — current session

- Restored all three task planning files. Baseline type check still fails with 31 diagnostics; full output: `/tmp/codex-phase3-types.log`.
- Registry worker owns only `src/core/model-registry.ts` and `test/model-registry.test.ts`; persistence worker owns session-manager implementation and its existing tests. Worker reports stay in this plan directory.
- Parent retains AI cost contract, provider billing, UI/summary coverage, other type diagnostics, catalog setup, and final acceptance. No live providers, defaults changes, or commits authorized.
- Existing checkout is on `xonsh-installer-port` with prior feature and unrelated edits. Resume in place; do not move or discard that work.

- Accepted initial registry worker RED evidence and released that read-only worker. A replacement implementation worker has the explicit fallback decision and owns the same two paths; no overlapping registry writers. Catalog baseline corrected: six OpenRouter failures plus two Anthropic multiplicity failures.
- Inspected current AI types/models/cost helpers and usage rollups in full. Untagged numeric cost variants remain in the shared types; strict tagged contract review remains open.

- Fixed audit snapshot dependency resolution (package-local node_modules links; first attempt aborted midway). Launched missing-vs-full catalog comparison in frozen pre-worker snapshot; results pending. All three workers now report completed; registry implementation report not yet reviewed.

## Session state snapshot (compaction prep)

### Live handles and artifacts
- Working tree: /home/jeff/code/fork/prime-agent, branch xonsh-installer-port (user's branch; resume in place, never reset).
- Plan dir: .planning/2026-09-24-provider-model-discovery/ (task_plan.md, findings.md, progress.md, registry-worker.md, persistence-worker.md, ai-worker.md, registry-parent-decision.md, persistence-check.log).
- Frozen causal-audit workspace: /tmp/prime-registry-causal-shadhtwu (pre-worker registry+test snapshot; missing.log/full.log verdicts recorded in findings.md).
- Public catalog assets (no tokens needed): /tmp/prime-codex-phase3-catalog (1197 models, 42 tuples, 68 MCP services).
- Baseline typecheck log: /tmp/codex-phase3-types.log (31 errors at session start; recount needed after worker edits).
- Children (all completed, not yet deleted): cost-persistence (sub-16931839), codex-registry-implementation (sub-4a9008d0), ai-cost-contract (sub-f6ef89f5). Earlier read-only codex-registry (sub-de262912) deleted.

### Established facts
- Registry failures causal verdict: 7 of 8 non-RED failures are environment (un-committable generated catalog asset absent -> compiled tiny fallback). With full assets: 2 failed/54 passed. Remaining: live-only RED (feature) + modelOverrides cost-shape break (real migration item: applyModelOverride now writes {status:"known",rates}, test asserts cost.input).
- Worker outcomes: persistence done (session v4 migration, 57 green, mutation kill; flagged Biome --write touched 10 worktree files; line budget 34 src/57 test in its slice). ai-cost done (63/63 green, mutation kills on unknownContributors invariant + reported-cost guard; strict tagged-only migration deferred, numeric boundary acceptance retained). registry-implementation completed, report not yet reviewed.
- Approved decisions: slug-only live models use custom-model client defaults (reasoning false, text-only, contextWindow 128000, maxTokens 16384) as explicit client policy; catalog metadata precedence; 5-min cache; no default changes; no live provider calls; no commits yet.

### Next steps (in order)
1. Review registry-worker.md (implementation report), then current git diff --numstat to inventory all worker edits.
2. Reconcile cost.rates shape break: update modelOverrides test expectation to tagged contract (or accessor).
3. Rerun pnpm exec tsgo --noEmit; fix remaining errors as one coordinated pass (mostly tests/examples reading cost.total / usage.cost.total -> getUsageCostAmounts accessor; ProviderConfigInput cost mismatch).
4. Run focused tests: packages/ai models-cost.test.ts, packages/coding-agent test/model-registry.test.ts, test/session-manager/file-operations.test.ts, test/usage.test.ts.
5. Write test-first selector/summary display regressions; changelog fragments; aggregate test/source line budget check; npm run check + check:test-policy.

## Phase 3/4 completion

- Accessor migration fixed remaining 19 type errors; typecheck 0; npm run check fully green (Biome, test-policy, tsgo, installer, push-guard, browser-smoke).
- Focused tests: model-registry + catalog-compat 69/69 (full-catalog assets via PI_PACKAGE_DIR), recursion 89/89, context-tree/compaction/runtime suites green except 2 failures proven pre-existing at a git-archive HEAD counterfactual (live-network catalog dependence: OpenRouter ~…-latest aliases; documented in findings).
- Display regressions added (sessions table + context tree) and mutation-proven: reverting the unknown-cost rendering fails exactly the two new tests; restored and green 63/63.
- Changelog fragments written for both packages. Line budget: 380 production adds vs 308 test adds (incl. new files) - within policy.
- No commits; no live provider calls; defaults unchanged. Frozen audit + HEAD counterfactual workspaces left in /tmp for inspection.

- Wrote consolidated `final-findings.md` (contract, causal audit, validation matrix, follow-ups, artifact index).

- Moved consolidated findings to `.planning/2026-09-26T013940Z-codex-live-model-discovery/findings.md` per user layout convention (ISO8601-prefixed .planning subdir, file named findings.md).

## 2026-09-27T032834Z — Delegated review wave (coordinator + 5 workers)

- Reviewed the full unknown-price / live-Codex diff via five disjoint-scope workers; defects and fixes listed in `2026-09-27T032834Z-unknown-price-delegated-review/findings.md` (json alongside).
- Coordinator model switched to z.ai glm-5.3 family after openai-codex usage limit; ai-cost and ui-cost final reports were lost to the same limit and reconstructed from disk/transcripts.
- Remaining: focused test verification of ai-cost + ui-cost files, patch-wide line budget reconciliation, `npm run check`, `npm run check:test-policy`. No commits.

### Final (post-interruption recovery)

- Lost ai-cost/ui-cost verification rerun by coordinator: packages/ai 13/13, packages/coding-agent 67/67.
- `npm run check` and `npm run check:test-policy` fully green from repo root.
- All five workers accepted and deleted; no commits. Full model-registry file still needs bundled catalog assets for its 8 environment-dependent tests.
