import type { CostAmounts, Usage, UsageCost } from "@earendil-works/pi-ai";
import { getUsageCostAmounts } from "@earendil-works/pi-ai";

export interface SessionUsageSummary {
	inputTokens: number;
	outputTokens: number;
	cost?: number;
	costUnknown?: true;
}

function zeroCostAmounts(): CostAmounts {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

function costParts(cost: UsageCost): { pricedSubtotal: CostAmounts; unknownContributors: number } {
	if ("status" in cost) {
		return cost.status === "unknown"
			? { pricedSubtotal: cost.pricedSubtotal, unknownContributors: cost.unknownContributors }
			: { pricedSubtotal: cost.amounts, unknownContributors: 0 };
	}
	return { pricedSubtotal: cost, unknownContributors: 0 };
}

function mergeCost(total: UsageCost, usage: UsageCost, sign: 1 | -1): UsageCost {
	const totalParts = costParts(total);
	const usageParts = costParts(usage);
	const pricedSubtotal = {
		input: Math.max(0, totalParts.pricedSubtotal.input + sign * usageParts.pricedSubtotal.input),
		output: Math.max(0, totalParts.pricedSubtotal.output + sign * usageParts.pricedSubtotal.output),
		cacheRead: Math.max(0, totalParts.pricedSubtotal.cacheRead + sign * usageParts.pricedSubtotal.cacheRead),
		cacheWrite: Math.max(0, totalParts.pricedSubtotal.cacheWrite + sign * usageParts.pricedSubtotal.cacheWrite),
		total: Math.max(0, totalParts.pricedSubtotal.total + sign * usageParts.pricedSubtotal.total),
	};
	const unknownContributors = Math.max(0, totalParts.unknownContributors + sign * usageParts.unknownContributors);
	return unknownContributors > 0
		? { status: "unknown", pricedSubtotal, unknownContributors }
		: { status: "known", amounts: pricedSubtotal };
}

export function sessionUsageSummaryFrom(usage: Usage): SessionUsageSummary | undefined {
	const inputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	const cost = getUsageCostAmounts(usage.cost);
	if (
		inputTokens === 0 &&
		usage.output === 0 &&
		cost?.total === 0 &&
		!("status" in usage.cost && usage.cost.status === "unknown")
	) {
		return undefined;
	}
	return cost
		? { inputTokens, outputTokens: usage.output, cost: cost.total }
		: { inputTokens, outputTokens: usage.output, costUnknown: true };
}

export function emptyUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { status: "known", amounts: zeroCostAmounts() },
	};
}

export function addAssistantUsage(total: Usage, usage: Usage): void {
	total.input += usage.input;
	total.output += usage.output;
	total.cacheRead += usage.cacheRead;
	total.cacheWrite += usage.cacheWrite;
	total.totalTokens += usage.totalTokens;
	total.cost = mergeCost(total.cost, usage.cost, 1);
}

/** Remove a previously added usage, clamping at zero to absorb attribution drift. */
export function subtractAssistantUsage(total: Usage, usage: Usage): void {
	total.input = Math.max(0, total.input - usage.input);
	total.output = Math.max(0, total.output - usage.output);
	total.cacheRead = Math.max(0, total.cacheRead - usage.cacheRead);
	total.cacheWrite = Math.max(0, total.cacheWrite - usage.cacheWrite);
	total.totalTokens = Math.max(0, total.totalTokens - usage.totalTokens);
	total.cost = mergeCost(total.cost, usage.cost, -1);
}

export function cloneUsage(usage: Usage): Usage {
	const parts = costParts(usage.cost);
	const cost: UsageCost =
		parts.unknownContributors > 0
			? {
					status: "unknown",
					pricedSubtotal: { ...parts.pricedSubtotal },
					unknownContributors: parts.unknownContributors,
				}
			: { status: "known", amounts: { ...parts.pricedSubtotal } };
	return {
		input: usage.input,
		output: usage.output,
		cacheRead: usage.cacheRead,
		cacheWrite: usage.cacheWrite,
		totalTokens: usage.totalTokens,
		cost,
	};
}
