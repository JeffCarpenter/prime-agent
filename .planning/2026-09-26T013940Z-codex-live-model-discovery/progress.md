# Progress: Codex Live Model Discovery & Cost Prudence

## Current State
- **Active Plan**: `.planning/2026-09-26T013940Z-codex-live-model-discovery`
- **Source Scratchpad**: `scratchpad.md` (策論劄記：模型博覽與計貲存疑之道)
- **Commits Executed**:
  - `65ffc807a`: `feat(ai): add tagged model and usage cost states with reversible aggregation` (16 files)
  - `e0464bb04`: `feat(coding-agent): unify live codex model discovery and session v4 migration (fixes #702)` (28 files)
  - `4c61d8928`: `feat(ai): refactor model and usage cost states to generic Cost<T> with provenance source` (12 files)
  - `8f3219a92`: `feat(coding-agent): adapt usage aggregation and session persistence to provenance-tagged Cost<T>` (8 files)
- **Pre-commit & Post-commit Quality Gates**:
  - `npm run check` fully green (Biome 0 fixes, tsgo 0 errors, installer check passed, push-guard 31 cases passed, browser-smoke passed).
  - `npm run check:test-policy` passed against base commit.
  - Focused Vitest suites: 100% pass across `packages/ai` (119/119, 2/2), `packages/agent` (35/35), and `packages/coding-agent` (214/214, 69/69).
- **Changelog**: Fragments committed in `packages/ai/.changes/cost-provenance-source.md` and `packages/coding-agent/.changes/cost-provenance-source.md`.

## Discerning Observations & Action Items
1. **Commit Hygiene & Remote Push**:
   - Commits cleanly partitioned into AI foundation (`4c61d8928`) and Coding Agent layer (`8f3219a92`).
   - Pushed cleanly to `origin/xonsh-installer-port`.
   - Branch `xonsh-repl` fast-forwarded to `8f3219a92` to maintain lockstep parity.
2. **Task 4.4 Completed (SOLID Cost Container Refinement)**:
   - Unified `ModelCost` and `UsageCost` under generic `Cost<T>` with `CostSource = "none" | "provider" | "aggregate"`.
   - Universal accessor `getCostValue<T>()` and reversible arithmetic in `usage.ts` (`partial`, `missingCount`).
   - Wire billing (`source: "provider"`), tier pricing (`source: "aggregate"`), catalog schema updated (`ModelCostSchema`).
   - Session manager v4 normalization fully backwards-compatible with untagged and transitional states.
   - All tests passing, `npm run check:test-policy` passed, `npm run check` 100% green (Biome 0 fixes, tsgo 0 errors).
3. **Task 4.5 Completed (Hermetic Catalog Fixtures for CI)**:
   - Updated `validateBundledModelCatalog` in `packages/coding-agent/scripts/catalog-assets.mjs` to accept and validate `Cost<CostRates>` with non-negative rate checks on `value`/`partial` and integer checks on `missingCount`.
   - Expanded `fixtureCatalogBodies()` to generate 6 deterministic fixture models including unpriced (`fixture-unpriced`, `source: "none"`) and wire-priced OpenRouter (`fixture-openrouter`, `source: "provider"`).
   - Added unit test coverage in `packages/coding-agent/test/catalog-assets.test.ts` verifying provenance shapes and small fixture generation.
   - Quality gates passed: `0` diagnostics via `mcpls`, `check:test-policy` passed, `npm run check` 100% green.
   - Added changelog fragment in `packages/coding-agent/.changes/hermetic-catalog-fixtures.md`.
4. **Task 4.6 Completed (Multi-Provider Contract Extension Specification)**:
   - Dispatched Tranches T10 (Anthropic), T11 (Google Gemini), and T12 (Ollama) to audit workers with 6 hard-won wisdom tenets.
   - Workers audited endpoints (`/v1/models`, `/v1beta/models`, `/api/tags`), auth mechanisms, payload shapes, and unpriced cost mappings.
   - Synthesized unified architectural specification in `.planning/2026-09-26T013940Z-codex-live-model-discovery/cross-provider-discovery-spec.md`.
5. **Phase 4 Status**:
   - All tasks (4.1 to 4.6) are 100% complete, verified, and documented.
