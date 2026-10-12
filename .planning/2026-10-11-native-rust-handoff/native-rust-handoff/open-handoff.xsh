#!/usr/bin/env xonsh
"""Read and query the adjacent YAML handoff data."""

import yaml
from pathlib import Path
import sys


def kind(value):
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return f"array[{len(value)}]"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if value is None:
        return "null"
    return "string"


def outline(value, prefix="", depth=0):
    if depth > 4:
        return
    if prefix:
        print(f"{prefix}\t{kind(value)}")
    if isinstance(value, dict) and depth < 4:
        for key, child in value.items():
            outline(child, f"{prefix}.{key}" if prefix else key, depth + 1)


def passage(document, dotted):
    value = document
    for component in dotted.split("."):
        if isinstance(value, dict) and component in value:
            value = value[component]
        elif isinstance(value, list) and component.isdecimal() and int(component) < len(value):
            value = value[int(component)]
        else:
            raise ValueError(f"unknown handoff path: {dotted} (at {component})")
    print(value if isinstance(value, str) else yaml.safe_dump(value, allow_unicode=True, sort_keys=False).rstrip("\n"))


def main(arguments):
    if len(arguments) > 1:
        raise ValueError("usage: xonsh open-handoff.xsh [dotted.path]")
    document = yaml.safe_load((Path(__file__).resolve().parent / "scratchpad.yaml").read_text(encoding="utf-8"))
    if arguments:
        passage(document, arguments[0])
    else:
        outline(document)


try:
    main(sys.argv[1:])
except (OSError, ValueError, yaml.YAMLError) as error:
    print(f"handoff: {error}", file=sys.stderr)
    sys.exit(2)
