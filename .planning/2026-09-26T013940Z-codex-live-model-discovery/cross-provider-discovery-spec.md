# Cross-Provider Live Model Discovery & Cost Prudence Specification

## 1. Executive Summary

This specification establishes the architectural contract for extending live model discovery and honest cost provenance (`Cost<T>`) across non-OpenAI providers: **Anthropic**, **Google Gemini**, and **Local / Ollama**.

Following the successful landing of Codex live model discovery (Issue [#702](https://github.com/PrimeIntellect-ai/prime-agent/issues/702), commits `65ffc807a` and `e0464bb04`) and the generic provenance container (commits `4c61d8928` and `8f3219a92`), this roadmap defines how each provider discovers dynamic checkpoints, fine-tunes, and preview models without waiting for static catalog releases (`provider-model-catalog.v1.json`), while strictly preventing misleading `$0.000` price indicators.

---

## 2. Core Architectural Invariants

1. **Honest Cost Representation (`Never Default Unknown Price to Zero`)**:
   - Any dynamic or unlisted model whose pricing is not authoritatively published in the catalog or wire protocol MUST be assigned:
     ```typescript
     cost: { source: "none" }
     ```
   - Never borrow neighbouring model prices or default unknown rates to `{ input: 0, output: 0 }`.
2. **Access Through Universal Accessors**:
   - All components (`model-selector`, `context-tree`, `custom-footer`, `usage`) must access rates and amounts solely through `getCostValue<T>()` or its typed aliases `getModelCostRates()` and `getUsageCostAmounts()`.
3. **Transport Seed Independence & Graceful Degradation**:
   - Dynamic discovery must synthesize required transport metadata (`baseUrl`, `api`, `provider`, `headers`) from seed definitions, falling back to compiled built-ins (`installedModels`) if static catalog files are absent.
   - Network errors, credential failures, or endpoint timeouts during discovery must fail silently and non-blocking, preserving previously cached models.
4. **Authentic Zero-Cost for Local Loopback Only**:
   - Models hosted on verified local loopback endpoints (`localhost`, `127.0.0.1`, `[::1]`) represent zero-dollar computing cost and are legitimately assigned:
     ```typescript
     cost: { source: "aggregate", value: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }
     ```
   - Remote private endpoints or reverse proxies must remain `{ source: "none" }` unless explicitly configured.

---

## 3. Provider Discovery Contracts

### 3.1 Anthropic (`provider: "anthropic"`)

- **Discovery Endpoint**: `GET ${baseUrl}/v1/models`
- **Default Base URL**: `https://api.anthropic.com`
- **Authentication**:
  - API Key: `x-api-key: ${apiKey}`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`
  - OAuth Token: `Authorization: Bearer ${apiKey}`, `anthropic-beta: claude-code-20250219,oauth-2025-04-20`, `user-agent: claude-cli/...`, `x-app: cli`
- **Wire Payload**:
  ```typescript
  export interface AnthropicModelInfo {
    readonly type: "model";
    readonly id: string;
    readonly display_name: string;
    readonly created_at: string;
    readonly capabilities?: {
      readonly thinking?: { readonly supported: boolean };
      readonly image_input?: { readonly supported: boolean };
    };
    readonly max_input_tokens?: number | null;
    readonly max_tokens?: number | null;
  }
  ```
- **Cost Mapping**:
  - If model exists in catalog with confirmed pricing: retain catalog pricing.
  - If model is newly discovered or unpriced: assign `{ source: "none" }`.
- **Capability Inference**:
  - `contextWindow`: `max_input_tokens ?? 200_000`
  - `maxTokens`: `max_tokens ?? 8192`
  - `reasoning`: `Boolean(capabilities?.thinking?.supported)`
  - `input`: `capabilities?.image_input?.supported === false ? ["text"] : ["text", "image"]`

### 3.2 Google Gemini (`provider: "google"`)

- **Discovery Endpoint**: `GET ${baseUrl}/models?pageSize=1000`
- **Default Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Authentication**: `x-goog-api-key: ${apiKey}` header or `?key=${apiKey}` query parameter from `GEMINI_API_KEY`.
- **Wire Payload**:
  ```typescript
  export interface GoogleGeminiRawModelEntry {
    name: string; // Format: "models/gemini-2.5-pro"
    displayName?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }
  ```
- **Filtering & ID Normalization**:
  - Filter: `supportedGenerationMethods.includes("generateContent")` (excludes embedding-only and image generation models).
  - Strip prefix: `id = entry.name.replace(/^models\//, "")`.
- **Cost Mapping**:
  - Google v1beta `/models` API returns zero pricing metadata.
  - If model exists in catalog: retain catalog pricing.
  - If model is a dynamic preview or project fine-tune: strictly assign `{ source: "none" }`.
- **Capability Inference**:
  - `contextWindow`: `inputTokenLimit ?? 1048576`
  - `maxTokens`: `outputTokenLimit ?? 8192`
  - `reasoning`: `id.includes("pro") || id.includes("thinking")`

### 3.3 Ollama (`provider: "ollama"`)

- **Discovery Endpoints**:
  - `GET ${endpoint}/api/tags` (fast list of installed local models)
  - `POST ${endpoint}/api/show` with body `{"model": "${id}"}` (deep context length & capability extraction)
- **Default Base URL**: `http://localhost:11434` (configurable via `OLLAMA_HOST`)
- **Capability Inference**:
  - Inspect `model_info["*.context_length"]` or Modelfile parameters for context window (fallback: `8192`).
  - Inspect `capabilities.includes("tools")` for tool calling support.
  - Detect `reasoning`: regex matching `/r1/i`.
- **Cost Mapping**:
  - Loopback (`localhost`, `127.0.0.1`, `[::1]`): `{ source: "aggregate", value: zeroCostAmounts() }` (authentic zero-cost, UI shows `$0.00`).
  - Remote host / proxy: `{ source: "none" }`.

---

## 4. Unified ModelRegistry Lifecycle

```typescript
export class ModelRegistry {
  private liveOpenAICodexModels: Model<"openai-codex-responses">[] = [];
  private liveAnthropicModels: Model<"anthropic-messages">[] = [];
  private liveGoogleGeminiModels: Model<Api>[] = [];
  private liveOllamaModels: Model<Api>[] = [];

  async refreshAvailableModels(): Promise<void> {
    await Promise.allSettled([
      this.refreshOpenAICodexModels(),
      this.refreshAnthropicModels(),
      this.refreshGoogleGeminiModels(),
      this.refreshOllamaModels(),
    ]);
  }
}
```

1. **Concurrency**: All discovery requests run concurrently via `Promise.allSettled` to prevent slow providers from delaying startup.
2. **Timeouts**: Individual discovery probes bound to <= 5,000ms (Ollama <= 2,000ms) with `AbortSignal.timeout`.
3. **Cache Invalidation**: On auth change (`authStorage.onChange()`) or explicit `/model` refresh, clear live lists and re-probe.
4. **Hermetic Testing**: All tests must mock `fetch` or use faux providers; no live requests allowed in CI.
