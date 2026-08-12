import { randomUUID } from "node:crypto";
import {
	chmodSync,
	closeSync,
	constants,
	fchmodSync,
	fchownSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	type Stats,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

const NONBLOCK_FLAG = constants.O_NONBLOCK ?? 0;
const DIRECTORY_FLAG = constants.O_DIRECTORY ?? 0;
const NOFOLLOW_FLAG = constants.O_NOFOLLOW ?? 0;

function pathExistsLexical(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}

function sameFileIdentity(
	left: { dev: number | bigint; ino: number | bigint },
	right: { dev: number | bigint; ino: number | bigint },
): boolean {
	return left.dev === right.dev && left.ino === right.ino;
}

function ensureNoSymlinkPath(path: string, mode: number): void {
	const target = resolve(path);
	const root = parse(target).root;
	let current = root;
	for (const component of target.slice(root.length).split(/[/\\]/).filter(Boolean)) {
		current = join(current, component);
		if (!pathExistsLexical(current)) {
			try {
				mkdirSync(current, { mode });
			} catch (error) {
				if (!isAlreadyExistsError(error)) throw error;
			}
		}
		const stats = lstatSync(current);
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			throw new Error(`Refusing to use non-directory private path: ${current}`);
		}
	}
}

export function assertSafeDirectoryPath(path: string, options: { requirePrivateMode?: boolean } = {}): void {
	const target = resolve(path);
	const root = parse(target).root;
	let current = root;
	for (const component of target.slice(root.length).split(/[/\\]/).filter(Boolean)) {
		current = join(current, component);
		let stats: ReturnType<typeof lstatSync>;
		try {
			stats = lstatSync(current);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
			throw error;
		}
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			throw new Error(`Refusing to use non-directory private path: ${current}`);
		}
		if (current === target && options.requirePrivateMode && process.platform !== "win32") {
			if ((stats.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) {
				throw new Error(`Refusing to read non-private directory: ${current}`);
			}
		}
	}
}

function setPrivateFileMode(fd: number, path: string, mode: number): void {
	if (process.platform === "win32") {
		chmodSync(path, mode);
		const pathStats = lstatSync(path);
		const openedStats = fstatSync(fd);
		if (pathStats.isSymbolicLink() || !sameFileIdentity(pathStats, openedStats)) {
			throw new Error(`Private file changed while setting its mode: ${path}`);
		}
	} else {
		fchmodSync(fd, mode);
	}
}

function isAlreadyExistsError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function openRegularFileNoSymlink(path: string, flags: number): number {
	const before = lstatSync(path);
	if (before.isSymbolicLink() || !before.isFile()) {
		throw new Error(`Refusing to use non-regular private file: ${path}`);
	}
	const fd = openSync(path, flags | NOFOLLOW_FLAG | NONBLOCK_FLAG);
	const opened = fstatSync(fd);
	let after: Stats;
	try {
		after = lstatSync(path);
	} catch (error) {
		closeSync(fd);
		throw error;
	}
	if (
		!opened.isFile() ||
		after.isSymbolicLink() ||
		!after.isFile() ||
		!sameFileIdentity(before, opened) ||
		!sameFileIdentity(opened, after)
	) {
		closeSync(fd);
		throw new Error(`Refusing to use non-regular private file: ${path}`);
	}
	return fd;
}

export function assertRegularFileNoSymlink(path: string): void {
	const stats = lstatSync(path);
	if (stats.isSymbolicLink() || !stats.isFile()) {
		throw new Error(`Refusing to use non-regular private file: ${path}`);
	}
}

