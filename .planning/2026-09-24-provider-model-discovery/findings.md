# Provider model discovery findings

- **Most providers:** Runtime models come from the public Prime Agent catalog at `https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent-catalog/main/models/catalog.v1.json`, not a live request to each provider. `ModelRegistry` refreshes stale data when models load, then hourly. Auth changes force a refresh. The cache serves models offline or when refresh fails. See `packages/coding-agent/src/core/provider-model-catalog.ts` and `packages/coding-agent/src/core/model-catalog-cache.ts`.
- **OpenAI Codex:** `ModelRegistry.getExecutableModels()` separately calls the Codex `/codex/models?client_version=0.153.4` endpoint when Codex auth and an account ID are available. It filters catalog Codex models against that response and caches results for five minutes per token. It does **not** call OpenAI's general `/v1/models` endpoint. See `packages/coding-agent/src/core/model-registry.ts` (`openAICodexModelsUrl`, `getExecutableModels`).
- **Other live catalogs:** Prime Inference fetches `https://api.pinference.ai/api/v1/models`; the model exporter fetches OpenRouter's `/api/v1/models` and `https://models.dev/api.json`. These sources are separate from the runtime's shared catalog. See `packages/coding-agent/src/core/prime-inference-model-catalog.ts` and `packages/ai/scripts/generate-models.ts`.
- **Exporter timing:** Model generation is explicit. The AI package build uses committed generated model data; it does not fetch provider lists on every build (`packages/ai/CHANGELOG.md`).

## Requested feature and requirements

- Scope is OpenAI Codex model discovery, not a live-discovery rewrite for every provider.
- A model returned by the authenticated Codex endpoint should appear in `/model` and remain selectable before it enters the shared Prime Agent catalog.
- Models with unknown prices must remain selectable. Show a clear, quiet, non-modal warning. Do not block selection or interrupt the user with a dialog.
- Keep discovery low-cost. Reuse the authenticated metadata endpoint and its five-minute per-token cache. Discovery uses metadata, not a model completion. Provider billing for the lookup has not been verified.
- Do not label unknown model pricing as zero or copy another model's price as if it were known. The representation must not misstate usage or cost totals.

## Structural flow confirmed with tree-sitter queries and jq

These reproducible ast-grep patterns use the TypeScript tree-sitter parser and emit JSON. `jq` extracts concise call-site reports:

```sh
ast-grep run -l ts -p '$R.getAvailable()' --json=compact packages/coding-agent/src packages/coding-agent/test \
  | jq -r '.[] | [.file, (.range.start.line + 1), .text] | @tsv'

ast-grep run -l ts -p '$R.getExecutableModels()' --json=compact packages/coding-agent/src packages/coding-agent/test \
  | jq -r '.[] | [.file, (.range.start.line + 1), .text] | @tsv'

ast-grep run -l ts -p 'const $X = $A.filter(($M) => $M.provider === "openai-codex")' --json=compact packages/coding-agent/src \
  | jq -r '.[] | [.file, (.range.start.line + 1), .text] | @tsv'

ast-grep run -l ts -p '$M.cost' --json=compact packages/ai/src packages/coding-agent/src \
  | jq -r '.[] | select(.file | test("models\.ts|model-selector|model-registry|core/usage")) | [.file, (.range.start.line + 1), .text] | @tsv'
```

Observed call sites:

- `$R.getAvailable()` finds the interactive model picker at `packages/coding-agent/src/modes/interactive/components/model-selector.ts:340`.
- `$R.getExecutableModels()` finds the RLM caller at `packages/coding-agent/src/core/agent-session.ts:12723` and tests in `packages/coding-agent/test/model-registry.test.ts`.
- The Codex filter pattern finds the `getExecutableModels()` filtering step in `packages/coding-agent/src/core/model-registry.ts:1243`.
- `$M.cost` confirms cost data flows through model selection and usage calculation. A fallback must not present unknown pricing as precise or free.

`ModelRegistry.getExecutableModels()` currently fetches Codex model IDs and filters the existing `getAvailable()` models by ID. It does not construct models for IDs absent from the shared catalog. The AI `Model` shape also carries pricing and execution metadata.

## Deeper metadata and cost audit

