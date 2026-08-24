#!/bin/sh

set -eu

repo_root=$(CDPATH='' cd "$(dirname "$0")/.." && pwd)
head=$(git -C "$repo_root" rev-parse HEAD)
install_root="$HOME/.local/share/prime-agent/head"
install_dir="$install_root/$head"
staging_dir="$install_root/.${head}.tmp.$$"
command="$HOME/.local/bin/prime-agent"

cleanup() {
	rm -rf "$staging_dir"
}
trap cleanup EXIT INT TERM

mkdir -p "$staging_dir" "$(dirname "$command")"
git -C "$repo_root" archive HEAD | tar -xf - -C "$staging_dir"

(
	cd "$staging_dir"
	HUSKY=0 pnpm install --frozen-lockfile
	pnpm run build
)

rm -rf "$install_dir"
mv "$staging_dir" "$install_dir"
ln -sfn "$install_dir/packages/coding-agent/dist/bundle/cli.js" "$command"

printf 'Installed Prime Agent HEAD %s at %s\n' "$head" "$install_dir"
printf 'Linked %s\n' "$command"