export function ensurePrivateDirectory(path: string): void {
	ensureNoSymlinkPath(path, PRIVATE_DIRECTORY_MODE);
	const before = lstatSync(path);
	if (before.isSymbolicLink() || !before.isDirectory()) {
		throw new Error(`Refusing to use non-directory private path: ${path}`);
	}
	if (process.platform === "win32") {
		if ((before.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) chmodSync(path, PRIVATE_DIRECTORY_MODE);
		const after = lstatSync(path);
		if (after.isSymbolicLink() || !after.isDirectory() || !sameFileIdentity(before, after)) {
			throw new Error(`Private directory changed while setting its mode: ${path}`);
		}
		return;
	}
	const fd = openSync(path, constants.O_RDONLY | DIRECTORY_FLAG | NOFOLLOW_FLAG);
	try {
		const openedStats = fstatSync(fd);
		const after = lstatSync(path);
		if (
			!openedStats.isDirectory() ||
			after.isSymbolicLink() ||
			!after.isDirectory() ||
			!sameFileIdentity(before, openedStats) ||
			!sameFileIdentity(openedStats, after)
		) {
			throw new Error(`Refusing to use non-directory private path: ${path}`);
		}
		if ((openedStats.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) {
			setPrivateFileMode(fd, path, PRIVATE_DIRECTORY_MODE);
		}
	} finally {
		closeSync(fd);
	}
}

export function ensurePrivateFile(path: string, initialContent = ""): void {
	ensurePrivateDirectory(dirname(path));
	if (!pathExistsLexical(path)) {
		let fd: number | undefined;
		try {
			fd = openSync(
				path,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW_FLAG,
				PRIVATE_FILE_MODE,
			);
			if (!fstatSync(fd).isFile()) throw new Error(`Refusing to use non-regular private file: ${path}`);
			writeFileSync(fd, initialContent);
		} catch (error) {
			// Another process may have won the exclusive-create race. The regular-file
			// check below validates its result without ever following a symlink.
			if (!isAlreadyExistsError(error)) {
				if (fd !== undefined) {
					const created = fstatSync(fd);
					closeSync(fd);
					fd = undefined;
					try {
						const current = lstatSync(path);
						if (current.dev === created.dev && current.ino === created.ino) rmSync(path, { force: true });
					} catch (cleanupError) {
						if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
							throw cleanupError;
						}
					}
				}
				throw error;
			}
		} finally {
			if (fd !== undefined) closeSync(fd);
		}
	}
	const privateFd = openRegularFileNoSymlink(path, constants.O_RDONLY);
	try {
		setPrivateFileMode(privateFd, path, PRIVATE_FILE_MODE);
	} finally {
		closeSync(privateFd);
	}
}

export function readPrivateFile(path: string, encoding: BufferEncoding): string {
	const fd = openRegularFileNoSymlink(path, constants.O_RDONLY);
	try {
		setPrivateFileMode(fd, path, PRIVATE_FILE_MODE);
		return readFileSync(fd, encoding);
	} finally {
		closeSync(fd);
	}
}

function assertDirectoryIdentity(path: string, expected: Stats): void {
	const current = lstatSync(path);
	if (current.isSymbolicLink() || !current.isDirectory() || !sameFileIdentity(current, expected)) {
		throw new Error(`Private directory changed during file operation: ${path}`);
	}
}

function removeMatchingFile(path: string, expected: Stats | undefined): void {
	if (!expected) return;
	try {
		const current = lstatSync(path);
		if (!current.isSymbolicLink() && current.isFile() && sameFileIdentity(current, expected)) {
			rmSync(path, { force: true });
		}
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
	}
}

export function writePrivateFileAtomic(
	path: string,
	content: string | Uint8Array,
	options: { privateParent?: boolean } = {},
): void {
	const parent = dirname(path);
	if (options.privateParent === false) {
		const parentExisted = pathExistsLexical(parent);
		ensureNoSymlinkPath(parent, PRIVATE_DIRECTORY_MODE);
		const parentStats = lstatSync(parent);
		if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) {
			throw new Error(`Refusing to use non-directory private path: ${parent}`);
		}
		if (!parentExisted) chmodSync(parent, PRIVATE_DIRECTORY_MODE);
	} else {
		ensurePrivateDirectory(parent);
	}
	const parentIdentity = lstatSync(parent);
	if (pathExistsLexical(path)) {
		assertRegularFileNoSymlink(path);
	}
	const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
	let fd: number | undefined;
	let tempIdentity: Stats | undefined;
	try {
		fd = openSync(
			tempPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW_FLAG,
			PRIVATE_FILE_MODE,
		);
		tempIdentity = fstatSync(fd);
		if (!tempIdentity.isFile()) throw new Error(`Refusing to use non-regular private file: ${tempPath}`);
		writeFileSync(fd, content);
		setPrivateFileMode(fd, tempPath, PRIVATE_FILE_MODE);
		fsyncSync(fd);
		closeSync(fd);
		fd = undefined;
		assertDirectoryIdentity(parent, parentIdentity);
		if (pathExistsLexical(path)) assertRegularFileNoSymlink(path);
		renameSync(tempPath, path);
	} finally {
		if (fd !== undefined) closeSync(fd);
		removeMatchingFile(tempPath, tempIdentity);
	}
}

