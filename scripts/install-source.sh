#!/bin/sh

set -eu

script_dir=$(CDPATH='' cd "$(dirname "$0")" && pwd)
repo_root=$(CDPATH='' cd "$script_dir/.." && pwd)
source_launcher="$repo_root/prime-agent.sh"

if [ "$#" -gt 1 ]; then
	printf 'usage: %s [bin-directory]\n' "$0" >&2
	exit 2
fi

if [ "$#" -eq 1 ]; then
	bin_dir="$1"
elif [ -n "${PRIME_AGENT_BIN_DIR:-}" ]; then
	bin_dir="$PRIME_AGENT_BIN_DIR"
elif [ -n "${HOME:-}" ]; then
	bin_dir="$HOME/.local/bin"
else
	printf 'error: HOME is not set; pass the target bin directory explicitly.\n' >&2
	exit 1
fi

if [ ! -x "$source_launcher" ]; then
	printf 'error: source launcher is not executable: %s\n' "$source_launcher" >&2
	exit 1
fi

mkdir -p "$bin_dir"
target="$bin_dir/prime-agent"

if [ -e "$target" ] || [ -L "$target" ]; then
	if [ -L "$target" ] && [ "$(readlink "$target")" = "$source_launcher" ]; then
		printf 'Prime Agent source command is already linked at %s\n' "$target"
	else
		printf 'error: refusing to replace existing path: %s\n' "$target" >&2
		exit 1
	fi
else
	ln -s "$source_launcher" "$target"
	printf 'Linked Prime Agent source command at %s\n' "$target"
fi

case ":${PATH:-}:" in
	*":$bin_dir:"*) printf 'Run it with: prime-agent\n' ;;
	*)
		printf '%s is not on PATH. Add this to your shell profile:\n\n' "$bin_dir"
		printf "  export PATH=\"%s:\$PATH\"\n" "$bin_dir"
		;;
esac
