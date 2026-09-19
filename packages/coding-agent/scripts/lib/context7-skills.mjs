/**
 * Context7 Skills Client & Utility Module
 * Co-authored-by: Gemini Flash 3.8 (agy v1.2.7)
 */
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = process.env.CONTEXT7_BASE_URL || "https://context7.com";

function normalizeProject(project) {
	if (!project) return "";
	return project.startsWith("/") ? project : `/${project}`;
}

async function requestJson(url, options = {}) {
	const { timeoutMs = 15000, signal, ...fetchOptions } = options;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	const combinedSignal = signal
		? AbortSignal.any([signal, controller.signal])
		: controller.signal;

	try {
		const res = await fetch(url, { ...fetchOptions, signal: combinedSignal });
		if (!res.ok) {
			const errorText = await res.text().catch(() => "");
			throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function searchSkills(query, options = {}) {
	const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
	const params = new URLSearchParams({ query });
	const url = `${baseUrl}/api/v2/skills?${params.toString()}`;
	const data = await requestJson(url, options);
	return data.results || [];
}

export async function getSkill(project, skillName, options = {}) {
	const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
	const params = new URLSearchParams({
		project: normalizeProject(project),
		skill: skillName,
	});
	const url = `${baseUrl}/api/v2/skills?${params.toString()}`;
	const data = await requestJson(url, options);
	if (data && data.name) {
		return data;
	}
	return null;
}

export async function suggestSkills(dependencies, options = {}) {
	const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
	const deps = Array.isArray(dependencies)
		? dependencies
		: typeof dependencies === "object" && dependencies !== null
			? Object.keys(dependencies)
			: [];

	const headers = { "Content-Type": "application/json" };
	if (options.accessToken) {
		headers.Authorization = `Bearer ${options.accessToken}`;
	}

	const url = `${baseUrl}/api/v2/skills/suggest`;
	const data = await requestJson(url, {
		method: "POST",
		headers,
		body: JSON.stringify({ dependencies: deps }),
		...options,
	});
	return data.skills || data.results || [];
}

export async function fetchSkillContent(target, options = {}) {
	const url = typeof target === "string" ? target : target?.url;
	if (!url) {
		throw new Error("No URL provided to fetchSkillContent");
	}

	const { timeoutMs = 15000, signal } = options;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	const combinedSignal = signal
		? AbortSignal.any([signal, controller.signal])
		: controller.signal;

	try {
		const res = await fetch(url, { signal: combinedSignal });
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} fetching ${url}: ${res.statusText}`);
		}
		return await res.text();
	} finally {
		clearTimeout(timeoutId);
	}
}

const SPEC_PATTERNS = [
	/\bkeep\s*a\s*changelog\b/i,
	/\bconventional\s*commits?\b/i,
	/\bsemantic\s*version(ing)?\b/i,
	/\bsemver\b/i,
	/\bsemantic[- ]release\b/i,
	/\bopenapi\b/i,
	/\bspecification\b/i,
	/\bstandards?\b/i,
];

export function findSpecificationSkills(skills, options = {}) {
	const patterns = options.patterns || SPEC_PATTERNS;
	const minTrust = options.minTrust ?? 0;

	return skills.filter((skill) => {
		if (skill.trustScore !== undefined && skill.trustScore < minTrust) {
			return false;
		}
		const haystack = `${skill.name} ${skill.description || ""}`;
		return patterns.some((re) => re.test(haystack));
	});
}

export function filterSkills(skills, criteria) {
	if (typeof criteria === "function") {
		return skills.filter(criteria);
	}
	const { project, minTrust, minInstalls, query } = criteria || {};
	const q = query ? query.toLowerCase() : null;

	return skills.filter((skill) => {
		if (project && skill.project !== normalizeProject(project)) return false;
		if (minTrust !== undefined && (skill.trustScore ?? 0) < minTrust) return false;
		if (minInstalls !== undefined && (skill.installCount ?? 0) < minInstalls) return false;
		if (q) {
			const text = `${skill.name} ${skill.description || ""}`.toLowerCase();
			if (!text.includes(q)) return false;
		}
		return true;
	});
}

export function formatSkillSummary(skill) {
	const trust = skill.trustScore !== undefined ? `trust: ${skill.trustScore}` : null;
	const installs = skill.installCount !== undefined ? `installs: ${skill.installCount}` : null;
	const meta = [trust, installs].filter(Boolean).join(", ");
	const metaStr = meta ? ` [${meta}]` : "";
	const desc = skill.description ? ` - ${skill.description}` : "";
	return `${skill.name} (${skill.project})${metaStr}${desc}`;
}

export async function runCli(args = process.argv.slice(2)) {
	const command = args[0];
	const isJson = args.includes("--json");
	const isSpecOnly = args.includes("--spec");

	if (!command || command === "--help" || command === "-h") {
		console.log(`Usage: context7-skills <command> [options]

Commands:
  search <query> [--json] [--spec]    Search skills registry
  get <project> <skill> [--json]      Get metadata for a skill
  fetch <url>                         Fetch raw SKILL.md / markdown
  suggest <dep1> [dep2...] [--json]   Suggest skills for dependencies
`);
		return;
	}

	if (command === "search") {
		const query = args[1];
		if (!query) {
			console.error("Error: search requires a query string");
			process.exitCode = 1;
			return;
		}
		let results = await searchSkills(query);
		if (isSpecOnly) {
			results = findSpecificationSkills(results);
		}
		if (isJson) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Found ${results.length} skill(s):\n`);
			for (const skill of results) {
				console.log(formatSkillSummary(skill));
			}
		}
		return;
	}

	if (command === "get") {
		const project = args[1];
		const skillName = args[2];
		if (!project || !skillName) {
			console.error("Error: get requires <project> and <skill>");
			process.exitCode = 1;
			return;
		}
		const skill = await getSkill(project, skillName);
		if (!skill) {
			console.error(`Skill not found: ${project}/${skillName}`);
			process.exitCode = 1;
			return;
		}
		if (isJson) {
			console.log(JSON.stringify(skill, null, 2));
		} else {
			console.log(formatSkillSummary(skill));
			if (skill.url) console.log(`URL: ${skill.url}`);
		}
		return;
	}

	if (command === "fetch") {
		const target = args[1];
		if (!target) {
			console.error("Error: fetch requires a URL or project + skill");
			process.exitCode = 1;
			return;
		}
		let url = target;
		if (!target.startsWith("http") && args[2]) {
			const skill = await getSkill(target, args[2]);
			if (!skill?.url) {
				console.error(`No URL available for ${target}/${args[2]}`);
				process.exitCode = 1;
				return;
			}
			url = skill.url;
		}
		const content = await fetchSkillContent(url);
		console.log(content);
		return;
	}

	if (command === "suggest") {
		const deps = args.slice(1).filter((arg) => !arg.startsWith("--"));
		const results = await suggestSkills(deps);
		if (isJson) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Suggested ${results.length} skill(s):\n`);
			for (const skill of results) {
				console.log(formatSkillSummary(skill));
			}
		}
		return;
	}

	console.error(`Unknown command: ${command}`);
	process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	runCli().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
