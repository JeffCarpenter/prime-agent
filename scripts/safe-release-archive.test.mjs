import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const inspector = fileURLToPath(new URL("safe-release-archive.py", import.meta.url));

function python(code, ...args) {
	const result = spawnSync("python3", ["-c", code, ...args], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
}

function inspect(...args) {
	return spawnSync("python3", [inspector, ...args], { encoding: "utf8" });
}

test("artifact ZIP extraction accepts only bounded top-level regular files", () => {
	const root = mkdtempSync(join(tmpdir(), "prime-agent-safe-zip-"));
	try {
		const valid = join(root, "valid.zip");
		python("import sys, zipfile; z=zipfile.ZipFile(sys.argv[1], 'w'); z.writestr('artifact.txt', b'ok'); z.close()", valid);
		const destination = join(root, "valid-out");
		assert.equal(inspect("extract-zip", valid, destination, "artifact.txt").status, 0);
		assert.equal(existsSync(join(destination, "artifact.txt")), true);

		const traversal = join(root, "traversal.zip");
		python("import sys, zipfile; z=zipfile.ZipFile(sys.argv[1], 'w'); z.writestr('../escape', b'bad'); z.close()", traversal);
		const traversalResult = inspect("extract-zip", traversal, join(root, "traversal-out"));
		assert.notEqual(traversalResult.status, 0);
		assert.match(traversalResult.stderr, /Unsafe archive member path/);
		assert.equal(existsSync(join(root, "escape")), false);

		const symlink = join(root, "symlink.zip");
		python(
			"import stat, sys, zipfile; z=zipfile.ZipFile(sys.argv[1], 'w'); i=zipfile.ZipInfo('link'); i.create_system=3; i.external_attr=(stat.S_IFLNK | 0o777) << 16; z.writestr(i, b'target'); z.close()",
			symlink,
		);
		const symlinkResult = inspect("extract-zip", symlink, join(root, "symlink-out"));
		assert.notEqual(symlinkResult.status, 0);
		assert.match(symlinkResult.stderr, /regular file/);

		const bomb = join(root, "bomb.zip");
		python(
			"import sys, zipfile; z=zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.ZIP_DEFLATED); z.writestr('bomb', b'0' * 2_000_000); z.close()",
			bomb,
		);
		const bombResult = inspect("extract-zip", bomb, join(root, "bomb-out"));
		assert.notEqual(bombResult.status, 0);
		assert.match(bombResult.stderr, /compression ratio is unsafe/);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("release tar inspection rejects traversal and link entries", () => {
	const root = mkdtempSync(join(tmpdir(), "prime-agent-safe-tar-"));
	try {
		const valid = join(root, "valid.tgz");
		python(
			"import io, sys, tarfile; t=tarfile.open(sys.argv[1], 'w:gz'); d=b'{}'; i=tarfile.TarInfo('package/package.json'); i.size=len(d); t.addfile(i, io.BytesIO(d)); t.close()",
			valid,
		);
		assert.equal(inspect("inspect-tar", valid).status, 0);

		const traversal = join(root, "traversal.tgz");
		python(
			"import io, sys, tarfile; t=tarfile.open(sys.argv[1], 'w:gz'); d=b'{}'; i=tarfile.TarInfo('../package/package.json'); i.size=len(d); t.addfile(i, io.BytesIO(d)); t.close()",
			traversal,
		);
		const traversalResult = inspect("inspect-tar", traversal);
		assert.notEqual(traversalResult.status, 0);
		assert.match(traversalResult.stderr, /Unsafe archive member path/);

		const symlink = join(root, "symlink.tgz");
		python(
			"import io, sys, tarfile; t=tarfile.open(sys.argv[1], 'w:gz'); d=b'{}'; i=tarfile.TarInfo('package/package.json'); i.size=len(d); t.addfile(i, io.BytesIO(d)); s=tarfile.TarInfo('package/link'); s.type=tarfile.SYMTYPE; s.linkname='package.json'; t.addfile(s); t.close()",
			symlink,
		);
		const symlinkResult = inspect("inspect-tar", symlink);
		assert.notEqual(symlinkResult.status, 0);
		assert.match(symlinkResult.stderr, /regular file or directory/);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