- The live Codex response parser currently retains only `models[].slug` (`packages/coding-agent/src/core/model-registry.ts:412-424`). A test mocks exactly `{ models: [{ slug }] }` (`packages/coding-agent/test/model-registry.test.ts:1275-1280`). Any additional response metadata is currently discarded.
- The official OpenAI public `GET /v1/models` docs list identifiers, creation timestamps, owner, and shutdown date; they do not describe pricing, context windows, or capabilities. This is not the same service as the authenticated ChatGPT/Codex `/backend-api/codex/models` endpoint, so do not substitute the public endpoint for Codex discovery.
- The `codex-rs` read-only trace found that the default OpenAI API-key route uses the ChatGPT/Codex model endpoint; its client parses a `ModelsResponse`, captures ETag, and the manager merges fetched model records with a bundled baseline and caches by provider/auth/version identity. See `codex-rs/model-provider/src/models_endpoint.rs:90-135,150-188`, `codex-rs/codex-api/src/endpoint/models.rs:33-46,69-90,97-124`, and `codex-rs/models-manager/src/manager.rs:258-331,480-549,565-644`. `protocol/src/openai_models.rs:402-511` describes rich fields such as slug, display name, reasoning levels, context window, API visibility, and input modalities, but no price field. Use this as an implementation comparison. Verify wire fixtures before mapping fields; do not treat it as an authoritative price source.
- The rust MCP/MCPLS service in this session is not rooted at `codex-rs`: MCPLS reports `path outside workspace`; setting the Rust Analyzer MCP workspace exited before responding. The `codex-rs` call chain is therefore source-inspected and cited, not compiler-navigation-verified. Future semantic follow-up needs a functioning MCPLS/Rust Analyzer instance rooted at `codex-rs`.
- `Model.cost` requires four numeric rates (`packages/ai/src/types.ts:427-445`); catalog validation requires finite, nonnegative values (`packages/ai/src/model-catalog.ts:28-43`). `calculateCost()` always multiplies those rates into numeric usage totals (`packages/ai/src/models.ts:96-106`). Codex Responses initializes numeric zero cost then calls that calculation (`packages/ai/src/providers/openai-responses-shared.ts:513-526`). Zero cannot represent unknown pricing. `null` or NaN would require explicit type and consumer changes.
- Unknown pricing affects more than the picker: usage aggregation/cloning, session summaries, telemetry, session tables, and context-tree totals all currently assume numeric totals (`packages/coding-agent/src/core/usage.ts:3-75`, `core/telemetry.ts:164-189`, `core/session-manager.ts:1686`, `cli/sessions-table-format.ts:103-107`, and `modes/interactive/components/context-tree-format.ts:57,115-182`). The selector's price formatter can show missing or non-finite values as `—`, but typed models currently require numeric costs (`modes/interactive/components/model-selector.ts:865-875`).

## Phase 2 design proposal — approved by user on 2026-09-24

### Alternatives considered

- **Zero or NaN sentinel:** reject. Zero falsely signals free usage; NaN is not a typed, serializable pricing state.
- **Nullable numeric rates:** explicit per field, but forces per-rate unknown counts and partial-cost semantics through every aggregate. Current model pricing requires all four rates, so that flexibility is unnecessary.
- **Tagged known/unknown state with reversible unknown-contributor accounting:** recommended. It distinguishes known zero from unknown, supports reliable subtraction, and matches the all-rates-known catalog contract.

### Proposed contracts

```ts
type CostRates = { input: number; output: number; cacheRead: number; cacheWrite: number };
type CostAmounts = CostRates & { total: number };
type ModelCost =
  | { status: "known"; rates: CostRates }
  | { status: "unknown" };
type UsageCost =
  | { status: "known"; amounts: CostAmounts }
  | { status: "unknown"; pricedSubtotal: CostAmounts; unknownContributors: number };
```

`Model.cost` uses `ModelCost`; token counts stay numeric. A single unpriced assistant response starts with `status: "unknown"`, a zero `pricedSubtotal`, and `unknownContributors: 1`. `calculateCost()` preserves that state. The subtotal exists only to make aggregation reversible; no display or telemetry may report it while the count is nonzero.

### Aggregation, provider billing, and durable data

