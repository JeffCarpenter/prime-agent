"""Expected kernel-state paths as Python 3.14 template strings."""

from pathlib import Path
from string.templatelib import Interpolation, Template


def real_path_template(home: Path, session_id: str) -> Template:
    """Bind a session to its Prime Agent xonsh state file."""
    return t"{home}/.prime/agent/session-artifacts/{session_id}/xonsh/kernel-state.dill"


def symlink_path_template(repo_root: Path, session_id: str) -> Template:
    """Bind a session to its repository-local symlink path."""
    return t"{repo_root}/.planning/kernel-state/{session_id}"


def path_from_template(template: Template) -> Path:
    """Render the bound path values without re-evaluating expressions."""
    return Path(
        "".join(
            str(part.value) if isinstance(part, Interpolation) else part
            for part in template
        )
    )
