#!/usr/bin/env bash
set -euo pipefail

list_open_prs() {
	gh pr list --state open --limit 1000 --json number,title,body
}

filter_fix_prs() {
	jq '[.[] | select(.title | test("^fix"; "i"))]'
}

write_pr_files() {
	local output_dir="$1"

	jq -r '.[] | "\(.number)\t\({title, description: .body} | @json)"' |
		while IFS=$'\t' read -r issue_no metadata; do
			printf '%s\n' "$metadata" > "$output_dir/$issue_no.yml"
		done
}

list_requested_prs() {
	for issue_no in "$@"; do
		gh pr view "$issue_no" --json number,title,body
	done | jq --slurp '.'
}

main() {
	local output_dir
	output_dir="$(mktemp -d)"

	if (( $# == 0 )); then
		list_open_prs | filter_fix_prs | write_pr_files "$output_dir"
	else
		list_requested_prs "$@" | write_pr_files "$output_dir"
	fi

	echo "$output_dir"
}

main "$@"