export function writePrivateFileAtomicLines(
	path: string,
	lines: Iterable<string>,
	options: { preserveOwnership?: boolean } = {},
): void {
	ensurePrivateDirectory(dirname(path));
	const parent = dirname(path);
	const parentIdentity = lstatSync(parent);
	if (pathExistsLexical(path)) assertRegularFileNoSymlink(path);
	const metadata = options.preserveOwnership && pathExistsLexical(path) ? lstatSync(path) : undefined;
	const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
	let fd: number | undefined;
	let tempIdentity: Stats | undefined;
	try {
		fd = openSync(
			tempPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW_FLAG,
			PRIVATE_FILE_MODE,
		);
		tempIdentity = fstatSync(fd);
		if (!tempIdentity.isFile()) throw new Error(`Refusing to use non-regular private file: ${tempPath}`);
		for (const line of lines) writeFileSync(fd, line);
		setPrivateFileMode(fd, tempPath, PRIVATE_FILE_MODE);
		fsyncSync(fd);
		if (metadata && process.platform !== "win32") fchownSync(fd, metadata.uid, metadata.gid);
		closeSync(fd);
		fd = undefined;
		assertDirectoryIdentity(parent, parentIdentity);
		if (pathExistsLexical(path)) assertRegularFileNoSymlink(path);
		renameSync(tempPath, path);
	} finally {
		if (fd !== undefined) closeSync(fd);
		removeMatchingFile(tempPath, tempIdentity);
	}
}

export function appendPrivateFile(path: string, content: string): void {
	const parent = dirname(path);
	ensurePrivateDirectory(parent);
	const parentIdentity = lstatSync(parent);
	let flags = constants.O_WRONLY | constants.O_APPEND | NOFOLLOW_FLAG | NONBLOCK_FLAG;
	const exists = pathExistsLexical(path);
	if (exists) {
		assertRegularFileNoSymlink(path);
	} else {
		flags |= constants.O_CREAT | constants.O_EXCL;
	}
	let fd: number;
	try {
		assertDirectoryIdentity(parent, parentIdentity);
		fd = openSync(path, flags, PRIVATE_FILE_MODE);
	} catch (error) {
		if (!isAlreadyExistsError(error) || exists) throw error;
		fd = openRegularFileNoSymlink(path, constants.O_WRONLY | constants.O_APPEND);
	}
	try {
		if (!fstatSync(fd).isFile()) throw new Error(`Refusing to use non-regular private file: ${path}`);
		setPrivateFileMode(fd, path, PRIVATE_FILE_MODE);
		writeFileSync(fd, content);
	} finally {
		closeSync(fd);
	}
}

export interface PrivateTempFile {
	path: string;
	directory: string;
}

export function createPrivateTempFile(prefix: string, suffix: string, content = ""): PrivateTempFile {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	chmodSync(directory, PRIVATE_DIRECTORY_MODE);
	const directoryStats = lstatSync(directory);
	if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
		throw new Error(`Refusing to use non-directory private path: ${directory}`);
	}
	const path = join(directory, `${randomUUID()}${suffix}`);
	try {
		ensurePrivateFile(path, content);
		return { path, directory };
	} catch (error) {
		rmSync(directory, { recursive: true, force: true });
		throw error;
	}
}
