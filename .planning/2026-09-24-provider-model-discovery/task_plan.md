# Codex live model discovery

## Goal

Make models returned by the authenticated Codex endpoint selectable in `/model` before they enter the shared Prime Agent catalog. Keep unknown-price models selectable and show a clear, quiet, non-modal warning. Never present unknown prices as free or imply a price by borrowing another model's rates.

## Phases

### Phase 1 — Current flow and user requirements

Status: complete

- Read `.planning/2026-09-24-provider-model-discovery/findings.md` and trace existing catalog behavior.
- Confirmed the user wants live Codex models visible/selectable before catalog publication.
- Confirmed unknown-price models remain selectable; show a non-modal, non-disruptive warning.
- Trace picker, RLM discovery, and cost data with tree-sitter-backed AST queries and JSON filtering. Save the cost-call query in `scripts/query_cost_calls.py` with `ast_grep_py` and JMESPath.

### Phase 2 — Design safe metadata and unknown pricing behavior

Status: complete; approved by user

- Treat the authenticated Codex endpoint's `slug` as the verified identity field. Map optional runtime metadata only when supported by checked-in fixtures; do not assume the `codex-rs` schema exactly matches the wire response or derive price from it.
- Use tagged known/unknown states for model prices and usage costs; keep token counts numeric and ensure unknown contributors propagate through reversible aggregates.
- Preserve authoritative per-call billing reported by a provider even when catalog model rates are unknown; never infer or borrow another model's rates.
- Preserve catalog metadata and prices when available. Show unknown prices as a quiet inline picker notice.
- See “Phase 2 design proposal” in `findings.md` for type, persistence, telemetry, display, and test details. The user approved it on 2026-09-24. Phase 3 tracks implementation.

### Phase 3 — Implement Codex live models in the registry and picker

Status: complete

- [x] User approved the Phase 2 design on 2026-09-24.
- [x] Add unknown model/usage cost representations and `calculateCost()` behavior; the focused regression passes.
- [x] Add reversible unknown-contributor accounting; the add/subtract regression passes.
- [x] Resolve the remaining type errors (31 -> 0) and review the provisional numeric branches: retained deliberately at boundary formats (generated catalog, provider fixtures, external config); runtime unknown states are always tagged.
- [x] Merge live Codex models into `/model` and RLM executable-model discovery via one shared refresh using the authenticated endpoint and five-minute per-credential cache.
- [x] Preserve catalog-backed metadata/prices (catalog wins by id); live-only entries use approved client-default policy with unknown cost; auth-missing, cache, malformed-response, offline, and auth-change cases handled.
- [x] Regressions for unknown-cost displays in sessions table and context tree, mutation-proven (reverting display logic fails exactly the new tests). Picker notice covered at registry level; component-level rendering test deferred (line budget + harness cost).
- [x] Session v3-to-v4 migration and persistence coverage (57 tests, mutation-proven conversion).
- Do not change provider defaults or auto-select a newly discovered model.

### Phase 4 — Tests, docs, and validation

Status: complete

- [x] Focused deterministic tests using mocked/faux provider responses; no real provider APIs called.
- [x] Covered live-only visibility/selection, unknown-price accounting, caching, and failure fallback (model-registry 69/69 with full-catalog assets, ai 63/63, usage/session suites green).
- [x] All modified test files run from package root; `npm run check` and `check:test-policy` fully green.
- [x] Changelog fragments added for coding-agent and ai (`.changes/codex-live-model-discovery.md`).

## Decisions

- Discovery scope: OpenAI Codex only.
- A model present in the authenticated live Codex response can appear in `/model` and be selected before shared-catalog publication.
- Unknown price must be disclosed non-modally; it must not be treated as zero or copied from another model as if authoritative.
- Discovery must use low-cost metadata lookups. It must not trigger completions or change the selected or default model.
- For Xonsh-specific investigation, execute Xonsh syntax in the native Xonsh REPL. Do not send it through `bash()`; Bash interprets `$(...)` differently.
- In Xonsh subprocess mode, quotes shield syntax-collision text and group it as one argument, but regular quoted strings still expand `$NAME`. Use `@(value)` or an appropriate raw string when environment text must stay literal. Verify behavior against the installed Xonsh version.

## Design constraints

The Phase 2 proposal in `findings.md` was approved by the user on 2026-09-24. Wire metadata beyond the currently verified `slug` must be validated against checked-in fixtures before mapping it; `codex-rs` structures are reference material, not proof of the Codex endpoint payload.

## Next Step

Review the provisional shared cost contract and resolve remaining type diagnostics. Registry and session persistence implementation are delegated with disjoint ownership; inspect their reports before integration.


## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Targeted edit failed while appending interim validation notes because the requested old text was absent | 1 | Wrote the already-computed progress content directly with `Path.write_text` |
| Interim `npm run check` reported type errors during the incomplete tagged-cost migration | 1 | Implemented core helpers and reduced diagnostics; latest `pnpm exec tsgo --noEmit` still reports 31 errors across 18 files, so migration remains incomplete |
| Targeted edit call failed twice because `new_str` was passed positionally instead of by keyword | 2 | Switched to direct, exact `Path.read_text()`/`write_text()` edits |
| Scripted replacement assertion failed while reshaping the private Prime cache writer | 1 | Re-read the exact source block and applied a narrower exact replacement |
| Full `model-registry.test.ts` run reported 9 failures (47 passed); the new live-only regression is expected RED, while 8 existing OpenRouter cases fail | 1 | Directly inspected bundled models and found no OpenRouter entries in this checkout; record as an unresolved catalog-fixture/environment issue, not a product fix |

| Audit assumed source catalog asset existed; read raised FileNotFoundError | 1 | Source asset is missing; inspect actual bundled-loader fallback and compiled definitions rather than assume fixture asset selection |
