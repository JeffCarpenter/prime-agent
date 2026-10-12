#!/usr/bin/env xonsh
"""Print only the outstanding (unchecked, "- [ ]") lines of one phase in a
planning-with-files task_plan.md, including multi-line wrapped text
that belongs to an unchecked item. Sibling of show-item.xsh, which it
uses to isolate the phase block first.

Usage: show-outstanding.xsh <planning-dir> [item-number] [file]
  planning-dir   e.g. .planning/2026-09-26-libcst-query-skill-creation
  item-number    top-level phase, e.g. 6. Default: first unchecked
                  top-level item ("- [ ] **N. ") found in the file.
  file           default: task_plan.md
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


if len(sys.argv) < 2:
    die("usage: show-outstanding.xsh <planning-dir> [item-number] [file]")

dir_ = Path(sys.argv[1])
item = sys.argv[2] if len(sys.argv) > 2 else ""
file = sys.argv[3] if len(sys.argv) > 3 else "task_plan.md"
path = dir_ / file
script_dir = Path(__file__).resolve().parent

if not path.is_file():
    die(f"not found: {path}")

if not item:
    default_re = re.compile(r"^- \[ \] \*\*([0-9]+)\. ")
    match = next(filter(None, (default_re.match(line) for line in read_lines(path))), None)
    if match is None:
        die(f"no outstanding top-level phase in {path}")
    item = match.group(1)

sys.stdout.flush()
try:
    block = $(@(str(script_dir / "show-item.xsh")) @(str(dir_)) @(item) @(file))
except subprocess.CalledProcessError as exc:
    sys.exit(exc.returncode)

block_lines = block.split("\n")
if block_lines and block_lines[-1] == "" and block.endswith("\n"):
    block_lines.pop()

include = False
for line in block_lines:
    if line.startswith("#"):
        include = False
        continue
    if re.match(r"^\s*- \[ \]", line):
        include = True
        print(line)
        continue
    if re.match(r"^\s*- \[[xX]\]", line):
        include = False
        continue
    if include:
        print(line)
