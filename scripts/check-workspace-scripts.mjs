import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPaths = [
	"package.json",
	"packages/agent/package.json",
	"packages/ai/package.json",
	"packages/coding-agent/package.json",
	"packages/tui/package.json",
];

const manifests = new Map(
	manifestPaths.map((path) => [path, JSON.parse(readFileSync(resolve(root, path), "utf8"))]),
);
const rootScripts = manifests.get("package.json").scripts;
const recursiveRootScripts = ["clean", "test", "publish", "publish:dry"];

for (const scriptName of recursiveRootScripts) {
	const command = rootScripts[scriptName];
	assert(command, `missing root script: ${scriptName}`);
	assert(
		command.includes("--filter '!prime-agent'"),
		`root script ${scriptName} must exclude prime-agent from recursive execution: ${command}`,
	);
}

for (const [path, manifest] of manifests) {
	for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
		assert(
			!/(^|&&\s*|\|\|\s*)(npm|npx)(\s|$)/.test(command),
			`${path} script ${scriptName} still invokes ${command}`,
		);
	}
}

console.log("Workspace script check passed.");

function assert(condition, message) {
	if (!condition) throw new Error(message);
}
