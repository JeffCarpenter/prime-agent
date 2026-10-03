import { describe, expect, test } from "vitest";
import { calculateCost } from "../src/models.js";
import { applyServiceTierPricing } from "../src/providers/service-tier-pricing.js";
import type { Model, Usage } from "../src/types.js";
import { getFixtureModel } from "./fixture-models.js";

describe("model cost calculation", () => {
	test.each(["unknown", "known"] as const)("preserves %s pricing through calculation and tier pricing", (status) => {
		const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
		const model: Model<"openai-codex-responses"> = {
			...getFixtureModel<"openai-codex-responses">("openai-codex", "gpt-5.4"),
			cost: status === "unknown" ? { source: "none" } : { source: "aggregate", value: zero },
		};
		const usage: Usage = {
			input: 100,
			output: 20,
			cacheRead: 10,
			cacheWrite: 0,
			totalTokens: 130,
			cost: { source: "aggregate", value: { ...zero, total: 0 } },
		};
		const expected =
			status === "unknown"
				? { source: "none", partial: { ...zero, total: 0 }, missingCount: 1 }
				: { source: "aggregate", value: { ...zero, total: 0 } };
		expect(calculateCost(model, usage)).toEqual(expected);
		applyServiceTierPricing(usage, "priority", model.id);
		expect(usage.cost).toEqual(expected);
	});
});
