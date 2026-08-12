#!/usr/bin/env python3

import stat
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_ENTRY_BYTES = 512 * 1024 * 1024
MAX_ENTRY_COUNT = 10_000
MAX_EXPANDED_BYTES = 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 1_000


def fail(message: str) -> None:
    raise ValueError(message)


def validate_archive_file(path: Path) -> None:
    archive_stat = path.lstat()
    if not stat.S_ISREG(archive_stat.st_mode):
        fail(f"Archive must be a regular file: {path}")
    if archive_stat.st_size > MAX_ARCHIVE_BYTES:
        fail(f"Archive exceeds {MAX_ARCHIVE_BYTES} bytes: {path}")


def validate_member_name(name: str, *, top_level: bool) -> PurePosixPath:
    if not name or "\\" in name or "\0" in name:
        fail(f"Unsafe archive member name: {name!r}")
    member = PurePosixPath(name)
    if member.is_absolute() or any(part in ("", ".", "..") for part in member.parts):
        fail(f"Unsafe archive member path: {name}")
    if top_level and len(member.parts) != 1:
        fail(f"Artifact ZIP entries must be top-level files: {name}")
    return member


def extract_zip(archive_path: Path, destination: Path, expected_name: str | None) -> None:
    validate_archive_file(archive_path)
    if destination.exists() and any(destination.iterdir()):
        fail(f"Archive destination must be empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    expanded_bytes = 0
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_ENTRY_COUNT:
            fail(f"ZIP entry count must be between 1 and {MAX_ENTRY_COUNT}")
        for entry in entries:
            member = validate_member_name(entry.filename, top_level=True)
            normalized = member.as_posix()
            if normalized in seen:
                fail(f"Duplicate ZIP entry: {normalized}")
            seen.add(normalized)
            mode = (entry.external_attr >> 16) & 0xFFFF
            file_type = stat.S_IFMT(mode)
            if entry.is_dir() or file_type not in (0, stat.S_IFREG):
                fail(f"ZIP entry must be a regular file: {normalized}")
            if entry.flag_bits & 0x1:
                fail(f"Encrypted ZIP entries are not supported: {normalized}")
            if entry.file_size > MAX_ENTRY_BYTES:
                fail(f"ZIP entry exceeds {MAX_ENTRY_BYTES} bytes: {normalized}")
            expanded_bytes += entry.file_size
            if expanded_bytes > MAX_EXPANDED_BYTES:
                fail(f"ZIP expands beyond {MAX_EXPANDED_BYTES} bytes")
            if entry.file_size and (
                entry.compress_size == 0 or entry.file_size > entry.compress_size * MAX_COMPRESSION_RATIO
            ):
                fail(f"ZIP entry compression ratio is unsafe: {normalized}")
            target = destination / normalized
            written = 0
            with archive.open(entry) as source, target.open("xb") as output:
                while chunk := source.read(1024 * 1024):
                    written += len(chunk)
                    if written > entry.file_size or written > MAX_ENTRY_BYTES:
                        fail(f"ZIP entry expanded beyond its declared size: {normalized}")
                    output.write(chunk)
            if written != entry.file_size:
                fail(f"ZIP entry size changed during extraction: {normalized}")
    if expected_name is not None and seen != {expected_name}:
        fail(f"ZIP must contain exactly {expected_name}; found {', '.join(sorted(seen))}")


def inspect_tar(archive_path: Path) -> None:
    validate_archive_file(archive_path)
    seen: set[str] = set()
    expanded_bytes = 0
    package_json_count = 0
    with tarfile.open(archive_path, mode="r|gz") as archive:
        for count, entry in enumerate(archive, start=1):
            if count > MAX_ENTRY_COUNT:
                fail(f"Tar entry count exceeds {MAX_ENTRY_COUNT}")
            member = validate_member_name(entry.name.rstrip("/"), top_level=False)
            normalized = member.as_posix()
            if normalized in seen:
                fail(f"Duplicate tar entry: {normalized}")
            seen.add(normalized)
            if not (entry.isfile() or entry.isdir()):
                fail(f"Tar entry must be a regular file or directory: {normalized}")
            if entry.size < 0 or entry.size > MAX_ENTRY_BYTES:
                fail(f"Tar entry has an unsafe size: {normalized}")
            if entry.isfile():
                expanded_bytes += entry.size
                if expanded_bytes > MAX_EXPANDED_BYTES:
                    fail(f"Tar expands beyond {MAX_EXPANDED_BYTES} bytes")
            if normalized == "package/package.json":
                package_json_count += 1
                if not entry.isfile():
                    fail("package/package.json must be a regular file")
    if package_json_count != 1:
        fail(f"Tar must contain exactly one package/package.json; found {package_json_count}")


def main() -> None:
    if len(sys.argv) < 3:
        fail("Usage: safe-release-archive.py <extract-zip|inspect-tar> <archive> [destination] [expected-file]")
    operation = sys.argv[1]
    archive_path = Path(sys.argv[2]).resolve()
    if operation == "inspect-tar" and len(sys.argv) == 3:
        inspect_tar(archive_path)
        return
    if operation == "extract-zip" and len(sys.argv) in (4, 5):
        destination = Path(sys.argv[3]).resolve()
        expected_name = sys.argv[4] if len(sys.argv) == 5 else None
        extract_zip(archive_path, destination, expected_name)
        return
    fail("Usage: safe-release-archive.py <extract-zip|inspect-tar> <archive> [destination] [expected-file]")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, tarfile.TarError, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
