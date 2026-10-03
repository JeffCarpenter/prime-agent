import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("test policy uses the closest main ancestor locally and the push before commit in CI", () => {
	const root = mkdtempSync(join(tmpdir(), "test-policy-base-"));
	const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
	try {
		const script = join(root, "scripts/check-test-policy.mjs");
		const file = join(root, "packages/demo/test/base.test.ts");
		mkdirSync(join(root, "scripts"));
		mkdirSync(join(root, "packages/demo/test"), { recursive: true });
		writeFileSync(script, readFileSync(new URL("./check-test-policy.mjs", import.meta.url)));
		git("init", "-q");
		git("config", "user.name", "Policy Test");
		git("config", "user.email", "policy@example.test");
		const commit = (text) => {
			writeFileSync(file, text);
			git("add", ".");
			git("commit", "-qm", "fixture");
			return git("rev-parse", "HEAD");
		};
		const first = commit('test("old", () => {});\n');
		git("update-ref", "refs/remotes/origin/main", first);
		const before = commit('test.skip("old", () => {});\n');
		git("update-ref", "refs/remotes/upstream/main", before);
		writeFileSync(join(root, "README.md"), "next");
		git("add", "README.md");
		git("commit", "-qm", "next");
		const check = (env = {}) => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", env: { ...process.env, TEST_POLICY_BASE: "", GITHUB_EVENT_NAME: "", GITHUB_BASE_REF: "", ...env } });
		assert.equal(check().status, 0, check().stderr);
		writeFileSync(file, 'test.skip("old", () => {});\ntest.only("new", () => {});\n');
		git("add", file);
		assert.equal(check().status, 1);
		git("commit", "-qm", "new violation"); git("update-ref", "refs/remotes/origin/main", "HEAD");
		const event = join(root, "push.json"); writeFileSync(event, JSON.stringify({ before: first }));
		const pushed = check({ GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: event });
		assert.equal(pushed.status, 1);
		assert.match(pushed.stderr, /old: \.skip/);
		assert.match(pushed.stderr, /new: \.only/);
	} finally { rmSync(root, { recursive: true, force: true }); }
});
