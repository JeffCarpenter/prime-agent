# Metaplan: zsh skill promotion (rough personal plugin -> fork-shipped plugin)

Date: 2026-09-19
Author: coordinator (root agent), yields after writing; dispatch fired by user
via hierarchical-delegation / dispatch-solar.
Repo: /home/jeff/code/fork/prime-agent (branch state: has user's uncommitted
.planning/ and scripts/install.xsh changes — DO NOT TOUCH, see exclusions).

## Objective

Promote the zsh skill (currently a rough module at
~/.prime/agent/skills/zsh, a typed facade over upstream rlm.bash with
PRIME_AGENT_BASH_SHELL pinned) into a first-class fork plugin at
packages/coding-agent/skills/zsh matching the `edit` skill's packaging
convention, with real tests, type gates, and a single source of truth for
the personal skill dir.

Design invariant (do not renegotiate mid-flight): reuse, not reimplement.
The facade delegates to rlm.bash; no second process structure. Perlis #9.

## Ground facts (load-bearing context for workers)

- Upstream rlm.bash: prime-agent-runtime/src/rlm/bash.py; PRIME_AGENT_BASH_SHELL
  env var is read per call by _shell(); absolute path required. Verified
  working under zsh 5.9.2 including status fence, group kill, journal.
- Facade API (already built, 100% line+branch covered by a /tmp driver):
  zsh(command) -> BashHandle, zshq(command) -> await BashResult,
  current_shell() -> str | None, restore_default_shell() -> None,
  _resolve_zsh() with which-hit / fallback / RuntimeError branches.
- Packaging convention (from packages/coding-agent/skills/edit/):
  SKILL.md + pyproject.toml ([project.scripts] zsh = "rlm.skill:cli",
  hatch wheel packages src/zsh) + src/zsh/__init__.py.
- Kernel: python 3.11, rlm importable from
  /home/jeff/.prime/agent/kernel-venv/lib/python3.11/site-packages.
- ty flag form: -c 'environment.extra-paths=[...]' -c 'environment.python-version="..."'.

## Pool and sizing

pool_size = 5. Max concurrent wave = 2 (one writer per disjoint tree).
Models: haiku-class for W1a/W1b; coordinator (strongest) accepts in W3.

## Exclusions (immutable user work)

