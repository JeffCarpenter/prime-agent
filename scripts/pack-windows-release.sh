#!/usr/bin/env bash
#
# Build the Windows x64 standalone archive and all Prime Agent release packages.
#
# Usage:
#   ./scripts/pack-windows-release.sh --base-url <url> [options]
#
# Options:
#   --base-url <url>          Release download base URL (or set PRIME_AGENT_DOWNLOAD_BASE_URL)
#   --channel stable|beta     Release channel (default: stable)
#   --version <version>       Release version (default: package version)
#   --out-dir <path>          Package output directory (default: packages/coding-agent/release/windows)
#   --skip-deps               Reuse the installed dependencies
#   --help                    Show this help
#
# Outputs:
#   packages/coding-agent/binaries/pi-windows-x64.zip
#   <out-dir>/artifacts/prime-agent-*.tgz and release metadata

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
binary_args=()
release_args=()
has_base_url=false
has_out_dir=false

while [[ $# -gt 0 ]]; do
	case "$1" in
		--skip-deps)
			binary_args+=("$1")
			shift
			;;
		--base-url|--channel|--version|--out-dir)
			option="$1"
			if [[ $# -lt 2 || -z "$2" || "$2" == --* ]]; then
				printf '%s requires a value\n' "$option" >&2
				exit 1
			fi
			if [[ "$option" == "--base-url" ]]; then
				has_base_url=true
			elif [[ "$option" == "--out-dir" ]]; then
				has_out_dir=true
			fi
			release_args+=("$option" "$2")
			shift 2
			;;
		--help|-h)
			sed -n '3,20s/^# \{0,1\}//p' "$0"
			exit 0
			;;
		*)
			printf 'Unknown option: %s\n' "$1" >&2
			exit 1
			;;
	esac
done

if [[ "$has_base_url" == "false" && -z "${PRIME_AGENT_DOWNLOAD_BASE_URL:-}" ]]; then
	printf '%s\n' '--base-url or PRIME_AGENT_DOWNLOAD_BASE_URL is required' >&2
	exit 1
fi

if [[ "$has_out_dir" == "false" ]]; then
	release_args+=("--out-dir" "packages/coding-agent/release/windows")
fi

"$root/scripts/build-windows-binary.sh" "${binary_args[@]}"

cd "$root"
pnpm run release:pack "${release_args[@]}"
