#!/usr/bin/awk -f
# Print "### Phase N — Title" blocks whose "Status:" line isn't
# complete/done/reverted. Used by show-active-outstanding.sh for task_plan.md's
# phase-status schema (no checkboxes).
function flush() {
  if (blockon && status !~ /status:[*[:space:]]*(complete|done|reverted)/) print block
  blockon = 0; block = ""; status = ""
}
/^### Phase [0-9]/ { flush(); blockon = 1; block = $0 "\n"; next }
/^## / && !/^### / { flush(); next }
{ if (blockon) { block = block $0 "\n"; low = tolower($0); if (low ~ /^[-*[:space:]]*status:/) status = low } }
END { flush() }
