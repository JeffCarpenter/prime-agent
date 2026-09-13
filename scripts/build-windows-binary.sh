#!/usr/bin/env bash
#
# Build the standalone Prime Agent distribution for Windows x64.
#
# Usage:
#   ./scripts/build-windows-binary.sh [--skip-deps]
#
# Options:
#   --skip-deps  Reuse the installed dependencies
#   --help       Show this help
#
# Output:
#   packages/coding-agent/binaries/pi-windows-x64.zip

set -euo pipefail

skip_deps=false
case "${1:-}" in
	"") ;;
	--skip-deps) skip_deps=true ;;
	--help|-h)
		sed -n '3,14s/^# \{0,1\}//p' "$0"
		exit 0
		;;
	*)
		printf 'Unknown option: %s\n' "$1" >&2
		exit 1
		;;
esac

if [[ $# -gt 1 ]]; then
	printf '%s\n' 'Only --skip-deps is supported' >&2
	exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ "$skip_deps" == "false" ]]; then
	host_os="$(node -p 'process.platform')"
	host_cpu="$(node -p 'process.arch')"
	install_args=(--frozen-lockfile --os "$host_os" --cpu "$host_cpu")
	if [[ "$host_os" != "win32" ]]; then
		install_args+=(--os win32)
	fi
	if [[ "$host_cpu" != "x64" ]]; then
		install_args+=(--cpu x64)
	fi
	pnpm install "${install_args[@]}"
fi

pnpm run build

binary_root="$root/packages/coding-agent/binaries"
platform_dir="$binary_root/windows-x64"
archive="$binary_root/pi-windows-x64.zip"

rm -rf "$platform_dir"
rm -f "$archive"
mkdir -p "$platform_dir"

bun build --compile --external koffi --target=bun-windows-x64 "$root/packages/coding-agent/dist/bun/cli.js" \
	--outfile "$platform_dir/pi.exe"
chmod +x "$platform_dir/pi.exe"

copy_contents() {
	local source="$1"
	local destination="$2"
	mkdir -p "$destination"
	cp -r "$source"/* "$destination/"
}

cp "$root/packages/coding-agent/package.json" "$platform_dir/"
cp "$root/packages/coding-agent/README.md" "$platform_dir/"
cp "$root/packages/coding-agent/CHANGELOG.md" "$platform_dir/"
cp "$root/node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm" "$platform_dir/"
copy_contents "$root/packages/coding-agent/dist/modes/interactive/theme" "$platform_dir/theme"
copy_contents "$root/packages/coding-agent/dist/modes/interactive/assets" "$platform_dir/assets"
cp -r "$root/packages/coding-agent/dist/core/export-html" "$platform_dir/"
copy_contents "$root/packages/coding-agent/docs" "$platform_dir/docs"
copy_contents "$root/packages/coding-agent/examples" "$platform_dir/examples"
copy_contents "$root/packages/coding-agent/skills" "$platform_dir/skills"

koffi_source="$root/node_modules/koffi/build/koffi/win32_x64/koffi.node"
koffi_dir="$platform_dir/node_modules/koffi/build/koffi/win32_x64"
mkdir -p "$koffi_dir"
cp "$root/node_modules/koffi/index.js" "$platform_dir/node_modules/koffi/"
cp "$root/node_modules/koffi/package.json" "$platform_dir/node_modules/koffi/"
cp "$koffi_source" "$koffi_dir/koffi.node"

(
	cd "$platform_dir"
	zip -rq "$archive" .
)

printf 'Created %s\n' "$archive"
