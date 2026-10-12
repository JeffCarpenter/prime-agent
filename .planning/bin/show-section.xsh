#!/usr/bin/env xonsh
"""Print a Markdown heading outline, or one section, of a planning file.
Sibling of show-item.xsh; works for both task_plan.md schemas (and for
findings.md / progress.md) because it keys on headings, not checkboxes.

Usage: show-section.xsh <planning-dir> [heading-regex] [file]
  planning-dir    e.g. .planning/2026-09-27-toon-caveman-compress-synthesis
  heading-regex   Python regex matched against heading text (without the #s).
                  Omitted: print "LINE: #... heading" outline only.
                  Given: print first matching heading's section, up to
                  the next heading of the same or higher level.
  file            default: task_plan.md
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


if len(sys.argv) < 2:
    die("usage: show-section.xsh <planning-dir> [heading-regex] [file]")

dir_ = Path(sys.argv[1])
pat = sys.argv[2] if len(sys.argv) > 2 else ""
file = sys.argv[3] if len(sys.argv) > 3 else "task_plan.md"
path = dir_ / file

if not path.is_file():
    die(f"not found: {path}")

lines = read_lines(path)
heading_re = re.compile(r"^#+ ")

if not pat:
    fence = False
    for i, line in enumerate(lines, start=1):
        if line.startswith("```"):
            fence = not fence
        if not fence and heading_re.match(line):
            print(f"{i}: {line}")
    sys.exit(0)

pat_re = re.compile(pat)
fence = False
on = False
onlvl = 0
done = False

for line in lines:
    if line.startswith("```"):
        fence = not fence
    if not fence and heading_re.match(line):
        lvl = len(re.match(r"^#+", line).group(0))
        text = line[lvl + 1:]
        if on and lvl <= onlvl:
            break
        if not on and not done and pat_re.search(text):
            on = True
            onlvl = lvl
            done = True
    if on:
        print(line)

if not done:
    die(f"no heading matches: {pat}")
