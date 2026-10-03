import { MODELS } from "./models.generated.js";
import type {
	Api,
	CostAmounts,
	CostRates,
	KnownProvider,
	Model,
	ModelThinkingLevel,
	ServiceTier,
	Usage,
} from "./types.js";

const modelRegistry: Map<string, Map<string, Model<Api>>> = new Map();

for (const [provider, models] of Object.entries(MODELS)) {
	const providerModels = new Map<string, Model<Api>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, model as Model<Api>);
	}
	modelRegistry.set(provider, providerModels);
}

type ModelApi<TProvider extends KnownProvider> = (typeof MODELS)[TProvider][keyof (typeof MODELS)[TProvider]] extends {
	api: infer TApi;
}
	? TApi extends Api
		? TApi
		: Api
	: Api;

type ModelApiForId<
	TProvider extends KnownProvider,
	TModelId extends keyof (typeof MODELS)[TProvider],
> = (typeof MODELS)[TProvider][TModelId] extends { api: infer TApi } ? (TApi extends Api ? TApi : Api) : Api;

export function getModel<TProvider extends KnownProvider, TModelId extends keyof (typeof MODELS)[TProvider]>(
	provider: TProvider,
	modelId: TModelId,
): Model<ModelApiForId<TProvider, TModelId>>;
export function getModel<TProvider extends KnownProvider>(
	provider: TProvider,
	modelId: string,
): Model<ModelApi<TProvider>> | undefined;
export function getModel<TProvider extends KnownProvider>(
	provider: TProvider,
	modelId: string,
): Model<ModelApi<TProvider>> | undefined {
	const providerModels = modelRegistry.get(provider);
	return providerModels?.get(modelId) as Model<ModelApi<TProvider>> | undefined;
}

export function getProviders(): KnownProvider[] {
	return Array.from(modelRegistry.keys()) as KnownProvider[];
}

export function getModels<TProvider extends KnownProvider>(provider: TProvider): Model<ModelApi<TProvider>>[] {
	const models = modelRegistry.get(provider);
	return models ? (Array.from(models.values()) as Model<ModelApi<TProvider>>[]) : [];
}

/** Whether a model's provider accepts (and honors) a requested service tier. */
export function supportsServiceTier<TApi extends Api>(model: Model<TApi>, tier: ServiceTier): boolean {
	if (tier === null || tier === "default") return true;
	// OpenRouter accepts top-level service_tier (flex|priority) for every model,
	// routes to matching tier endpoints where they exist, and bills by the tier
	// that actually served the request:
	// https://openrouter.ai/docs/guides/features/service-tiers
	if (model.provider === "openrouter" && model.api === "openai-completions") {
		return tier === "flex" || tier === "priority";
	}
	const openaiResponses = model.provider === "openai" && model.api === "openai-responses";
	const codexResponses = model.provider === "openai-codex" && model.api === "openai-codex-responses";
	if (!openaiResponses && !codexResponses) return false;
	// "auto" defers the tier choice to OpenAI and is valid for every model there;
	// "scale" is entitlement-gated, so pass it through for callers that have it.
	if (tier === "auto" || tier === "scale") return true;
	const eligibleId =
		model.id === "gpt-5.4" ||
		model.id === "gpt-5.5" ||
		model.id === "gpt-5.6" ||
		model.id === "gpt-6-astra" ||
		model.id.startsWith("gpt-5.6-");
	if (tier === "priority") return eligibleId;
	// Flex processing is an API-key feature; the ChatGPT (Codex OAuth) backend has no flex tier.
	return tier === "flex" && eligibleId && openaiResponses;
}

/** Clamp a requested tier to "default" when the model does not support it. */
export function clampServiceTier<TApi extends Api>(
	model: Model<TApi> | null | undefined,
	tier: ServiceTier,
): ServiceTier {
	if (tier === null || tier === "default") return tier;
	return model && supportsServiceTier(model, tier) ? tier : "default";
}

export function supportsFastMode<TApi extends Api>(model: Model<TApi>): boolean {
	return supportsServiceTier(model, "priority");
}

export interface CostOverrides {
	cacheWrite?: number;
}

export function getModelCostRates(cost: Model<Api>["cost"]): CostRates | undefined {
	if ("status" in cost) return cost.status === "known" ? cost.rates : undefined;
	return cost;
}

export function getUsageCostAmounts(cost: Usage["cost"]): CostAmounts | undefined {
	if ("status" in cost) return cost.status === "known" ? cost.amounts : undefined;
	return cost;
}

export function calculateCost<TApi extends Api>(
	model: Model<TApi>,
	usage: Usage,
	overrides?: CostOverrides,
): Usage["cost"] {
	if ("status" in model.cost && model.cost.status === "unknown") {
		usage.cost = {
			status: "unknown",
			pricedSubtotal: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			unknownContributors: 1,
		};
		return usage.cost;
	}
	const rates = "status" in model.cost ? model.cost.rates : model.cost;
	const amounts = {
		input: (rates.input / 1000000) * usage.input,
		output: (rates.output / 1000000) * usage.output,
		cacheRead: (rates.cacheRead / 1000000) * usage.cacheRead,
		cacheWrite: ((overrides?.cacheWrite ?? rates.cacheWrite) / 1000000) * usage.cacheWrite,
		total: 0,
	};
	amounts.total = amounts.input + amounts.output + amounts.cacheRead + amounts.cacheWrite;
	usage.cost = { status: "known", amounts };
	return usage.cost;
}

const EXTENDED_THINKING_LEVELS: ModelThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export function getSupportedThinkingLevels<TApi extends Api>(model: Model<TApi>): ModelThinkingLevel[] {
	if (!model.reasoning) return ["off"];

	return EXTENDED_THINKING_LEVELS.filter((level) => {
		const mapped = model.thinkingLevelMap?.[level];
		if (mapped === null) return false;
		if (level === "xhigh" || level === "max") return mapped !== undefined;
		return true;
	});
}

export function clampThinkingLevel<TApi extends Api>(
	model: Model<TApi>,
	level: ModelThinkingLevel,
): ModelThinkingLevel {
	const availableLevels = getSupportedThinkingLevels(model);
	if (availableLevels.includes(level)) return level;

	const requestedIndex = EXTENDED_THINKING_LEVELS.indexOf(level);
	if (requestedIndex === -1) return availableLevels[0] ?? "off";

	for (let i = requestedIndex; i < EXTENDED_THINKING_LEVELS.length; i++) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	for (let i = requestedIndex - 1; i >= 0; i--) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	return availableLevels[0] ?? "off";
}

export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
