import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	copySourceCatalogAssets,
	generateBundledCatalogAssets,
	MAX_REMOTE_CATALOG_BYTES,
	validateBundledModelCatalog,
} from "../scripts/catalog-assets.mjs";

declare module "../scripts/catalog-assets.mjs" {
	// biome-ignore lint/suspicious/noExportsInTest: script module augmentation
	export function validateBundledModelCatalog(p: string, o?: { allowSmallFixture?: boolean }): { models: number };
}

const tempDirs: string[] = [];

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.GITHUB_TOKEN;
	delete process.env.PRIME_CATALOG_REPO_TOKEN;
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "catalog-assets-"));
	tempDirs.push(dir);
	return dir;
}

function modelCatalog(cost: Record<string, unknown> = { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }): string {
	return `${JSON.stringify({
		schemaVersion: 1,
		models: [
			{
				id: "fixture",
				name: "Fixture",
				api: "openai-completions",
				provider: "openai",
				baseUrl: "https://api.openai.com/v1",
				reasoning: false,
				input: ["text"],
				cost,
				contextWindow: 128000,
				maxTokens: 8192,
			},
		],
	})}
`;
}

function mcpCatalog(): string {
	return `${JSON.stringify({ version: 2, counts: { entries: 0 }, entries: [] })}
`;
}

describe("catalog asset generation", () => {
	it("does not send GitHub tokens to custom catalog URLs unless explicitly allowed", async () => {
		process.env.GITHUB_TOKEN = "secret-token";
		const seen: Array<{ url: string; authorization?: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
				const url = String(input);
				const headers = new Headers(init?.headers);
				seen.push({ url, authorization: headers.get("authorization") ?? undefined });
				return new Response(url.includes("models") ? modelCatalog() : mcpCatalog());
			}),
		);

		await generateBundledCatalogAssets({
			outDir: tempDir(),
			modelsUrl: "https://example.test/models.json",
			mcpServicesUrl: "https://example.test/plugins.json",
			allowSmallFixture: true,
		});

		expect(seen.map((entry) => entry.authorization)).toEqual([undefined, undefined]);

		seen.length = 0;
		await generateBundledCatalogAssets({
			outDir: tempDir(),
			modelsUrl: "https://example.test/models.json",
			mcpServicesUrl: "https://example.test/plugins.json",
			allowSmallFixture: true,
			allowTokenForUrl: true,
		});

		expect(seen.map((entry) => entry.authorization)).toEqual(["Bearer secret-token", "Bearer secret-token"]);
	});

	it("stops reading chunked remote catalogs after the byte cap", async () => {
		let cancelled = false;
		const oversizedResponse = () =>
			new Response(
				new ReadableStream<Uint8Array>({
					pull(controller) {
						controller.enqueue(new Uint8Array(MAX_REMOTE_CATALOG_BYTES + 1));
					},
					cancel() {
						cancelled = true;
					},
				}),
			);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL | Request) =>
				String(input).includes("models") ? oversizedResponse() : new Response(mcpCatalog()),
			),
		);

		await expect(
			generateBundledCatalogAssets({
				outDir: tempDir(),
				modelsUrl: "https://example.test/models.json",
				mcpServicesUrl: "https://example.test/plugins.json",
				allowSmallFixture: true,
			}),
		).rejects.toThrow(/model catalog is too large/);
		expect(cancelled).toBe(true);
	});

	it("sends GitHub tokens to the trusted contents API fallback", async () => {
		process.env.GITHUB_TOKEN = "secret-token";
		const seen: Array<{ url: string; authorization?: string }> = [];
		const rawModelUrl =
			"https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent-catalog/main/models/catalog.v1.json";
		const rawMcpUrl =
			"https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent-catalog/main/plugins/catalog.v2.json";
		const apiModelUrl =
			"https://api.github.com/repos/PrimeIntellect-ai/prime-agent-catalog/contents/models/catalog.v1.json?ref=main";
		const apiMcpUrl =
			"https://api.github.com/repos/PrimeIntellect-ai/prime-agent-catalog/contents/plugins/catalog.v2.json?ref=main";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
				const url = String(input);
				const headers = new Headers(init?.headers);
				seen.push({ url, authorization: headers.get("authorization") ?? undefined });
				if (url === rawModelUrl || url === rawMcpUrl) return new Response("not found", { status: 404 });
				if (url === apiModelUrl) return new Response(modelCatalog());
				if (url === apiMcpUrl) return new Response(mcpCatalog());
				return new Response("unexpected url", { status: 500 });
			}),
		);

		await generateBundledCatalogAssets({ outDir: tempDir(), allowSmallFixture: true });

		expect(seen).toHaveLength(4);
		expect(seen.every((entry) => entry.authorization === "Bearer secret-token")).toBe(true);
		expect(seen.filter((entry) => entry.url === rawModelUrl || entry.url === rawMcpUrl)).toHaveLength(2);
		expect(seen.filter((entry) => entry.url === apiModelUrl || entry.url === apiMcpUrl)).toHaveLength(2);
	});

	it("copies generated flat source assets into dist", async () => {
		const outDir = tempDir();
		const catalogDir = join(process.cwd(), "catalog");
		expect(existsSync(join(catalogDir, "models.bundled.json"))).toBe(true);
		expect(existsSync(join(catalogDir, "mcp-services.bundled.json"))).toBe(true);

		await copySourceCatalogAssets({ outDir, allowSmallFixture: true });

		expect(readFileSync(join(outDir, "models.bundled.json"), "utf8")).toBe(
			readFileSync(join(catalogDir, "models.bundled.json"), "utf8"),
		);
		expect(readFileSync(join(outDir, "mcp-services.bundled.json"), "utf8")).toBe(
			readFileSync(join(catalogDir, "mcp-services.bundled.json"), "utf8"),
		);
	});

	it("validates model catalog cost forms and rejects invalid costs", () => {
		const file = join(tempDir(), "models.bundled.json");
		const rates = { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 };
		for (const cost of [
			rates,
			{ source: "none" },
			{ source: "none", partial: rates, missingCount: 1 },
			{ source: "provider", value: rates },
			{ source: "aggregate", value: rates },
		]) {
			writeFileSync(file, modelCatalog(cost));
			expect(validateBundledModelCatalog(file, { allowSmallFixture: true }).models).toBe(1);
		}
		for (const cost of [{ source: "bogus" }, { ...rates, input: -1 }, { source: "none", missingCount: -1 }]) {
			writeFileSync(file, modelCatalog(cost));
			expect(() => validateBundledModelCatalog(file, { allowSmallFixture: true })).toThrow(/invalid cost/);
		}
	});

	it("generates small fixture catalog with unpriced and openrouter models", async () => {
		const outDir = tempDir();
		await generateBundledCatalogAssets({ outDir, fixture: true });
		const catalog = JSON.parse(readFileSync(join(outDir, "models.bundled.json"), "utf8")) as {
			models: Array<{ id: string; cost: { source?: string } }>;
		};
		expect(catalog.models).toHaveLength(6);
		expect(catalog.models.find((m) => m.id === "fixture-unpriced")?.cost).toEqual({ source: "none" });
		expect(catalog.models.find((m) => m.id === "fixture-openrouter")?.cost.source).toBe("provider");
	});
});
