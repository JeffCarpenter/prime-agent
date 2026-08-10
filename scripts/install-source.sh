#!/bin/sh

set -eu

script_dir=$(CDPATH='' cd "$(dirname "$0")" && pwd)
repo_root=$(CDPATH='' cd "$script_dir/.." && pwd)
source_launcher="$repo_root/prime-agent.sh"
source_tsconfig="$repo_root/tsconfig.json"
source_tsx="$repo_root/node_modules/.bin/tsx"

fail() {
	printf 'error: %s\n' "$1" >&2
	exit 1
}

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
	fail "source launcher is not executable: $source_launcher"
fi

if [ ! -f "$source_tsconfig" ]; then
	fail "source TypeScript configuration is missing: $source_tsconfig"
fi

if [ ! -x "$source_tsx" ]; then
	fail "source dependencies are not installed; run pnpm install in $repo_root"
fi

mkdir -p "$bin_dir"
case "$bin_dir" in
	/*) ;;
	*) bin_dir=$(CDPATH='' cd "$bin_dir" && pwd) ;;
esac
target="$bin_dir/prime-agent"
created=false

if [ -e "$target" ] || [ -L "$target" ]; then
	if [ -L "$target" ] && [ "$(readlink "$target")" = "$source_launcher" ]; then
		printf 'Prime Agent source command is already linked at %s\n' "$target"
	else
		fail "refusing to replace existing path: $target"
	fi
else
	ln -s "$source_launcher" "$target"
	created=true
	printf 'Linked Prime Agent source command at %s\n' "$target"
fi

if ! (CDPATH='' cd / && "$target" --version >/dev/null 2>&1); then
	if [ "$created" = true ]; then
		rm "$target"
	fi
	fail "source command validation failed: $target"
fi

case ":${PATH:-}:" in
	*":$bin_dir:"*) printf 'Run it with: prime-agent\n' ;;
	*)
		printf '%s is not on PATH. Add this to your shell profile:\n\n' "$bin_dir"
		printf "  export PATH=\"%s:\$PATH\"\n" "$bin_dir"
		;;
esac
