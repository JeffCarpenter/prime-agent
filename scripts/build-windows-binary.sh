#!/usr/bin/env bash
#
# Build the standalone Prime Agent distribution for Windows x64.
#
# Usage:
#   ./scripts/build-windows-binary.sh [options]
#
# Options:
#   --skip-deps        Reuse existing build / skip cargo build if binary exists
#   --target <triple>  Cargo target triple (default: x86_64-pc-windows-gnu)
#   --help, -h         Show this help
#
# Output:
#   packages/coding-agent/binaries/pi-windows-x64.zip

set -euo pipefail

skip_deps=false
target="${TARGET:-x86_64-pc-windows-gnu}"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--skip-deps)
			skip_deps=true
			shift
			;;
		--target)
			if [[ $# -lt 2 || -z "$2" || "$2" == --* ]]; then
				printf '%s requires a value\n' "$1" >&2
				exit 1
			fi
			target="$2"
			shift 2
			;;
		--help|-h)
			sed -n '3,15s/^# \{0,1\}//p' "$0"
			exit 0
			;;
		*)
			printf 'Unknown option: %s\n' "$1" >&2
			exit 1
			;;
	esac
done

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pkgver=$(sed -n '/^\[workspace\.package\]/,/^\[/s/^version = "\([^"]*\)"/\1/p' Cargo.toml | head -n1)
if [[ -z "$pkgver" ]]; then
	printf 'Error: unable to determine package version from Cargo.toml\n' >&2
	exit 1
fi

target_exe="$root/target/$target/release/prime-agent.exe"
fallback_exe="$root/target/release/prime-agent.exe"

if [[ "$skip_deps" == "false" || (! -f "$target_exe" && ! -f "$fallback_exe") ]]; then
	cargo build --manifest-path "$root/Cargo.toml" --release -p pa-cli --locked --target "$target"
fi

binary=""
if [[ -f "$target_exe" ]]; then
	binary="$target_exe"
elif [[ -f "$fallback_exe" ]]; then
	binary="$fallback_exe"
else
	printf 'Error: could not find compiled prime-agent.exe at %s or %s\n' "$target_exe" "$fallback_exe" >&2
	exit 1
fi

binary_root="$root/packages/coding-agent/binaries"
platform_dir="$binary_root/windows-x64"
archive="$binary_root/pi-windows-x64.zip"

rm -rf "$platform_dir"
rm -f "$archive"
mkdir -p "$platform_dir"

cp "$binary" "$platform_dir/prime-agent.exe"
cp "$binary" "$platform_dir/pi.exe"
chmod +x "$platform_dir/prime-agent.exe" "$platform_dir/pi.exe"

cp "$root/README.md" "$platform_dir/"
cp "$root/LICENSE" "$platform_dir/"

printf '{\n  "name": "prime-agent",\n  "version": "%s",\n  "description": "Prime Agent: the RLM coding agent (Rust build)",\n  "bin": {\n    "prime-agent": "prime-agent.exe"\n  },\n  "piConfig": {\n    "name": "prime-agent",\n    "configDir": ".prime/agent"\n  }\n}\n' \
	"$pkgver" > "$platform_dir/package.json"

rsync -a --exclude='/.git/' --exclude='/**/.git/' \
	--exclude='/**/.venv/' --exclude='/**/__pycache__/' \
	--exclude='/**/.pytest_cache/' --exclude='/**/.ruff_cache/' \
	--exclude='/**/.mypy_cache/' --exclude='/**/*.pyc' \
	--exclude='prime-agent-runtime/test/' \
	"$root/prime-agent-runtime" "$platform_dir/"

rsync -a --exclude='/.git/' --exclude='/**/.git/' \
	--exclude='/**/.venv/' --exclude='/**/__pycache__/' \
	"$root/skills" "$platform_dir/"

rsync -a --exclude='/.git/' --exclude='/**/.git/' \
	"$root/docs" "$platform_dir/"

if [[ -f "$root/models.bundled.json" ]]; then
	cp "$root/models.bundled.json" "$platform_dir/"
fi
if [[ -f "$root/mcp-services.bundled.json" ]]; then
	cp "$root/mcp-services.bundled.json" "$platform_dir/"
fi

(
	cd "$platform_dir"
	zip -rq "$archive" .
)

cp "$archive" "$binary_root/prime-agent-windows-x64.zip"

printf 'Created %s\n' "$archive"
