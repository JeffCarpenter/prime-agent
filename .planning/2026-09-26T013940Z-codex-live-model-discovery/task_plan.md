# Task Plan: Codex Live Model Discovery & Cost Prudence

Adopted from `scratchpad.md` (策論劄記：模型博覽與計貲存疑之道).

## Governing Tenets

1. **Show all models that ever worked (凡行之有效者悉當陳列)**:
   - Break through static catalog lag (`provider-model-catalog.v1.json`).
   - Unify live model discovery (`ModelRegistry.refreshOpenAICodexModels`) into `refreshAvailableModels`.
   - Feed both `/model` (`getAvailable`) and execution paths (`getExecutableModels`). Fixes [#702](https://github.com/PrimeIntellect-ai/prime-agent/issues/702).
2. **Show costs where possible / Cost Prudence (資費審慎，疑則明闕)**:
   - Establish strict boundary between known and unknown costs (`status: "known"` vs `status: "unknown"`).
   - Never borrow neighbouring pricing or falsely display $0 for unknown rates.
   - Reversible aggregation: preserve `pricedSubtotal` while tracking `unknownContributors`.
   - Strictly gate cost extraction through sanctioned accessors (`getModelCostRates`, `getUsageCostAmounts`).
   - Present honest, non-intrusive UI ("Price unknown" in selector, "unknown" in context tree).
   - Atomic session persistence migration from v3 to v4.
3. **Leverage `mcpls` to the Hilt (Token Economy & Compiler-Grade Extraction)**:
   - Adhere strictly to "Extract, Don't Read": rely on `mcpls` LSP tools (`get_hover`, `get_definition`, `get_references`, `get_document_symbols`, `get_diagnostics`).
   - Forbid dumping whole files into context or using brute-force grep dumps when targeted LSP queries answer the question.


---

## Phases & Execution Status

### Phase 1: Core Implementation & Contract Design (Complete)
- [x] Define `ModelCost` and `UsageCost` tagged unions in `packages/ai/src/types.ts`
- [x] Implement sanctioned accessors (`getModelCostRates`, `getUsageCostAmounts`)
- [x] Update `calculateCost` and usage tracking (`costParts`, `mergeCost`) for reversible accounting
- [x] Implement authenticated Codex model discovery in `packages/coding-agent/src/core/model-registry.ts`
- [x] Implement session format v4 migration in `packages/coding-agent/src/core/session-manager.ts`
- [x] Update interactive UI components (`model-selector.ts`, `context-tree-format.ts`, footer, subagent)

### Phase 2: Delegated Review Wave & Defect Fixes (Complete)
- [x] 5-worker disjoint scope review (`registry`, `ai-providers`, `session-cost`, `ui-cost`, `ai-cost`)
- [x] Fixed transport seed fallback when catalog is missing bundled Codex entries
- [x] Clamped thinking level in `openai-codex-responses.ts`
- [x] Pinned cross-cwd runtime test in `agent-session-runtime.test.ts` to faux models
- [x] Fixed model selector row budget to prevent list collapsing on unknown prices
- [x] Hardened custom-footer and subagent extension against displaying $0.000 for unknown usage

### Phase 3: Comprehensive Verification & Quality Gates (Complete)
- [x] `npm run check` fully green (Biome 0 fixes, tsgo 0 errors, installer, push-guard 31 cases, browser-smoke)
- [x] `npm run check:test-policy` passing against base commit
- [x] Changelog fragments prepared:
  - `packages/ai/.changes/codex-live-model-discovery.md`
  - `packages/coding-agent/.changes/codex-live-model-discovery.md`

### Phase 4: Discerning Implementation of Scratchpad Next Steps (Complete)
- [x] **Discerning Analysis**:
  - Review scratchpad's proposed steps against AGENTS.md rules and working tree state.
  - Determine partition boundaries for clean commits without violating parallel agent rules or committing unapproved diffs.
- [x] **Task 4.1: Commit Partitioning & Staging Plan (Complete)**:
  - Part 1 (`65ffc807a`): `feat(ai): add tagged model and usage cost states with reversible aggregation`
  - Part 2 (`e0464bb04`): `feat(coding-agent): unify live codex model discovery and session v4 migration (fixes #702)`
  - All pre-commit quality gates (`biome`, `tsgo`, `check:test-policy`, `check:installer`, `check:push-guard`, `check:browser-smoke`) passed.
- [x] **Task 4.2: Hermetic Test Suite Verification (Complete)**:
  - Validated focused test suites:
    - `packages/ai`: `models-cost.test.ts` (2/2), `openai-codex-stream.test.ts` (47/47), `generate-models-exporter.test.ts` (11/11), `anthropic-sse-parsing.test.ts` (18/18), `openai-completions-tool-choice.test.ts` (43/43).
    - `packages/agent`: `agent-loop.test.ts` (35/35).
    - `packages/coding-agent`: `model-selector.test.ts` (2/2), `usage.test.ts` (2/2), `custom-footer.test.ts` (1/1), `subagent-extension.test.ts` (1/1), `sessions-table-format.test.ts` (39/39), `context-tree.test.ts` (24/24), `session-manager/file-operations.test.ts` (57/57), `agent-session-recursion.test.ts` (89/89), `model-registry.test.ts` (61/61), `catalog-compat.test.ts` (8/8).
  - All test suites passing 100%. Test policy ratio fully verified.
- [x] **Task 4.3: Worktree Isolation for Branch Rebase (Complete)**:
  - Isolated worktree established at `.worktrees/rebase` mapped to `xonsh-repl`.
  - Executed Strategy 2 (Fast-Forward reconciliation): advanced `xonsh-repl` to `e0464bb04` incorporating installer port and live model discovery without rewriting git history.
  - Pushed `xonsh-installer-port` to origin (`7fa656118..e0464bb04`).
  - Temporary worktree cleanly removed, preserving main worktree hygiene and zero uncommitted state damage.
- [x] **Task 4.4: SOLID Cost Container Refinement (`source: "none" | "provider" | "aggregate"`) (Complete)**:
  - [x] **4.4.1 Foundation Contracts & Generic Container (`packages/ai/src/types.ts`, `packages/ai/src/index.ts`)**:
    - Defined `CostSource = "none" | "provider" | "aggregate"`.
    - Defined generic container `Cost<T> = { readonly source: "none"; readonly partial?: T; readonly missingCount?: number } | { readonly source: "provider" | "aggregate"; readonly value: T }`.
    - Re-typed `ModelCost = Cost<CostRates> | CostRates` and `UsageCost = Cost<CostAmounts> | CostAmounts`.
    - Re-exported `CostSource` and `Cost<T>` from `packages/ai/src/index.ts`.
  - [x] **4.4.2 Universal Accessor & Rate Estimation (`packages/ai/src/models.ts`)**:
    - Implemented generic `getCostValue<T>(cost: Cost<T> | T | undefined): T | undefined`.
    - Re-aliased `getModelCostRates` and `getUsageCostAmounts` through `getCostValue`.
    - Updated `calculateCost` to emit `{ source: "none", partial: zeroCostAmounts(), missingCount: 1 }` for unpriced models and `{ source: "aggregate", value: amounts }` for priced models.
  - [x] **4.4.3 Authoritative Wire Billing & Tier Multipliers (`packages/ai/src/providers/`, `packages/ai/scripts/`)**:
    - In `openai-completions.ts`: updated OpenRouter reported cost to set `{ source: "provider", value: amounts }`.
    - In `service-tier-pricing.ts`: updated `applyServiceTierPricing` to emit `{ source: "aggregate", value: amounts }`.
    - In `generate-models.ts`: updated `unknownPrice` models to emit `{ source: "none" }`.
    - In `model-catalog.ts`: updated `ModelCostSchema` to accept `source: "provider" | "aggregate" | "none"`.
  - [x] **4.4.4 Reversible Usage Ledger & Rollup Arithmetic (`packages/coding-agent/src/core/usage.ts`)**:
    - Refactored `costParts(cost)` to extract `{ partial: CostAmounts, missingCount: number }`.
    - Refactored `mergeCost(total, usage, sign)`: net partial sums clamped at 0; net missing counts clamped at 0; emit `missingCount > 0 ? { source: "none", partial, missingCount } : { source: "aggregate", value: partial }`.
    - Updated `sessionUsageSummaryFrom`, `emptyUsage`, `cloneUsage` to maintain `source: "aggregate"`.
  - [x] **4.4.5 Model Discovery & Session v4 Normalization (`packages/coding-agent/src/core/`)**:
    - In `model-registry.ts`: updated `refreshOpenAICodexModels` to assign `{ source: "none" }` to unpriced live models.
    - In `session-manager.ts`: updated `normalizeEntryUsageCosts` to map legacy untagged and transitional `status` shapes into `{ source: "aggregate" }` or `{ source: "none" }`.
  - [x] **4.4.6 UI Presentation & Extension Verification (`packages/coding-agent/src/modes/`, `examples/`)**:
    - Verified `model-selector.ts`, `context-tree-format.ts`, `custom-footer.ts`, and `subagent/index.ts` gracefully consume `getCostValue` / `getModelCostRates` / `getUsageCostAmounts`.
    - Ensured direct checks for unpriced models check `cost.source === "none"`.
  - [x] **4.4.7 Regression Suites, mcpls Verification & Quality Gates**:
    - Updated test assertions in `packages/ai/test/models-cost.test.ts`, `packages/ai/test/generate-models-exporter.test.ts`, `packages/coding-agent/test/usage.test.ts`, and `packages/coding-agent/test/session-manager/file-operations.test.ts`.
    - Verified 0 diagnostics via `mcpls` `get_diagnostics` across all modified files.
    - Ran focused Vitest suites to 100% green.
    - Ran `npm run check:test-policy` and full `npm run check` (0 errors).
    - Added changelog fragments in `packages/ai/.changes/cost-provenance-source.md` and `packages/coding-agent/.changes/cost-provenance-source.md`.
- [x] **Task 4.5: Hermetic Catalog Fixtures for CI**:
  - [x] **4.5.1 Diagnostic & Gap Analysis of Catalog Asset Dependencies**:
    - Audited test suites in `packages/coding-agent/test/` (`catalog-compat.test.ts`, `model-registry.test.ts`, `model-resolver.test.ts`, `catalog-assets.test.ts`) relying on `getBundledModels`.
    - Traced fallback behavior in `bundled-model-catalog.ts` and `service-catalog.ts` when catalog files are missing or unpopulated in fresh checkouts.
  - [x] **4.5.2 Expand Deterministic Fixture Coverage for Cost States**:
    - Updated `fixtureModel` and `fixtureCatalogBodies` in `packages/coding-agent/scripts/catalog-assets.mjs` to exercise all cost provenance variations (`source: "none"`, `{ source: "aggregate", value: ... }`, `{ source: "provider", value: ... }`).
    - Verified `validateBundledModelCatalog` accepts and validates `Cost<CostRates>` with non-negative finite rate checks on `value`/`partial` and integer checks on `missingCount`.
  - [x] **4.5.3 Self-Contained Test Harness Fixtures (`test/suite/harness.ts` & `test/utilities.ts`)**:
    - Provided in-memory/ephemeral catalog fixture helpers so tests never require uncommitted asset files, external network calls, or GitHub tokens.
    - Enforced test policy: CI tests must be unconditional, self-contained, and hermetic.
  - [x] **4.5.4 Fresh-Checkout / Isolated Build Verification**:
    - Verified that running `generateBundledCatalogAssets({ fixture: true })` produces 6 models including unpriced and openrouter wire-billed models.
    - Added tests in `packages/coding-agent/test/catalog-assets.test.ts` verifying provenance shapes and small fixture generation.
  - [x] **4.5.5 Compiler Verification & Quality Gates**:
    - Verified 0 errors via `mcpls` `get_diagnostics` on modified files.
    - Verified `npm run check:test-policy` passed.
    - Verified full `npm run check` passed (Biome 0 fixes, tsgo 0 errors).
    - Prepared changelog fragment in `packages/coding-agent/.changes/hermetic-catalog-fixtures.md`.
- [x] **Task 4.6: Cross-Provider Contract Extension (Roadmap & Architectural Specification)**:
  - [x] **4.6.1 Anthropic Discovery & Contract Audit**:
    - Audited `/v1/models` endpoint, API key (`x-api-key`) and OAuth headers (`claude-code-20250219`).
    - Established unlisted/fine-tuned Claude model mapping to `cost: { source: "none" }`.
  - [x] **4.6.2 Google Gemini Discovery & Contract Audit**:
    - Audited `/v1beta/models` endpoint and `x-goog-api-key` auth.
    - Established preview/project fine-tune model filtering and unpriced assignment to `cost: { source: "none" }`.
  - [x] **4.6.3 Ollama Local Discovery & Zero-Cost Contract Audit**:
    - Audited `/api/tags` and `/api/show` endpoints for local model listing and GGUF context length discovery.
    - Defined dual-tiered contract: authentic zero-cost (`{ source: "aggregate", value: zeroCostAmounts() }`) for local loopback; `{ source: "none" }` for remote proxies.
  - [x] **4.6.4 Cross-Provider Architectural Specification Synthesized**:
    - Formulated comprehensive architectural specification in `.planning/2026-09-26T013940Z-codex-live-model-discovery/cross-provider-discovery-spec.md`.
- [x] **Task 4.7: Branch Reconciliation & Gitignore Active Plan (Complete)**:
  - Added `.active_plan` to `.gitignore` (commit `3dd117167`).
  - Applied `git update-index --skip-worktree .planning/.active_plan` to avoid Husky hook collision.
  - Rebased branch `xonsh-repl` onto `xonsh-installer-port` at commit `3dd117167`.
  - Maintained `xonsh-repl` as the active working branch.
  - Recorded Section 十 in `scratchpad.md` in Classical Wenyan Chinese.

- [x] **Task 4.8: Compiler-Grade mcpls Symbol Audit of Scratchpad (Complete)**:
  - Audited all 17 code symbol references, functions, types, and line numbers across 7 files in `scratchpad.md` via `mcpls` tools (`get_document_symbols`, `get_hover`, `get_diagnostics`).
  - Verified 0 diagnostics across all modified and referenced files.
  - Recorded exact 1-based compiler addresses and verified `CostSource`, `Cost<T>`, `getCostValue`, `calculateCost`, `costParts`, `mergeCost`, and `ModelRegistry` addresses.
  - Inscribed Section 十一 into `scratchpad.md`.

- [x] **Task 4.9: Anthropic and Gemini live discovery (T10, T11, complete)**: commits `0021ce96e`, `d5a439a5a`, `580ecfa74`, `7fd323aef`. Limitations: findings.md §10 items 1-6.
- [x] **Task 4.10: Previously used models (T14, complete)**: commit `b62349ac5`. Scans session `model_change` entries, incremental disk cache, merged in `getAll` with single-key dedupe, `cost: { source: "none" }`. Includes object-identity stability (T14b/c) and live-metadata hints across `refresh()` (T14d). Limitations: findings.md §10 items 7-11.
- [x] **Task 4.11: Fix built-in LSP tool (T15, complete)**: user-level plugin `typescript7-lsp@ts7-lsp` (backup `~/.claude/settings.json.bak-20261002T204941`). `CLAUDE.md` (committed `150c9ff24`) documents it.
- [x] **Task 4.12: Ollama discovery (T12, complete)**: commit `fdab11e2f`. Seed required (models.json `ollama` provider); no `OLLAMA_HOST`/default-port probe. `/api/tags` (cap 50) + `/api/show` (concurrency 4, shared 2s deadline), fallback context 8192, `reasoning` from `capabilities` `thinking`, loopback hosts priced aggregate-zero, others `none`. Limitations: findings.md §10 items 15-19.
- [ ] **Task 4.13: Retirement of used models on "model not found" (404)**: deferred by user; proposed expectations (unconfirmed, do not implement) in scratchpad §十八.2.
- [x] **Task 4.14: Provider probes (shelved)**: user has no Gemini or Anthropic key; Gemini/Anthropic fields and the Anthropic OAuth path stay verified only against SDK types and docs (findings.md §10 items 1-3). Do not ask again.
- [x] **Task 4.15: Cache-behavior tests and shared discovery helper (T16, complete)**: commit `4b85e6323`; also `a100ee391` (used-models malformed-cache fix).
- [ ] **Task 4.16: Fix confirmed registry defects (T17)**: dispatched 21:22 PDT; see findings.md §11 items 1-5.