- .planning/** (all), scripts/install.xsh — uncommitted user files, no touch.
- packages/coding-agent/skills/<other skills> — read as reference only.
- prime-agent-runtime/src/rlm/bash.py — READ ONLY. Any need to change it is
  out of scope: STOP and report BLOCKED.

## Tranches

### W1a — Fork skill package (XS-S, haiku-class)

Outcome: packages/coding-agent/skills/zsh/{SKILL.md,pyproject.toml,src/zsh/__init__.py}
Scope: exactly that new directory; nothing else.
Context: copy facade source from ~/.prime/jeff... see
/home/jeff/.prime/agent/skills/zsh/src/zsh/__init__.py (read it; do not write it).
Adjust docstrings to drop personal-skill phrasing ("user's standing order")
in favor of neutral contract text. SKILL.md follows edit skill frontmatter
format (name/description) and documents: one-shot vs background semantics
inherited from bash(), process-global pin, restore_default_shell(), xonsh-first
usage guidance.
Accept: layout mirrors edit skill; `uv run ty check -c environment.extra-paths=[kernel-site-packages] -c environment.python-version="3.11" <file>` passes;
import smoke `python -c "import zsh"` succeeds with PYTHONPATH=kernel-sp:src.
Report: ProcessState{agent,state,evidence,blocker,next}.
Stop: if rlm.bash import needs fork-internal paths not present in kernel env,
report BLOCKED with the exact resolution needed.

### W1b — Test suite (S, haiku-class) — parallel with W1a, disjoint files

Outcome: packages/coding-agent/skills/zsh/tests/test_zsh.py
Scope: exactly packages/coding-agent/skills/zsh/tests/.
Context: port /tmp/zsh_cov_driver.py (readable; 7 exercised paths) to pytest:
async tests via asyncio; _resolve_zsh branches via monkeypatch (which->None,
isfile->False); zsh-presence guard `pytest.mark.skipif(shutil.which("zsh") is None)`;
assert real BashHandle semantics (mid-run tail, kill exit != 0, restore idempotent).
Accept: pytest green; `coverage run --branch --include=**/src/zsh/__init__.py` reports
100% or documents every miss with reason; suite runs under uv ephemeral env
(uv run --python 3.11 --with pytest --with pytest-asyncio --with coverage).
Report/Stop: ProcessState; BLOCKED if async plugin wiring proves nonstandard.

### W2a — Validation wiring (XS, serial; deps W1a+W1b)

Outcome: skill participates in fork validation like sibling skills.
Scope: only files whose sole purpose is test/CI registration for the zsh skill.
Context: inspect how edit/compact skills are covered by fork checks (tests
runner config, pyproject dev groups); mirror minimally. If siblings have no
shared registration, output is a one-paragraph finding, zero file changes.
Accept: fork's check command (as documented in fork README/CLAUDE) passes with
the new skill present; or finding recorded that no wiring exists by convention.
Stop: BLOCKED if wiring requires touching shared config owned by unrelated features.

### W2b — Personal dir sync (XS, serial; deps W1a; user-decision default applied)

Outcome: ~/.prime/agent/skills/zsh points at the fork package as source of truth.
Scope: only ~/.prime/agent/skills/zsh/.
Default (apply unless user overrides): replace src/zsh content with symlink
dir -> fork src/zsh; keep SKILL.md local copy in sync note OR symlink whole dir
if the skill loader tolerates it — verify loader behavior by inspecting how
~/.prime/agent/skills entries are read (markdown skills load SKILL.md only;
python_import needs src layout — check one existing python-backed skill first).
Accept: after sync, REPL-style import of the module from the personal path
yields the fork implementation (assert __file__ under fork path or content hash equal).
Stop: BLOCKED on loader ambiguity — do not guess symlink topology.

### W3 — Ratify (coordinator, strongest model; deps all)

Reload skill in a fresh interpreter; rerun full battery (one-shot, background
mid-run tail, kill, pin/restore, error branches); rerun branch coverage;
spawn-check every worker transcript; diff every worker's writes against its
declared Scope; per-tranche commits (subjects: "Add zsh skill package",
"Add zsh skill tests", wiring/sync as their own scoped commits); final
ProcessState review; update session memory + state dict.

## Scheduling

Wave 1: W1a + W1b parallel (disjoint: package files vs tests dir). 2 slots.
Wave 2: W2a after both; W2b after W1a (may run with W2a; disjoint trees:
fork config vs ~/.prime — no conflict).
Wave 3: W3 after queue drains. Single final repo check pass (fork checks + battery).

## Verification protocol (applies to every tranche)

DONE is a claim: (1) git diff/write-set vs declared Scope, (2) agent_observe
spawn-check, (3) coordinator reruns accept evidence, (4) commits by coordinator
only, (5) race rule: no shared-tree gate runs while another worker edits.


## Addendum (2026-09-19, post-yield order from user)

Descendant-agent tooling order, ALL waves, no exceptions:
1. mcpls to the hilt for Python work (verify availability; document_symbols /
   definition / references / hover before editing).
2. Fix-first linting: run `ty check --fix` and `ruff check --fix` wherever the
   installed toolchain supports the flags; capability-probe before use
   (skillz ty v0.0.29 lacks --fix — probe for newer, else plain check + note).
3. Justfile contract (skillz repo): `check` includes ty/ruff fix steps +
   sk-check; new `check:full` appends `uv run pyright src/skillz_repo` last.
   Enforced by a separately dispatched agent; tranches treat it as environment.


## Addendum 2 (2026-09-19, dispatch fired by user)

Delegation topology (overrides metaplan model sizing for workers):
- Wave LEADS (root's children): run dispatch-solar (SOLAR phases) and
  planning-with-files (task_plan.md / findings.md / progress.md persisted
  under their scope or /tmp scratch) as appropriate.
- Leads ORDER their subagents and all further descendants to use
  hierarchical-delegation (pool discipline, tranche protocol) with model
  zai/glm-5.3-flash at thinking=high.
- Skill paths for handoff: /home/jeff/.agents/skills/dispatch-solar/SKILL.md,
  /home/jeff/.agents/skills/planning-with-files/SKILL.md,
  /home/jeff/.prime/agent/skills/hierarchical-delegation/SKILL.md.
- Workers still: mcpls-first, fix-first linting (capability-probed), no
  commits (root ratifies and commits), ProcessState reports upward.


## Addendum 3: Code Napoleon (nano-bureaucracy charter, 2026-09-19)

Law for every dispatch, every depth, engraved not appended:

1. Uniform tooling law at all depths: mcpls-first (probe, then symbols),
   fix-first linting (capability-probed), xonsh-first shells, zsh before bash.
2. One accountable owner per disjoint scope (prefect). Unnamed ownership is
   a red flag; overlapping writers serialize.
3. Exactly one report form: ProcessState {agent, state, evidence, blocker,
   next}. No other ceremony. Planning files (task_plan/findings/progress)
   persist under the owner's scope; nothing else.
4. No commits below root. Root ratifies: scope-diff, spawn-check, independent
   gate rerun — then commits per tranche.
5. Model tiers by depth: root's direct reports are zai/glm-5.3 or
   openai-codex/gpt-5.6-sol with thinking=high (as appropriate to judgment
   load); their descendants are zai/glm-5.3-flash thinking=high governed by
   hierarchical-delegation. Strongest model reserves acceptance.
6. DONE is a claim until ratified. BLOCKED beats improvised scope.
Current exception (grandfathered, one wave only): w1a-lead and w1b-lead were
dispatched at haiku before this charter; they finish wave 1 under charter
items 1-4 and 6. Wave 2 leads comply with item 5 fully.


## Execution Update (pre-compaction, 2026-09-19)

W1a and W1b are ratified (`3ab601872`, `afa7e4270`). W2b is ratified: the
personal skill directory is a whole-directory symlink to the fork. W2a was
blocked by repeated `zai/glm-5.3` `429 Usage limit reached for 5 hour`; it
produced no report or diff. Do not infer completion. Recovery: preserve state,
compress with `openai-codex/gpt-5.6-luna` thinking high, then retry W2a with
`openai-codex/gpt-5.6-sol` thinking high. W3 remains blocked until W2a is
independently ratified.
