#!/usr/bin/env xonsh
"""Print one top-level numbered plan item (and its sub-items) from a
planning-with-files task_plan.md, up to the next top-level item.

Usage: show-item.xsh <planning-dir> <item-number> [file]
  planning-dir   e.g. .planning/2026-09-26-libcst-query-skill-creation
  item-number    top-level item, e.g. 6 (matches "**6. ", not "**6.0")
  file           default: task_plan.md
"""
import re
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


if len(sys.argv) < 3:
    die("usage: show-item.xsh <planning-dir> <item-number> [file]")

dir_ = Path(sys.argv[1])
item = sys.argv[2]
file = sys.argv[3] if len(sys.argv) > 3 else "task_plan.md"
path = dir_ / file

if not path.is_file():
    die(f"not found: {path}")

lines = read_lines(path)
needle = f"**{item}. "
end_re = re.compile(r"\*\*[0-9]+\. ")

start = next((i for i, line in enumerate(lines) if needle in line), None)
if start is None:
    die(f"item {item} not found in {path}")

end = next(
    (i for i in range(start + 1, len(lines)) if end_re.search(lines[i])),
    len(lines),
)

for line in lines[start:end]:
    print(line)
