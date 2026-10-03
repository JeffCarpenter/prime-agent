import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { beforeAll, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import { ModelSelectorComponent } from "../src/modes/interactive/components/model-selector.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { getCodingAgentFixtureModel } from "./fixture-models.js";

beforeAll(() => initTheme("dark"));

it.each([40, 80])("keeps the same visible list size when a model's price is unknown at width %i", (width) => {
	const known = getCodingAgentFixtureModel("anthropic", "claude-sonnet-5");
	const unknown = { ...known, cost: { source: "none" as const } };
	const registry = ModelRegistry.inMemory(AuthStorage.inMemory());
	const ui = { requestRender() {} } as TUI;
	const options = { inline: true, availableModels: [known], getRows: () => 20 };
	const selector = new ModelSelectorComponent(
		ui,
		known,
		registry,
		[],
		() => {},
		() => {},
		undefined,
		options,
	);
	const priced = selector.render(width).map(stripAnsi);
	selector.updateState(unknown, [unknown]);
	const unpriced = selector.render(width).map(stripAnsi);
	expect(unpriced.join("\n")).toContain("Price unknown");
	expect(unpriced).toHaveLength(priced.length);
});
