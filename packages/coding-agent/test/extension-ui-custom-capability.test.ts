import { describe, expect, it } from "vitest";
import type { ExtensionUIContext } from "../src/core/extensions/types.js";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.js";

interface InteractiveUiContextFactory {
	createExtensionUIContext(this: object): ExtensionUIContext;
}

describe("extension custom UI capability", () => {
	it("reports terminal takeover support in interactive mode", () => {
		const interactivePrototype = InteractiveMode.prototype as unknown as InteractiveUiContextFactory;
		const uiContext = interactivePrototype.createExtensionUIContext.call({});

		expect(uiContext.supportsCustom).toBe(true);
	});
});