- Add/merge sums known amounts and unknown counts. Subtract reverses both; when the unknown count reaches zero, the remaining subtotal becomes a known amount. Counts clamp at zero consistently with existing usage rollback. Clone/empty helpers preserve the invariant. An authoritative per-call charge (for example OpenRouter's reported usage cost) produces a known usage even if model rates are unknown; it must not be replaced with a catalog estimate. Tier-pricing transforms only known amounts and leaves unknown state unknown.
- Assistant usage is stored in session JSONL. Bump the session format to v4 and migrate v3 numeric costs to the known branch; legacy files have no information that can recover historical unknownness. Persist tagged per-message cost so later session rollups retain uncertainty. Keep `SessionUsageSummary` as a safe known-total/unknown summary rather than exposing a partial subtotal.
- Telemetry currently emits token metrics but no monetary totals. Keep it that way for this feature; update internal aggregation, preserve token metrics, and never serialize a known subtotal as actual spend.

### User-visible behavior and validation scope

- Live-only Codex models get `ModelCost.unknown`; catalog-backed prices remain known and take precedence when available. Do not copy another model's rates. The selector shows a concise inline “price unknown” notice with no modal, toast, or automatic selection.
- Usage/context-tree totals, session-table cells, and `getSessionStats` must show unknown rather than `$0` whenever any included response is unpriced. Known zero remains `$0`.
- Test known/unknown cost calculation, authoritative reported-cost override, add/merge/subtract/clone behavior (including removal restoring a known total), v3 session migration and v4 persistence, and unknown-price picker/summary displays. Use local fixtures only; do not call provider APIs. Add changelog fragments for `packages/ai` and `packages/coding-agent` if the user-visible feature proceeds.

Implementation spans the shared AI model/usage contract and cost calculation (`packages/ai`) plus Codex model construction, usage rollups, session migration, telemetry aggregation, and displays (`packages/coding-agent`). The user approved this design on 2026-09-24. Implementation is underway; the current worktree has a partial cost-contract migration and no live-only model merge yet.

## Python binding and JMESPath helper

- `scripts/query_cost_calls.py` uses `ast_grep_py` to find `calculateCost($MODEL, $USAGE)` across `packages/ai/src` and `packages/coding-agent/src`, then applies compiled JMESPath expression `[*].[file, line, text]` and prints TSV. It defaults to the repository root and accepts `--root` for fixture-based testing.
- Its five output rows matched the earlier AST-grep CLI and Python-binding results. The focused process-level test is `scripts/tests/test_query_cost_calls.py`; the installed `jmespath` 1.1.0 and `ast_grep_py` system-Python packages are used without adding project dependencies.

## Juicy AST query notebook

These additional queries reproduce the schema and cost-flow checks; output is JSON filtered by `jq`:

```sh
ast-grep run -l ts -k function_declaration --json=compact packages/coding-agent/src/core/model-registry.ts \
  | jq -r '.[] | select(.text | test("readOpenAICodexModelIds")) | [.file, (.range.start.line + 1), .text] | @tsv'

ast-grep run -l ts -p 'calculateCost($MODEL, $USAGE)' --json=compact packages/ai/src packages/coding-agent/src \
  | jq -r '.[] | [.file, (.range.start.line + 1), .text] | @tsv'

ast-grep run -l ts -p '$X.cost.total' --json=compact packages/ai/src packages/coding-agent/src \
  | jq -r '.[] | [.file, (.range.start.line + 1), .text] | @tsv'
```

## Quick reference for follow-up agents

- Prime Agent workspace: `/home/jeff/code/fork/prime-agent`; discovery implementation: `packages/coding-agent/src/core/model-registry.ts`; selector: `packages/coding-agent/src/modes/interactive/components/model-selector.ts`; shared cost calculation: `packages/ai/src/models.ts`; rollups: `packages/coding-agent/src/core/usage.ts`.
- Codex Rust comparison workspace: `/home/jeff/code/fork/codex/codex-rs`; endpoint route/client: `model-provider/src/models_endpoint.rs`, `codex-api/src/endpoint/models.rs`; wire model schema: `protocol/src/openai_models.rs`; merge/cache/picker flow: `models-manager/src/manager.rs`, `app-server/src/model_catalog.rs`, `tui/src/chatwidget/model_popups.rs`.
- Use `ast-grep` TypeScript patterns with `--json=compact`, then parse/filter with `jq`; the runnable snippets above map selection, filtering, parser, and cost paths.
- MCPLS uses 1-based positions and semantic tools for definitions/references/call hierarchy. The configured MCPLS workspace here is Prime Agent, so external `codex-rs` files fail with `path outside workspace`; the Rust Analyzer workspace switch also failed. Do not claim external call chains are MCPLS-verified until a correctly rooted server works. Source locations in this note were inspected and cited as a fallback.
- Constraint recap: no real API calls; unknown-price models stay selectable; warning stays inline/non-modal and unobtrusive; never turn unknown price into zero or copied rates; no implementation until the design is approved.

## Xonsh and Plumbum pipeline note

- The user reported Xonsh `0.24.2` at `/usr/lib/python3.14/site-packages/xonsh/__init__.py`, with working directory `/home/jeff/code/fork/prime-agent`.
- The user's `$(date +%s)` experiment went through `/bin/bash`: Bash expanded the substitution, then attempted to execute the resulting timestamp as a command (exit 127). A bare `date +%s` succeeded. Do not run Xonsh syntax through `bash()`; use the native Xonsh REPL for Xonsh expressions. `bash()` is specifically Bash.
- Direct Xonsh 0.24.2 checks: `!(...)` returns a `CommandPipeline`; `![...]` returns a `HiddenCommandPipeline` and streams output. Xonsh documentation may differ by version, so check the installed runtime/version.
- In Xonsh 0.24.2, `CommandPipeline.returncode` and `itercheck()` check the final process, not all pipeline stages. A direct `false | true` probe returned status 0 and `itercheck()` did not flag the first stage. For AST-grep-to-jq pipelines, separate the producer and consumer when producer failures must be detected. Source: `xonsh/procs/pipelines.py` (`returncode` and `itercheck`).
- Plumbum is useful for a reusable Python helper: bound command arguments avoid shell quoting, and `run(retcode=None)` provides `(exit_code, stdout, stderr)`. For a one-off Xonsh query, native Xonsh is simpler and avoids adding a dependency. Plumbum docs note that a command pipeline captures stderr only from its final stage; separate steps when detailed error reporting matters.
- DeepWiki is useful for targeted lookup, but version-specific claims need checking. In this investigation it incorrectly said `![...]` returns `CommandPipeline`, that `itercheck()` checks all pipeline stages, and that single quotes suppress `$NAME` expansion. Atomic queries were easier to evaluate, but did not guarantee accuracy. Cross-check against Context7, GitHub source, or the installed Xonsh runtime.
- `ast_grep_py` is installed in system Python 3.14, while the agent kernel uses Python 3.11 and cannot import it. Use the system `python` command from the native Xonsh REPL rather than installing this external package into the agent kernel. A temporary script piped as `python script.py | jq ...` worked.
- Verified binding query: `SgRoot(source, "typescript").root().find_all(pattern=...)`; `Range.start.line` is zero-based and `Pos` exposes `column` (not `col`). Serialized binding records used a `.line` field, so the jq path differed from ast-grep CLI JSON (`.range.start.line`). After adjusting the filter, the binding and CLI produced identical match rows for `calculateCost($MODEL, $USAGE)` across the selected TypeScript sources.
- String boundary: build the pattern and jq program as Python strings, then pass them with Xonsh `@(...)` injection. The captured ast-grep argv contained the exact single argument `calculateCost($MODEL, $USAGE)`; the jq argv likewise contained the intended filter unchanged. No escaping of the metavariable dollar signs was needed. `$(...)` is subprocess capture syntax in Xonsh, not string escaping; Bash treats it as command substitution.
- Verified Xonsh 0.24.2 quoting: quotes shield text from Xonsh syntax parsing (for example, quoted `${` avoids a syntax error) and keep it in one argument. This does not disable regular environment-variable substitution: both single- and double-quoted subprocess strings expanded `$HOME` to `/home/jeff`. A raw string (`r'...'`) and a Python value injected with `@(...)` preserved `$HOME` literally. In the `printf` probe, regular and injected arguments contained one backslash; the raw literal preserved both backslashes present in its source. `repr()` displays each backslash as `\`, so the printed representation has twice the visible slashes. Prefer `@(value)` for dynamic data, and use Python raw strings when raw backslashes/environment text are intended.
- Ran 18 separate, non-compound DeepWiki questions about Xonsh strings/operators, spaced at least 8 seconds apart with exponential retry backoff. All 18 succeeded on the first attempt. Queue is empty. The saved answers are in `deepwiki-xonsh-string-query-results-20260925T081201Z.jsonl`; the question list is in the matching `...-queue-20260925T081201Z.json` file.
- A real failing ast-grep-to-jq pipeline reported final status 0 while its stage statuses were `[1, 0]`; producer stderr streamed separately and was absent from the captured final `.err`. Inspect every `pipeline.procs` status or run stages separately when diagnosing failures.

## Implementation checkpoint — 2026-09-24

- Implemented so far: tagged unknown pricing in `calculateCost()`, cost accessors, reversible known/unknown usage aggregation, and partial provider/session/display updates. The focused unknown-cost calculation and add/subtract tests passed RED→GREEN.
- Added, but not implemented: a mocked live-only Codex model registry test. It currently fails because `refreshModelCatalog()` and `getExecutableModels()` do not add model objects for unknown live slugs.
- The current `ModelCost`/`UsageCost` types also accept untagged numeric known-cost values. This is a provisional accommodation for the existing generated catalog format; it differs from the strict proposed union above. Review it before treating the cost contract as complete.
- Latest `pnpm exec tsgo --noEmit` exits 2 with 31 errors across 18 files. These include stale numeric cost reads in tests/examples and `ProviderModelConfig`/`ProviderConfigInput` type mismatches. No full check has passed after the changes.
- `npm run check` reached Biome and test-policy successfully, then failed in TypeScript during the incomplete migration. Do not claim full validation.
- `test/model-registry.test.ts`: 47 passed, 9 failed. The live-only regression is the intended RED. Eight existing OpenRouter cases also fail; a direct bundled-model query returned no OpenRouter entries in this checkout. Verify catalog test setup or baseline before acceptance.
- No live provider calls were made, defaults were not changed, and no commit was created. The user's unrelated worktree files and `.planning/.active_plan` were left untouched.

## Remaining

- First resolve the current type errors, beginning with provider-config model cost types, then rerun type checking.
- Add failing regressions before retaining the current selector, context-tree, session-summary, or display changes.
- Finish live Codex model construction/merge, cache and fallback behavior, authoritative reported-cost handling, and session v3-to-v4 migration.
- Validate any Codex wire metadata beyond `slug` only against checked-in fixtures; do not infer it from the `codex-rs` schema or make live provider calls.

## Session note

- The separate user-default issue is resolved by global settings (`defaultProvider: openai-codex`, `defaultModel: gpt-6-luna`). It is not part of this feature. Phase 3 is in progress; see the implementation checkpoint above. No provider API calls were made.

## Resumed implementation decision

- Slug-only live models need execution fields required by Model. Reuse existing custom-model client defaults (text-only, reasoning disabled, context 128000, output limit 16384) as explicit fallback policy, not verified provider metadata. Catalog-backed metadata takes precedence. Prices remain unknown. Worker decision recorded in `registry-parent-decision.md`.

## Registry audit correction

- The source `packages/coding-agent/catalog/models.bundled.json` does NOT exist. Therefore do not attribute current failures to that asset being accepted. Need trace compiled fallback and environment/package resolution. Public catalog generation to isolated `/tmp/prime-codex-phase3-catalog` succeeded: 1197 models / 42 transport tuples / 68 MCP services.

- Source asset absence takes bundled loader catch → installedModels from AI compiled `MODELS`. Generated file explicitly stores tiny transport templates: one Anthropic entry. Registry tests use getAll/find, not auth-filtered getAvailable, so credentials cannot explain these eight failures.
- Frozen pre-worker registry and test snapshot in `/tmp/prime-registry-causal-shadhtwu`. Counterfactual runs will differ only in PI_PACKAGE_DIR missing vs full public catalog, avoiding live worker edits and worktree asset mutations.

## Frozen comparison verdict (/tmp/prime-registry-causal-shadhtwu)

- Identical frozen registry/test code, only `PI_PACKAGE_DIR` differs.
- Assets absent (compiled tiny fallback): 9 failed / 47 passed — matches worker baseline exactly (6 OpenRouter + 2 Anthropic multiplicity + live-only RED).
- Full public catalog assets: 2 failed / 54 passed — the 8 catalog-dependent failures vanish. Remaining: live-only Codex RED (feature unimplemented in snapshot) plus one more (identified in full.log).
- Conclusion: the eight non-RED failures are an environment/setup effect (un-committable generated catalog asset absent in this checkout), not product regressions. Root fix direction: deterministic catalog fixture wiring for tests, not code changes.

## agent-session-runtime pre-existing failures (proven at HEAD)

- `test/suite/agent-session-runtime.test.ts` fails 2 tests in this environment: ENG-4620 cycling (got `~anthropic/claude-fable-latest`, expected `gpt-5.3`) and cross-cwd session replacement (30s timeout).
- Counterfactual: extracted `git archive HEAD` into /tmp/prime-head-cf (symlinked node_modules) and ran the same file — identical 2 failed / 37 passed. These failures predate all session changes.
- Root cause: `_cycleAvailableModel()` cycles `refreshAvailableModels()`, which live-fetches the provider model catalog over the network. OpenRouter `~…-latest` alias ids (present in the remote catalog and the user cache `~/.prime/agent/models/provider-model-catalog.v1.json`) changed the available-model order. The suite is not hermetic against catalog content; it needs catalog fixture isolation (same class of issue as the model-registry catalog-asset dependency).
