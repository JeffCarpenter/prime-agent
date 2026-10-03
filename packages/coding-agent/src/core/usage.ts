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

function costParts(cost: UsageCost): { partial: CostAmounts; missingCount: number } {
	if ("source" in cost) {
		if (cost.source === "none") {
			return {
				partial: cost.partial ?? zeroCostAmounts(),
				missingCount: cost.missingCount ?? 1,
			};
		}
		return { partial: cost.value, missingCount: 0 };
	}
	return { partial: cost, missingCount: 0 };
}

function mergeCost(total: UsageCost, usage: UsageCost, sign: 1 | -1): UsageCost {
	const totalParts = costParts(total);
	const usageParts = costParts(usage);
	const partial: CostAmounts = {
		input: Math.max(0, totalParts.partial.input + sign * usageParts.partial.input),
		output: Math.max(0, totalParts.partial.output + sign * usageParts.partial.output),
		cacheRead: Math.max(0, totalParts.partial.cacheRead + sign * usageParts.partial.cacheRead),
		cacheWrite: Math.max(0, totalParts.partial.cacheWrite + sign * usageParts.partial.cacheWrite),
		total: Math.max(0, totalParts.partial.total + sign * usageParts.partial.total),
	};
	const missingCount = Math.max(0, totalParts.missingCount + sign * usageParts.missingCount);
	return missingCount > 0 ? { source: "none", partial, missingCount } : { source: "aggregate", value: partial };
}

export function sessionUsageSummaryFrom(usage: Usage): SessionUsageSummary | undefined {
	const inputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	const cost = getUsageCostAmounts(usage.cost);
	const costUnknown = "source" in usage.cost && usage.cost.source === "none";
	if (inputTokens === 0 && usage.output === 0 && cost?.total === 0 && !costUnknown) {
		return undefined;
	}
	return cost && !costUnknown
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
		cost: { source: "aggregate", value: zeroCostAmounts() },
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
		parts.missingCount > 0
			? {
					source: "none",
					partial: { ...parts.partial },
					missingCount: parts.missingCount,
				}
			: { source: "aggregate", value: { ...parts.partial } };
	return {
		input: usage.input,
		output: usage.output,
		cacheRead: usage.cacheRead,
		cacheWrite: usage.cacheWrite,
		totalTokens: usage.totalTokens,
		cost,
	};
}
