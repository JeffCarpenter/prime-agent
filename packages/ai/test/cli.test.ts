import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOAuthProviderSelection } from "../src/cli-provider-selection.js";
import { getOAuthProviders } from "../src/utils/oauth/index.js";

const require = createRequire(import.meta.url);
const tsxLoader = require.resolve("tsx/esm");
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(packageRoot, "src/cli.ts");
const providers = getOAuthProviders();
const selectionPrompt = `Select a provider:\n\n${providers.map((provider, index) => `  ${index + 1}. ${provider.name}`).join("\n")}\n\nEnter number (1-${providers.length}): `;

function runInteractiveProviderSelection(input: string, initialAuth?: string) {
	const testDir = mkdtempSync(join(tmpdir(), "pi-ai-cli-"));
	const authPath = join(testDir, "auth.json");
	if (initialAuth !== undefined) writeFileSync(authPath, initialAuth, "utf8");

	try {
		const result = spawnSync(process.execPath, ["--import", tsxLoader, cliPath, "login"], {
			cwd: testDir,
			encoding: "utf8",
			input: `${input}\n`,
			timeout: 5_000,
		});
		return {
			result,
			authContents: existsSync(authPath) ? readFileSync(authPath, "utf8") : undefined,
		};
	} finally {
		rmSync(testDir, { recursive: true, force: true });
	}
}

function expectRejectedSelection(input: string, initialAuth?: string): string | undefined {
	const { result, authContents } = runInteractiveProviderSelection(input, initialAuth);
	expect(result.error).toBeUndefined();
	expect(result.signal).toBeNull();
	expect(result.status).toBe(1);
	expect(result.stdout).toBe(selectionPrompt);
	expect(result.stderr).toBe("Invalid selection\n");
	return authContents;
}

describe("OAuth CLI", () => {
	it("parses only canonical decimal provider selections", () => {
		expect(parseOAuthProviderSelection("1", 3)).toBe(0);
		expect(parseOAuthProviderSelection(" \t3\r\n", 3)).toBe(2);

		for (const input of [
			"",
			" ",
			"abc",
			"1abc",
			"1.5",
			"1e0",
			"0x1",
			"+1",
			"-1",
			"Infinity",
			"NaN",
			"0",
			"01",
			"4",
			"9007199254740993",
		]) {
			expect(parseOAuthProviderSelection(input, 3), input).toBeUndefined();
		}
	});

	it.each(["", " ", "abc", "1abc", "1.5", "1e0", "0x1", "+1", "-1", "Infinity", "NaN", "0", "01", "4"])(
		"rejects malformed interactive selection %j without authentication side effects",
		(input) => {
			const sentinelAuth = '{"sentinel":true}\n';
			expect(expectRejectedSelection(input, sentinelAuth)).toBe(sentinelAuth);
		},
	);

	it("does not create auth.json for an invalid selection", () => {
		expect(expectRejectedSelection("abc")).toBeUndefined();
	});
});
