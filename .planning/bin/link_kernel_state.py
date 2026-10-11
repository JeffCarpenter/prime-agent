#!/usr/bin/env python3
"""Link a Prime Agent session's xonsh state into this repository's planning area."""

import argparse
import os
import re
import sys
from pathlib import Path
from uuid import UUID

from wiring import path_from_template, real_path_template, symlink_path_template


def link_kernel_state(
    session_id: str, repo_root: Path, plan_id: str | None = None
) -> Path:
    """Create the session link and retire a verified earlier per-plan link."""
    try:
        canonical_id = str(UUID(session_id))
    except ValueError as exc:
        raise ValueError(f"invalid session UUID: {session_id}") from exc
    if session_id != canonical_id:
        raise ValueError(
            f"session UUID must use canonical lowercase form: {session_id}"
        )
    if plan_id is not None and (
        plan_id in {".", ".."}
        or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", plan_id) is None
    ):
        raise ValueError(f"invalid plan ID: {plan_id}")

    source = path_from_template(real_path_template(Path.home(), session_id))
    if not source.is_file():
        raise FileNotFoundError(f"kernel state does not exist: {source}")

    destination = path_from_template(symlink_path_template(repo_root, session_id))
    destination_dir = destination.parent
    if destination_dir.is_symlink():
        raise FileExistsError(f"destination directory is a symlink: {destination_dir}")
    destination_dir.mkdir(parents=True, exist_ok=True)
    if os.path.lexists(destination):
        if not destination.is_symlink() or destination.resolve() != source.resolve():
            raise FileExistsError(
                f"refusing to replace another destination: {destination}"
            )
    else:
        destination.symlink_to(Path(os.path.relpath(source, start=destination_dir)))

    if plan_id is not None:
        old_link = Path.home() / ".planning" / plan_id / "kernel-state.dill"
        if old_link.is_symlink():
            if old_link.resolve() == source.resolve():
                old_link.unlink()
            else:
                print(f"preserved unrelated legacy link: {old_link}", file=sys.stderr)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session_id", help="canonical lowercase session UUID")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="repository containing .planning (defaults to this script's repository)",
    )
    parser.add_argument(
        "--plan-id",
        help="remove ~/.planning/PLAN_ID/kernel-state.dill if it links to this state",
    )
    args = parser.parse_args()
    try:
        destination = link_kernel_state(args.session_id, args.repo_root, args.plan_id)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
