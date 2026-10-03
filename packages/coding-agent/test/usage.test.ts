import type { Usage } from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { addAssistantUsage, emptyUsage, subtractAssistantUsage } from "../src/core/usage.js";

const pricedUsage: Usage = {
	input: 1,
	output: 2,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 3,
	cost: { status: "known", amounts: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 } },
};
const unpricedUsage: Usage = {
	input: 3,
	output: 4,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 7,
	cost: {
		status: "unknown",
		pricedSubtotal: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		unknownContributors: 1,
	},
};

describe("assistant usage cost aggregation", () => {
	test("subtracting an unpriced contribution restores the known total", () => {
		const total = emptyUsage();

		addAssistantUsage(total, pricedUsage);
		addAssistantUsage(total, unpricedUsage);
		expect(total.cost).toMatchObject({ status: "unknown", unknownContributors: 1 });

		subtractAssistantUsage(total, unpricedUsage);

		expect(total.cost).toEqual({
			status: "known",
			amounts: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
		});
	});
});
