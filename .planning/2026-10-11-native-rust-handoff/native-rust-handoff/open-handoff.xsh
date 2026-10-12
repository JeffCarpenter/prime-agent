#!/usr/bin/env xonsh
"""Read and query the adjacent, checksum-verified handoff packet."""

import hashlib
import yaml
from pathlib import Path
import sys


def load_packet(directory):
    manifest = directory / "SHA256SUMS"
    listed = set()
    for line in manifest.read_text(encoding="utf-8").splitlines():
        digest, separator, name = line.partition("  ")
        path = (directory / name).resolve()
        if not separator or len(digest) != 64 or not path.is_relative_to(directory) or name in listed:
            raise ValueError(f"invalid checksum entry: {line}")
        listed.add(name)
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"checksum mismatch: {name}")
    expected = {str(path.relative_to(directory)) for path in directory.rglob("*") if path.is_file() and path != manifest}
    if listed != expected:
        raise ValueError(f"checksum manifest incomplete: {sorted(expected ^ listed)}")
    return yaml.safe_load((directory / "scratchpad.yaml").read_text(encoding="utf-8"))


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
    document = load_packet(Path(__file__).resolve().parent)
    if arguments:
        passage(document, arguments[0])
    else:
        outline(document)


try:
    main(sys.argv[1:])
except (OSError, ValueError, yaml.YAMLError) as error:
    print(f"handoff: {error}", file=sys.stderr)
    sys.exit(2)
