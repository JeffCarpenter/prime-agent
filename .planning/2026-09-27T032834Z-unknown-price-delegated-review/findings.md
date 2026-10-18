# Delegated review wave: unknown-price / live-Codex diff

Written as structured notes; machine copy in findings.json.

```json
{
  "title": "Delegated review wave: unknown-price / live-Codex diff",
  "date": "2026-09-27T032834Z",
  "context": {
    "subject": "Uncommitted codex-live-model-discovery diff reviewed by five disjoint-scope workers (pool=5)",
    "workers": {
      "registry": [
        "model-registry.ts transport-seed fix",
        "DONE, focused regression red/green"
      ],
      "ai-providers": [
        "openai-codex-responses.ts clamp fix + false-positive test hardened",
        "DONE 47/47, mutation-proved"
      ],
      "session-cost": [
        "agent-session-runtime cross-cwd test pinned to faux model",
        "DONE targeted red/green credential-free"
      ],
      "ui-cost": [
        "picker row budget, footer/subagent unknown display",
        "3 fixes + 3 new test files, mutation-proved; final report lost to usage limit"
      ],
      "ai-cost": [
        "model-catalog tagged costs + exporter unknown/no-$0 fix",
        "implemented on disk; final validation report lost to usage limit"
      ]
    }
  },
  "defects_found_and_fixed": [
    {
      "file": "packages/coding-agent/src/core/model-registry.ts",
      "issue": "partial public catalog dropping bundled Codex entries left live discovery with no transport seed",
      "fix": "active-then-bundled-then-compiled seed for discovery only; fallback entries not displayed"
    },
    {
      "file": "packages/ai/src/providers/openai-codex-responses.ts",
      "issue": "direct stream bypassed model capability clamp (minimal not clamped to low)",
      "fix": "clampThinkingLevel applied in buildRequestBody; test now asserts success + wire effort"
    },
    {
      "file": "packages/coding-agent/test/suite/agent-session-runtime.test.ts",
      "issue": "cross-cwd test created second runtime without model -> could select configured real MiniMax model (live 429s observed)",
      "fix": "second runtime pinned faux-1, local default faux-2, pre-prompt model assertion; mutation fails safely"
    },
    {
      "file": "packages/coding-agent/src/modes/interactive/components/model-selector.ts",
      "issue": "reserved 4/5 detail rows rendered 3 for unknown prices, shrinking list",
      "fix": "unknown details render in same row footprint"
    },
    {
      "file": "packages/coding-agent/examples/extensions/custom-footer.ts + subagent/index.ts",
      "issue": "rendered $0.000 / misleading known subtotal for unknown-price usage",
      "fix": "unknown flag propagated, 'price unknown' shown"
    }
  ],
  "environment_notes": [
    "Coordinator session hit openai-codex usage limit mid-wave; recovered by switching to z.ai glm-5.3 family models. Two children (ai-cost, ui-cost) lost their final-report turn to the same limit; their state was recovered from disk + transcripts.",
    "Full model-registry.test.ts has 8 environment failures from absent catalog/models.bundled.json (no local catalog checkout, no GITHUB_TOKEN/PRIME_CATALOG_REPO_TOKEN); focused + catalog-compat tests pass.",
    "test/suite/agent-session-runtime.test.ts must not be run with live credentials present (see fix above)."
  ],
  "pending_at_write_time": [
    "RESOLVED: focused tests for ai-cost (13/13) and ui-cost (67/67) verified by coordinator after model-limit interruption",
    "RESOLVED: npm run check:test-policy passed; npm run check fully green (Biome 0 fixes, tsgo 0 errors, installer, push-guard 31 cases, browser-smoke)",
    "Line budget: 434 production additions vs 299 tracked + 179 untracked new-file test additions; official check:test-policy accounting passes",
    "All five workers accepted and deleted; no commits made - user owns commit decision",
    "RESOLVED: generated catalog assets via `npm run catalog:assets` (public fetch, no token); full model-registry.test.ts 61/61 + catalog-compat 8/8 = 69/69 with real catalog present"
  ]
}
```
