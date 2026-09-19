#!/usr/bin/env node
// Co-authored-by: Gemini Flash 3.8 (agy v1.2.7)
import { runCli } from "./lib/context7-skills.mjs";

runCli(process.argv.slice(2)).catch((err) => {
	console.error(err);
	process.exit(1);
});
