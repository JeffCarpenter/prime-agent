# Registry worker

## Scope and inspection
- Read both scoped files fully and all three planning documents. No source/test edits made.
- Existing live-only Codex regression is RED: picker catalog contains no live-only entry.
- Exact command: `cd packages/coding-agent && npx tsx ../../node_modules/vitest/dist/cli.js --run test/model-registry.test.ts`.

## Baseline output
```text
npm notice run prime-agent@0.9.6 npx
npm notice run 'tsx' ../../node_modules/vitest/dist/cli.js --run test/model-registry.test.ts

 RUN  v4.1.10 /home/jeff/code/fork/prime-agent/packages/coding-agent

 ❯ test/model-registry.test.ts (56 tests | 9 failed) 1513ms
       × overriding baseUrl keeps every built-in model and rewrites only that provider 15ms
       ✓ a baseUrl plus headers override resolves headers at request time 3ms
       ✓ a headers-only override resolves headers at request time 1ms
       ✓ prime inference requests include selected Prime Agent team header 2ms
       ✓ refresh() picks up baseUrl override changes 2ms
       ✓ built-in provider models inherit api and baseUrl while unknown providers must declare them 2ms
       ✓ custom models merge into a built-in provider, replacing built-ins by id 2ms
       ✓ provider-level compat applies to custom models 1ms
       ✓ model-level compat overrides provider-level compat 1ms
       ✓ the schema accepts thinkingLevelMap plus strict-mode and cache-control compat 1ms
       ✓ the schema accepts the Anthropic streaming and cache-retention flags 1ms
       ✓ provider-level compat applies to built-in models 1ms
       ✓ model-level baseUrl overrides provider-level baseUrl for custom models 1ms
       ✓ refresh() reloads merged custom models and restores built-ins when they are removed 1ms
       ✓ loads the cache without replacing external providers and applies local overrides 4ms
       ✓ restores cached private metadata only for matching credentials and team 28ms
       × renames one built-in model and leaves sibling models alone 2ms
       × deep merges compat routing and leaves sibling models alone 1ms
       × changes cost fields partially and leaves sibling models alone 1ms
       × overrides combine with a provider baseUrl, add request headers, and ignore unknown ids 1ms
       × refresh() picks up changed overrides and restores built-in values once removed 1ms
       × modelOverrides still apply when the provider also defines models 1ms
       ✓ getProviderDisplayName resolves registered, OAuth, built-in, and fallback names 1ms
       ✓ failed registerProvider does not persist invalid streamSimple config 1ms
       ✓ failed registerProvider does not remove existing provider models 1ms
       ✓ unregisterProvider restores the built-in OAuth provider 1ms
       ✓ scheduled catalog refresh preserves other sessions' OAuth providers 5ms
       ✓ unregisterProvider restores the built-in API stream handler 2ms
         × a baseUrl-only override keeps built-in models after refresh 2ms
         ✓ a models-only override replaces built-in models after refresh 2ms
         ✓ models plus a later baseUrl override replace built-in models after refresh 1ms
         ✓ a models-only custom provider registration survives after refresh 1ms
         ✓ a baseUrl-only override keeps custom provider models after refresh 1ms
         ✓ headers-only override keeps custom provider models after refresh 1ms
       ✓ refreshAvailableModels returns while provider catalog refresh is still pending  1003ms
       ✓ model catalog includes unauthenticated public models and hides private Prime routes 289ms
       ✓ refresh() picks up credentials written by another process 3ms
       ✓ provider auth status reports an environment variable name from models.json 1ms
       ✓ provider auth status reports a literal value from models.json 1ms
       ✓ provider auth status reports command apiKey values without executing them 1ms
       ✓ provider auth status reports stale command auth without executing it 7ms
       ✓ provider auth status reports models.json auth when stored auth is stale 1ms
       ✓ stale marking uses the auth source resolved for the last request 5ms
       ✓ changed literal models.json apiKey no longer matches stale provider marker 3ms
       ✓ clearProviderAuthStale restores availability for explicit model selection 2ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after team change 12ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after logout 13ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after missing team 12ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after missing credentials 10ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after active credentials 9ms
       ✓ recovers stale Prime Agent private-model access but invalidates it after rotated credentials 11ms
       ✓ resolves rotated environment and command credentials without caching 10ms
       ✓ changed command-backed apiKey no longer matches stale models.json marker 13ms
     ✓ finds a newly fetched public Prime Inference model without opening the picker 9ms
     × adds live-only Codex models to the picker catalog without inventing prices 2ms
     ✓ sends a Codex CLI client version on the discovery request instead of the package version 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 9 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > baseUrl override (no custom models) > overriding baseUrl keeps every built-in model and rewrites only that provider
AssertionError: expected 1 to be greater than 1
 ❯ test/model-registry.test.ts:85:35
     83|    const anthropicModels = getModelsForProvider(registry, "anthropic");
     84|
     85|    expect(anthropicModels.length).toBeGreaterThan(1);
       |                                   ^
     86|    expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(t…
     87|    expect(anthropicModels.every((m) => m.baseUrl === "https://my-proxy…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > renames one built-in model and leaves sibling models alone
AssertionError: expected undefined to match object { name: 'Custom Sonnet Name' }

- Expected:
{
  "name": "Custom Sonnet Name",
}

+ Received:
undefined

 ❯ test/model-registry.test.ts:466:50
    464|    const registry = withOverrides({ [sonnetId]: override });
    465|
    466|    expect(registry.find("openrouter", sonnetId)).toMatchObject(expecte…
       |                                                  ^
    467|    expect(registry.find("openrouter", opusId)).not.toMatchObject(expec…
    468|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > deep merges compat routing and leaves sibling models alone
AssertionError: expected undefined to match object { compat: { …(1) } }

- Expected:
{
  "compat": {
    "openRouterRouting": {
      "only": [
        "amazon-bedrock",
      ],
    },
  },
}

+ Received:
undefined

 ❯ test/model-registry.test.ts:466:50
    464|    const registry = withOverrides({ [sonnetId]: override });
    465|
    466|    expect(registry.find("openrouter", sonnetId)).toMatchObject(expecte…
       |                                                  ^
    467|    expect(registry.find("openrouter", opusId)).not.toMatchObject(expec…
    468|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > changes cost fields partially and leaves sibling models alone
AssertionError: expected undefined to match object { cost: { input: 99 } }

- Expected:
{
  "cost": {
    "input": 99,
  },
}

+ Received:
undefined

 ❯ test/model-registry.test.ts:466:50
    464|    const registry = withOverrides({ [sonnetId]: override });
    465|
    466|    expect(registry.find("openrouter", sonnetId)).toMatchObject(expecte…
       |                                                  ^
    467|    expect(registry.find("openrouter", opusId)).not.toMatchObject(expec…
    468|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > overrides combine with a provider baseUrl, add request headers, and ignore unknown ids
AssertionError: expected undefined to match object { name: 'Proxied Sonnet', …(1) }

- Expected:
{
  "baseUrl": "https://my-proxy.example.com/v1",
  "name": "Proxied Sonnet",
}

+ Received:
undefined

 ❯ test/model-registry.test.ts:481:19
    479|
    480|    expect(registry.getError()).toBeUndefined();
    481|    expect(sonnet).toMatchObject({ name: "Proxied Sonnet", baseUrl: "ht…
       |                   ^
    482|    expect(registry.find("openrouter", opusId)).toMatchObject({ baseUrl…
    483|    expect(registry.find("openrouter", "nonexistent/model-id")).toBeUnd…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > refresh() picks up changed overrides and restores built-in values once removed
AssertionError: expected undefined to be 'First Name' // Object.is equality

- Expected:
"First Name"

+ Received:
undefined

 ❯ test/model-registry.test.ts:492:56
    490|   test("refresh() picks up changed overrides and restores built-in val…
    491|    const registry = withOverrides({ [sonnetId]: { name: "First Name" }…
    492|    expect(registry.find("openrouter", sonnetId)?.name).toBe("First Nam…
       |                                                        ^
    493|
    494|    writeRawModelsJson({ openrouter: { modelOverrides: { [sonnetId]: { …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > modelOverrides (per-model customization) > modelOverrides still apply when the provider also defines models
AssertionError: expected undefined to be 'Overridden Built-in Sonnet' // Object.is equality

- Expected:
"Overridden Built-in Sonnet"

+ Received:
undefined

 ❯ test/model-registry.test.ts:527:56
    525|
    526|    expect(registry.find("openrouter", "custom/openrouter-model")).toBe…
    527|    expect(registry.find("openrouter", sonnetId)?.name).toBe("Overridde…
       |                                                        ^
    528|   });
    529|  });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯

 FAIL  test/model-registry.test.ts > ModelRegistry > dynamic provider lifecycle > dynamic provider override persistence > a baseUrl-only override keeps built-in models after refresh
AssertionError: expected 1 to be greater than 1
 ❯ test/model-registry.test.ts:718:28
    716|      expect(models.map((m) => m.id)).toEqual(expectedIds);
    717|     } else {
    718|      expect(models.length).toBeGreaterThan(1);
       |                            ^
    719|     }
    720|     expect(models.every((m) => m.baseUrl === expectedBaseUrl)).toBe(tr…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯

 FAIL  test/model-registry.test.ts > issue #702 codex model discovery client version > adds live-only Codex models to the picker catalog without inventing prices
AssertionError: expected undefined to match object { provider: 'openai-codex', …(2) }

- Expected:
{
  "cost": {
    "status": "unknown",
  },
  "id": "gpt-5.9-codex",
  "provider": "openai-codex",
}

+ Received:
undefined

 ❯ test/model-registry.test.ts:1282:21
    1280|   const liveModel = catalog.models.find((model) => model.provider === …
    1281|
    1282|   expect(liveModel).toMatchObject({
       |                     ^
    1283|    provider: "openai-codex",
    1284|    id: "gpt-5.9-codex",

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯


 Test Files  1 failed (1)
      Tests  9 failed | 47 passed (56)
   Start at  03:50:01
   Duration  2.28s (transform 385ms, setup 0ms, import 658ms, tests 1.51s, environment 0ms)


```

## Decision needed
- Slug-only discovery requires a client policy for mandatory reasoning/input/contextWindow/maxTokens fields. Proposed conservative values: false, text only, 128000, 16384 (existing custom-model defaults), explicitly not wire claims. Await parent decision.
- Do not generate catalog assets concurrently. Incomplete bundled catalog blocks full-file green validation: six OpenRouter model cases and two Anthropic multiplicity cases.

## Changed paths
- `.planning/2026-09-24-provider-model-discovery/registry-worker.md` only.
