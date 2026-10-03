import { mkdirSync, readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeFileAtomicSync } from "../utils/atomic-file.js";
import { readLinesAsBuffers } from "../utils/file-lines.js";

const USED_MODELS_CACHE_VERSION = 1;
const MODEL_CHANGE_MARKER = '"type":"model_change"';

export interface UsedModel {
	provider: string;
	modelId: string;
	lastUsed: number;
}

interface UsedModelsFile {
	size: number;
	mtimeMs: number;
	ino: number;
	models: UsedModel[];
}

export interface UsedModelsCache {
	version: number;
	files: Record<string, UsedModelsFile>;
}

const emptyCache = (): UsedModelsCache => ({ version: USED_MODELS_CACHE_VERSION, files: {} });

export function loadUsedModelsCache(cachePath: string): UsedModelsCache {
	try {
		const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as Partial<UsedModelsCache> | null;
		if (parsed?.version === USED_MODELS_CACHE_VERSION && parsed.files && typeof parsed.files === "object") {
			return { version: USED_MODELS_CACHE_VERSION, files: parsed.files };
		}
	} catch {
		// Missing or corrupt cache: rebuild from sessions.
	}
	return emptyCache();
}

export function listUsedModels(cache: UsedModelsCache): UsedModel[] {
	const latest = new Map<string, UsedModel>();
	for (const file of Object.values(cache.files)) {
		for (const model of file.models ?? []) {
			const key = `${model.provider}\0${model.modelId}`;
			const known = latest.get(key);
			if (!known || model.lastUsed > known.lastUsed) latest.set(key, model);
		}
	}
	return [...latest.values()];
}

async function scanFile(path: string): Promise<UsedModel[]> {
	const latest = new Map<string, UsedModel>();
	for await (const line of readLinesAsBuffers(path)) {
		if (!line.includes(MODEL_CHANGE_MARKER)) continue;
		try {
			const entry = JSON.parse(line.toString("utf8")) as {
				type?: unknown;
				provider?: unknown;
				modelId?: unknown;
				timestamp?: unknown;
			};
			if (entry.type !== "model_change") continue;
			if (typeof entry.provider !== "string" || typeof entry.modelId !== "string") continue;
			if (!entry.provider || !entry.modelId) continue;
			const parsed = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;
			const lastUsed = Number.isFinite(parsed) ? parsed : 0;
			const key = `${entry.provider}\0${entry.modelId}`;
			const known = latest.get(key);
			if (!known || lastUsed > known.lastUsed) {
				latest.set(key, { provider: entry.provider, modelId: entry.modelId, lastUsed });
			}
		} catch {
			// Skip malformed lines.
		}
	}
	return [...latest.values()];
}

/** Incrementally scan session files for model_change entries, persist the cache, and return the used models. */
export async function scanUsedModels(sessionsDir: string, cachePath: string): Promise<UsedModel[]> {
	const previous = loadUsedModelsCache(cachePath);
	const next = emptyCache();
	let changed = false;
	try {
		for (const name of await readdir(sessionsDir)) {
			if (!name.endsWith(".jsonl")) continue;
			const path = join(sessionsDir, name);
			try {
				const info = await stat(path);
				const known = previous.files[path];
				if (known && known.size === info.size && known.mtimeMs === info.mtimeMs && known.ino === info.ino) {
					next.files[path] = known;
					continue;
				}
				next.files[path] = {
					size: info.size,
					mtimeMs: info.mtimeMs,
					ino: info.ino,
					models: await scanFile(path),
				};
				changed = true;
			} catch {
				// Unreadable or vanished file: leave it out.
			}
		}
	} catch {
		// Missing sessions directory: nothing used yet.
	}
	changed ||= Object.keys(previous.files).some((path) => !(path in next.files));
	if (changed) {
		try {
			mkdirSync(dirname(cachePath), { recursive: true });
			writeFileAtomicSync(cachePath, JSON.stringify(next));
		} catch {
			// Cache is an optimization only.
		}
	}
	return listUsedModels(next);
}
