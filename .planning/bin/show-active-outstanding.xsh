#!/usr/bin/env xonsh
"""Print outstanding work of the current phase of the *active* plan, i.e.
whatever `.planning/.active_plan` points at. Sibling of show-item.xsh /
show-outstanding.xsh. Handles both task_plan.md schemas seen in this repo:
  - checkbox: "- [ ] **N. Title**" top-level items -> delegates to
    show-outstanding.xsh
  - phase-status: "### Phase N — Title" + "Status: <state>" blocks,
    no checkboxes -> prints non-complete phase blocks plus the
    "## Next Step" section (that's where actionable work lives even
    once every phase shows complete)

Usage: show-active-outstanding.xsh [item-number] [file]
  item-number   checkbox schema only: top-level phase, e.g. 6.
                Default: first unchecked top-level item.
  file          default: task_plan.md
"""
import re
import subprocess
import sys
from pathlib import Path


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def read_lines(path):
    text = path.read_text()
    lines = text.split("\n")
    if lines and lines[-1] == "" and text.endswith("\n"):
        lines.pop()
    return lines


script_dir = Path(__file__).resolve().parent
base_dir = script_dir.parent
pointer = base_dir / ".active_plan"

if not pointer.is_file():
    die(f"no active plan: {pointer} not found")

plan = pointer.read_text().rstrip("\n")
if not plan:
    die(f"empty pointer: {pointer}")

plan_dir = base_dir / plan
if not plan_dir.is_dir():
    die(f"active plan dir not found: {plan_dir}")

item = sys.argv[1] if len(sys.argv) > 1 else ""
file = sys.argv[2] if len(sys.argv) > 2 else "task_plan.md"
path = plan_dir / file

if not path.is_file():
    die(f"not found: {path}")

lines = read_lines(path)
checkbox_re = re.compile(r"^[ \t]*- \[[ xX]\]")

if any(checkbox_re.match(line) for line in lines):
    sys.stdout.flush()
    try:
        ![@(str(script_dir / "show-outstanding.xsh")) @(str(plan_dir)) @(item) @(file)]
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)
    sys.exit(0)

# phase-status schema: no checkboxes at all.
sys.stdout.flush()
try:
    ![awk -f @(str(script_dir / "phase-status.awk")) @(str(path))]
except subprocess.CalledProcessError as exc:
    sys.exit(exc.returncode)

on = False
for line in lines:
    if line.startswith("## Next Step"):
        on = True
        print(line)
        continue
    if on and line.startswith("## "):
        break
    if on:
        print(line)
