# Source with: source ~/code/skills/incubator/outline.zsh
# .json uses jq; .yaml/.yml uses the installed jq-compatible yq.
# Paths are dotted object keys; pa_item uses a 1-based item number.

_pa_outline_backend() {
  case "$1" in
    (*.json) print -r -- jq ;;
    (*.yaml|*.yml) print -r -- yq ;;
    (*) print -u2 -- "Need a .json, .yaml, or .yml file: $1"; return 2 ;;
  esac
}

pa_outline() {
  emulate -L zsh
  local file=${1:?Usage: pa_outline FILE.json|yaml}
  local backend
  backend=$(_pa_outline_backend "$file") || return
  "$backend" -r '
    . as $root | paths as $p
    | select(($p | length) <= 4 and ($p | all(.[]; type != "number")))
    | ($root | getpath($p)) as $v
    | "\($p | join("."))\t\($v | if type == "array" then "array[\(length)]" else type end)"
  ' "$file"
}

pa_items() {
  emulate -L zsh
  local file=${1:?Usage: pa_items FILE ARRAY_PATH}
  local keypath=${2:?Usage: pa_items FILE ARRAY_PATH}
  local backend
  backend=$(_pa_outline_backend "$file") || return
  "$backend" -r --arg path "$keypath" '
    getpath($path | split("."))
    | if type != "array" then error("not an array") else
        to_entries[]
        | "\(.key + 1)\t\(.value | if type == "object" then (.fact // .["事"] // .item // .action // (keys | join(","))) else . end | tostring | .[0:180])"
      end
  ' "$file"
}

pa_item() {
  emulate -L zsh
  local file=${1:?Usage: pa_item FILE ARRAY_PATH NUMBER}
  local keypath=${2:?Usage: pa_item FILE ARRAY_PATH NUMBER}
  local number=${3:?Usage: pa_item FILE ARRAY_PATH NUMBER (1-based)}
  local backend
  backend=$(_pa_outline_backend "$file") || return
  local -a flags
  if [[ $backend == yq ]]; then flags=(-y); else flags=(); fi
  "$backend" $flags --arg path "$keypath" --arg number "$number" '
    ($number | tonumber) as $n
    | getpath($path | split(".")) as $xs
    | if ($xs | type) != "array" or $n < 1 or $n > ($xs | length)
      then error("item out of range or path is not an array")
      else $xs[$n - 1] end
  ' "$file"
}

pa_passage() {
  emulate -L zsh
  local file=${1:?Usage: pa_passage FILE DOTTED_PATH}
  local keypath=${2:?Usage: pa_passage FILE DOTTED_PATH}
  local backend
  backend=$(_pa_outline_backend "$file") || return
  local -a flags
  if [[ $backend == yq ]]; then flags=(-y); else flags=(); fi
  "$backend" $flags --arg path "$keypath" '
    getpath($path | split(".") | map(if test("^[0-9]+$") then tonumber else . end))
  ' "$file"
}

# Examples (no action is run when this file is sourced):
# pa_outline ~/code/skills/incubator/scratchpad.yaml
# pa_passage ~/code/skills/incubator/scratchpad.yaml decision
# pa_items /home/jeff/code/fork/prime-agent/.planning/2026-10-11-arch-packaging-guidelines/handoff.json verified_state
# pa_item /home/jeff/code/fork/prime-agent/.planning/2026-10-11-arch-packaging-guidelines/handoff.json verified_state 3
