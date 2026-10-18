# Codex live model discovery — final findings

This document summarizes the Phase 3/4 implementation. The session snapshot is in `.planning/2026-09-24-provider-model-discovery/session-state.json`; earlier research notes are in `.planning/2026-09-24-provider-model-discovery/findings.md`.

## 1. Delivered behavior

- Results from authenticated `GET {baseUrl}/codex/models?client_version=0.153.4` are merged into the model registry before shared-catalog publication. Catalog entries take precedence by ID; live-only slugs remain selectable.
- `ModelRegistry.refreshOpenAICodexModels()`, called by `refreshAvailableModels()`, feeds both `/model` (`getAvailable()`) and executable discovery (`getExecutableModels()`). This fixes the historical mismatch between the two paths (#702).
- Unknown prices are never treated as zero or borrowed. Live-only entries use `cost: { status: "unknown" }`. Usage aggregation tracks `pricedSubtotal` and a reversible `unknownContributors` count. Provider-reported charges, such as those from OpenRouter, remain authoritative over catalog estimates.
- The picker shows a non-modal “Price unknown” notice. Session tables show `price unknown`; context-tree totals show `unknown`. Known zero-cost models still display `$0`.

## 2. Cost contract

- `ModelCost = { status: "known"; rates } | { status: "unknown" } | CostRates`, with an analogous `UsageCost` union, is defined in `packages/ai/src/types.ts`. `getModelCostRates()` and `getUsageCostAmounts()` are the only sanctioned accessors.
- Boundary formats still accept untagged numeric costs: generated catalog data (`models.generated.ts`, never hand-edited), provider fixtures, and external `models.json` configuration. Runtime-computed values are tagged. This deliberate deviation avoids rewriting generated data and provider initializers without changing behavior; accessors keep the ambiguity local.
- Mutation tests verified the invariants: an unknown model cost yields `unknownContributors: 1` rather than NaN or zero; disabling v3-to-v4 conversion fails the legacy regression; reverting either display renderer fails its new test.

## 3. Registry discovery

- Live-only entries use existing custom-model defaults: reasoning disabled, text-only, `contextWindow: 128000`, and `maxTokens: 16384`. Source comments identify these as client policy, not Codex-reported capabilities. Only `slug` is verified wire data.
- The cache uses an HMAC fingerprint of `apiKey` and endpoint, with a five-minute TTL. Fetch failures and offline mode retain the last good result. Auth changes and `refresh()` reset live state. `find()` searches the combined registry, so overrides and lookups include live models.
- `ProviderConfigInput.cost` now accepts `Model<Api>["cost"]`, covering both cost shapes at the extension and registration boundary.

## 4. Persistence

Opening a v3 session atomically migrates it to v4. Numeric costs become tagged known costs; the migration does not invent historical unknown prices. It covers assistant, compaction, branch-summary, and child-attribution usage. All 57 tests passed with shuffle seeds 41 and 97.

## 5. Validation

| Check | Result |
|---|---|
| `pnpm exec tsgo --noEmit` | 0 errors (31 at baseline, 19 after worker changes, 0 after accessor migration) |
| `npm run check` | Passed twice: Biome, test policy, installer, push guard, and browser smoke checks |
| model-registry and catalog-compat, with full catalog assets via `PI_PACKAGE_DIR` | 69/69 passed |
| agent-session-recursion | 89/89 passed |
| context-tree and sessions-table, including new regressions | 63/63 passed |
| session file-operations, v4 | 57/57 passed |
| AI cost suite | 63/63 passed |
| Line budget | 380 production additions; 308 test additions, including new files |

## 6. Causal audit of nine baseline registry failures

We compared identical code and tests in the frozen pre-implementation snapshot (`/tmp/prime-registry-causal-shadhtwu`). Only `PI_PACKAGE_DIR` differed: one run lacked the public catalog asset; the other used it.

- **1 intended RED:** live-only model merging was not yet implemented.
- **7 environment failures:** `packages/coding-agent/catalog/models.bundled.json` was absent. The generated asset is not committed by policy, so the loader fell back to a small compiled transport template. Tests then found one Anthropic model and no OpenRouter models. Full assets remove these seven failures: results changed from 9 failures/47 passes to 2 failures/54 passes.
- **1 migration issue:** `applyModelOverride()` writes `{ status: "known", rates }`, but the `modelOverrides` test read `cost.input`. The test now checks the tagged shape.
- **Correction:** catalog generation required no credentials. The public fetch succeeded without a token and returned 1,197 models, 42 transport tuples, and 68 MCP services.

## 7. Pre-existing failures

`test/suite/agent-session-runtime.test.ts` has two failures in this environment:

- ENG-4620 model cycling returned `~anthropic/claude-fable-latest` instead of `gpt-5.3`.
- Cross-cwd session replacement timed out after 30 seconds.

A clean `git archive HEAD` extraction (`/tmp/prime-head-cf`) reproduced both failures (2/37). `_cycleAvailableModel()` calls `refreshAvailableModels()`, which fetches the provider catalog. OpenRouter `~…-latest` aliases, also present in `~/.prime/agent/models/provider-model-catalog.v1.json`, change the cycle order. The cycling test depends on live catalog contents. The cross-cwd timeout also reproduces at HEAD, but its cause is not established here.

## 8. Follow-ups (out of scope)

1. **Make tests hermetic.** Both the missing-catalog-asset issue (§6) and live-network dependency (§7) make fresh checkouts and CI sensitive to environment. Add deterministic catalog fixtures.
2. **Reduce picker latency.** `refreshAvailableModels()` now performs Codex discovery with a five-second timeout and five-minute cache. Failed requests are not negatively cached, so each refresh retries until one succeeds.
3. **Test the picker notice.** Current coverage checks the registry data (`cost: { status: "unknown" }`), not the rendered component. A component test was deferred to control line count and test cost.
4. **Restore the #702 release note.** The implementation worker shortened the detailed shipping comment in `model-registry.ts`; its two-edit release procedure remains only in git history.

## 9. Artifact index

- Frozen A/B audit: `/tmp/prime-registry-causal-shadhtwu` (`missing.log`, `full.log`)
- HEAD counterfactual: `/tmp/prime-head-cf` (`/tmp/t-head-runtime.log`)
- Full catalog assets: `/tmp/prime-codex-phase3-catalog` (`PI_PACKAGE_DIR` wrapper requires `src/` and `package.json`; see `assets-full`)
- Typecheck logs: `/tmp/codex-phase3-types{,-now,-3}.log`; final check: `/tmp/codex-phase3-final-check.log`
- Worker reports: `registry-worker.md`, `persistence-worker.md`, and `persistence-check.log`. The AI worker report was not written; its evidence is in test results.
- Changelog fragments: `packages/{ai,coding-agent}/.changes/codex-live-model-discovery.md`

## 10. Known limitations: multi-provider discovery and used models (T10-T15)

Commits (unpushed): `0021ce96e` Anthropic, `d5a439a5a` OAuth user-agent, `580ecfa74` generator skips deprecated, `7fd323aef` Gemini, `b62349ac5` used models.

**Unverified against live APIs** (no Anthropic key available; probe `./probe-models.sh` never run):
1. Anthropic `/v1/models` and Gemini `/v1beta/models` field names rest on SDK types and docs. A wrong name silently falls back to defaults (Anthropic 200k context / 8192 max tokens; Gemini 1,048,576 / 8192) and no test can catch it.
2. Anthropic OAuth path (`Authorization: Bearer`, beta header, `user-agent: claude-cli/<ver>`, `x-app: cli`) is copied from `packages/ai/src/providers/anthropic.ts`, not exercised live.
3. Whether aliases (Anthropic) and `-latest` ids (Gemini) appear in live responses is unknown.

**Deprecation:**
4. Neither API exposes a machine-readable deprecation signal (Gemini `models.get` has no `modelStatus`; Anthropic `ModelInfo` has none). A deprecated model still returned by the API appears with unknown cost. The generator skip (`status === "deprecated"`) is a no-op today (models.dev lists no deprecated Anthropic entries). Retirement is deferred; a future "model not found" (404) response is intended to trigger it.

**Heuristics and caps:**
5. Gemini exclusion is an id regex (`live|deep-research|computer-use|image|tts`) because the list response has no output modality. Checked only against 17 bundled Google entries (zero false exclusions); models.dev not checked offline.
6. Gemini paging stops at 10 pages. Anthropic requests `limit=1000` and does not follow `has_more`.

**Used models (`used-models.ts`, `getAll`):**
7. Entries are synthetic: `name = id`, `reasoning: false`, `input: ["text"]`, 128000 / 16384, `cost: { source: "none" }`. `headers`/`compat` borrowing and these defaults are not individually tested.
8. A used model whose provider has no seed model is skipped. Removed local/Ollama/custom models stay selectable and fail on use.
9. `liveModelHints` keeps live-discovered metadata across `refresh()`. It is cleared on `authStorage.onChange` only; if another process changes keys and this process gets no `onChange`, stale `reasoning`/`contextWindow` can persist until the next discovery (only for ids in local session history).
10. `usedModelObjects` retains entries for removed keys (small). Cold scan of ~425 sessions / 182MB took ~414ms, warm ~23ms (measured once). In-memory registries skip the scan.
11. Identity: `usedModelFor` is stable while the seed object is unchanged; a catalog reload rebuilds once, costing at most one extra `agent.state.model` write and one extra daemon summary diff (`agent-session.ts:10702`, `daemon-session-list.ts:450`). xai subscription models are already identity-unstable (pre-existing).

**Test and structure debt:**
12. `refreshAnthropicModels` and `refreshGoogleModels` duplicate ~30 lines of cache/fingerprint/TTL/auth-recheck logic. Seven cache behaviors (TTL comparison, offline check, auth re-check, keep-stale-on-failure, `refreshedAt`, key mismatch, always refetch) have no test. A shared helper (T12a) was tried, grew source by 12 lines, and was reverted; revisit after Ollama (T12) with those tests.
13. Ollama discovery (T12) not started.
14. Built-in `LSP` tool had been failing (TypeScript 7 has no `tsserver.js`); fixed at user level with `typescript7-lsp@ts7-lsp` (`/usr/sbin/tsc --lsp --stdio`). Workers still skipped LSP twice; reports must list actual LSP calls.

**Git:** `xonsh-repl` is ahead 254 / behind 20 vs `origin/xonsh-repl` after the rebase; pushing needs a force push, which is forbidden without explicit instruction.

**Ollama (T12, commit `fdab11e2f`):**
15. Needs a configured `ollama` provider in `models.json`; with none, nothing is probed (no `OLLAMA_HOST`, no default `localhost:11434` probe). Differs from spec §3.3.
16. Discovery shares one 2s deadline; once it expires the remaining `/api/show` calls fall back to defaults (context 8192) and that degraded result is cached for 5 minutes. A freshly pulled model can take up to 5 minutes to appear. Cap 50 models, `/api/show` concurrency 4 (cap, concurrency and timeout behavior untested).
17. Context window comes from `model_info`, not the Modelfile `num_ctx`, so it may exceed the context the server actually uses. Used-model placeholders use 128000 while live Ollama fallbacks use 8192 (inconsistent for a used model that is currently not served).
18. Cost: loopback host (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`) -> `{ source: "aggregate", value: zeros }`; any other or unparsable host -> `{ source: "none" }`. A remote Ollama behind a loopback tunnel would be priced free. `tools` capability is not mapped (no field on `Model`).
19. Fields rest on Context7 Ollama docs only; no real Ollama server was used. The `refresh()` hint path for Ollama and the TTL/offline/re-check branches are untested (T16).

## 11. Independent review of `3dd117167..fdab11e2f` (2026-10-02 21:18 PDT)

Read-only reviewer with LSP; findings triaged:

**Fixed (working tree, not yet committed; to be committed together with T17 to satisfy the line-count policy):**
- `used-models.ts` `listUsedModels`: a structurally plausible but malformed cache (`{"files":{"a":{"models":5}}}`) threw in the `ModelRegistry` constructor and `refresh()`. Now skips non-array `models` and non-string provider/modelId. Test added (mutation-checked).

**Confirmed defects in `model-registry.ts` (assigned to T17, after T16):**
1. Ollama: one shared 2s deadline for `/api/tags` and all `/api/show`; after it expires, degraded entries (text-only, 8192, embedding models kept) are cached for 5 minutes.
2. `liveModelHints` survives `models.json` edits (only `authStorage.onChange` clears it), so used models can keep an old `baseUrl`/`headers`.
3. Cache fingerprints (all three providers) exclude `auth.headers`; header-authenticated providers can serve another account's list for 5 minutes. Cached model objects keep their creation-time `baseUrl`/`headers`/`compat`.
4. Race: an in-flight fetch finishing after `refresh()` writes back stale `live*Models`.
5. No failure back-off: each `refreshAvailableModels` can block up to 5s on a network black hole (Google up to ~50s over 10 pages).

**Reported, trade-off (needs a decision):**
6. `usedModelFor` borrows `api`/`baseUrl`/`compat` from the first seed of the provider; wrong `api`/`compat` for mixed-API providers (github-copilot, opencode).
7. No response size cap; catch-all swallows hide real bugs.
8. Anthropic live entries do not copy `seed.headers`/`compat` (inconsistent with Ollama and used models).
9. `refreshUsedModels` is not awaited by `refreshAvailableModels` (first call may miss newly scanned models); `scanUsedModels` re-reads a whole session file when it grows; `readLinesAsBuffers` has no line-length cap; the marker prefilter assumes compact JSON.
10. Ollama context window is the training maximum (`model_info`), not the runtime `num_ctx`.

**Checked, no issue:** Gemini key stays in the header, no key in URLs, logs, errors or the cache file; the Ollama `next++` worker loop is race-free in a single thread; `[::1]` hostname handling; atomic cache write under two processes (last writer wins, cache rebuilds); getAll dedupe precedence; in-flight key change is caught by the re-check.

**Not verified by the reviewer:** whether an external `auth.json` edit fires `onChange`; whether a first model recorded only in a session header (no `model_change`) is missed; real API behavior.

**Housekeeping flagged:** `anthropic.ts` has an orphaned `// Stealth mode…` comment after the version constant moved; `CLAUDE.md` names a machine-specific path and plugin (intentional for this repo's LSP setup).