6. **Task 4.7 Completed (Branch Reconciliation & .active_plan Ignore)**:
   - Added `.planning/.active_plan` to `.gitignore` and applied `git update-index --skip-worktree .planning/.active_plan` to prevent Husky pre-commit staged-file deletion issues. Committed as `3dd117167` (`chore: add .active_plan to .gitignore`).
   - Branch `xonsh-repl` verified rebased onto and aligned with `xonsh-installer-port` at commit `3dd117167`.
   - Verified active branch remains on `xonsh-repl`.
   - Updated `scratchpad.md` with Section 十 recording branch reconciliation and worktree equilibrium.

7. **Tasks 4.9-4.11 Completed (T10-T15)**:
   - Anthropic and Gemini live discovery, used-model registration, LSP repair. See task_plan.md 4.9-4.11 and findings.md §10 for limitations.
   - Open: Ollama (T12), 404-triggered retirement, Gemini probe run, force-push decision for `xonsh-repl`.
8. **Housekeeping (2026-10-02 21:04 PDT)**:
   - `CLAUDE.md` committed as `150c9ff24` (LSP/TypeScript 7 notes). Branch `xonsh-repl` ahead 255 / behind 20, nothing pushed.
   - T12 (Ollama) dispatched via the dispatcher to a fresh worker; T16 (cache tests, shared helper) queued behind it.
   - Still untracked on purpose: `probe-models.sh`, `probe-models.mjs` (manual live probes stay out of CI), `.planning/` dirs, `pkgbuild/*.pkg.tar.zst`, `report/`, `scripts/query_cost_calls.py`, `scripts/tests/`, `sitrep.prompt.md`, `packages/coding-agent/skills/zsh/uv.lock`.
9. **T12 Completed; T16 dispatched (2026-10-02 21:15 PDT)**:
   - Ollama discovery committed as `fdab11e2f` (99 tests green, `npm run check` 0). Limitations: findings.md §10 items 15-19.
   - T16 (7 cache-behavior tests + shared helper) dispatched with the line-count policy constraint spelled out; BLOCKED is acceptable if the policy cannot be met.
10. **Authorization broadened (2026-10-02 21:16 PDT) and independent review started**:
   - User: agents that have read all the relevant changes are authorized and encouraged to fix glaring bugs themselves. Limited to obvious, confirmed, local defects; speculative or trade-off items are reported only. Same-file edits are serialized through the dispatcher; fixes need tests and must respect the line-count policy. Recorded in scratchpad §五.5.
   - A read-only reviewer (now allowed to fix glaring bugs, serialized) is reviewing `3dd117167..HEAD`: auth/cache leakage, key exposure, error handling, used-models cache correctness, dedupe/seed borrowing, policy compliance, untested behaviors. Findings will be triaged into findings.md.
11. **Independent review done (21:18 PDT)**: findings.md §11. One bug fixed in `used-models.ts` (uncommitted, to be committed with T17); five confirmed defects in `model-registry.ts` assigned to T17 (queued after T16); trade-off items reported for decision.
12. **Handoff written (21:20 PDT, session at 95% limit)**: scratchpad §十六 has repo state, uncommitted working-tree changes (used-models fix verified; T16 model-registry work in progress and unverified), the T16/T17 plan, and open user decisions.
13. **Force push done (21:22 PDT)**: remote backup `backup/xonsh-repl-20261002` at `e285f9f4d`; `origin/xonsh-repl` now `a100ee391` (= local HEAD). Committed before the push: `4b85e6323` (T16 shared discovery cache + 9 cache-behavior tests) and `a100ee391` (malformed used-models cache fix). T17 (five confirmed `model-registry.ts` defects) dispatched at 21:22 PDT.
14. **User rulings recorded (21:24 PDT)**: no Gemini key (probes shelved, task 4.14 closed); 404-retirement expectations documented as an unconfirmed proposal (scratchpad §十八.2); the three trade-off findings documented with options and a recommendation, awaiting a ruling (scratchpad §十八.3).
15. **Session snapshot saved (2026-10-03 16:23 PDT)**: classical wenyan YAML summary of session trajectory, big ideas, and key details saved to `.planning/2026-10-03T162300Z-session-snapshot.yaml` for handoff to next session.
