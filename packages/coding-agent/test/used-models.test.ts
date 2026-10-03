import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadUsedModelsCache, scanUsedModels } from "../src/core/used-models.js";

const change = (provider: string, modelId: string, timestamp = "2026-01-01T00:00:00.000Z") =>
	JSON.stringify({ type: "model_change", id: "x", provider, modelId, timestamp });

describe("used models scan", () => {
	let dir: string;
	let sessions: string;
	let cache: string;
	const write = (name: string, ...lines: string[]) => writeFileSync(join(sessions, name), `${lines.join("\n")}\n`);

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "used-models-"));
		sessions = join(dir, "sessions");
		cache = join(dir, "models", "used-models.v1.json");
		mkdirSync(sessions);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	test.each([
		["model_change lines", [change("a", "m1")], [["a", "m1"]]],
		[
			"other and malformed lines",
			['{"type":"message"}', "not json", '{"type":"model_change"', change("a", "m1")],
			[["a", "m1"]],
		],
		["entries without ids", ['{"type":"model_change","provider":"a"}', change("", "m")], []],
	])("parses %s", async (_label, lines, expected) => {
		write("s.jsonl", ...lines);
		write("ignored.txt", change("z", "z"));
		const models = await scanUsedModels(sessions, cache);
		expect(models.map((m) => [m.provider, m.modelId])).toEqual(expected);
	});

	test("keeps the latest lastUsed across files", async () => {
		write("a.jsonl", change("p", "m", "2026-01-02T00:00:00.000Z"), change("p", "m", "2026-01-01T00:00:00.000Z"));
		write("b.jsonl", change("p", "m", "2026-01-01T12:00:00.000Z"));
		expect(await scanUsedModels(sessions, cache)).toEqual([
			{ provider: "p", modelId: "m", lastUsed: Date.parse("2026-01-02T00:00:00.000Z") },
		]);
	});

	test("rescans only changed files and drops deleted ones", async () => {
		write("a.jsonl", change("p", "old"));
		write("b.jsonl", change("p", "gone"));
		await scanUsedModels(sessions, cache);
		const stored = JSON.parse(readFileSync(cache, "utf8"));
		stored.files[join(sessions, "a.jsonl")].models = [{ provider: "p", modelId: "cached", lastUsed: 1 }];
		writeFileSync(cache, JSON.stringify(stored));
		rmSync(join(sessions, "b.jsonl"));
		write("c.jsonl", change("p", "new"));

		const ids = (await scanUsedModels(sessions, cache)).map((m) => m.modelId).sort();

		expect(ids).toEqual(["cached", "new"]);
		appendFileSync(join(sessions, "a.jsonl"), `${change("p", "appended")}\n`);
		expect((await scanUsedModels(sessions, cache)).map((m) => m.modelId).sort()).toEqual(["appended", "new", "old"]);
		rmSync(join(sessions, "a.jsonl"));
		await scanUsedModels(sessions, cache);
		expect(Object.keys(loadUsedModelsCache(cache).files)).toEqual([join(sessions, "c.jsonl")]);
	});

	test("rebuilds when the cache version changes", async () => {
		write("a.jsonl", change("p", "m"));
		await scanUsedModels(sessions, cache);
		const stored = JSON.parse(readFileSync(cache, "utf8"));
		stored.version = 0;
		stored.files[join(sessions, "a.jsonl")].models = [];
		writeFileSync(cache, JSON.stringify(stored));

		expect(loadUsedModelsCache(cache).files).toEqual({});
		expect((await scanUsedModels(sessions, cache)).map((m) => m.modelId)).toEqual(["m"]);
	});

	test("returns nothing for a missing sessions directory", async () => {
		expect(await scanUsedModels(join(dir, "none"), cache)).toEqual([]);
	});
});
