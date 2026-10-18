# Handoff file work

## Goal

Keep the current handoff data in `.planning/2026-10-11-native-rust-handoff/native-rust-handoff/scratchpad.yaml`. Keep its format in `scratchpad.schema.yaml`. Do not restore plain JSON files or `history/` here. Do not touch the separate `divergences.jsonld` in the 2026-10-10 plan.

## Next step

No more prime-agent edits are needed for this request. The 36 deleted files in the skillz repository remain uncommitted. Commit those only if requested.

## Current phase

Phase 5: External skillz deletions pending.

## Phases

### Phase 1: Data and script

- [x] Keep one current data file, `scratchpad.yaml`. Query it with `open-handoff.xsh` or `yq`.
- Status: complete

### Phase 2: Remove extra files

- [x] Remove the two outside copies of the current handoff files.
- [x] Remove `history/` and all `.json` files from this renamed plan directory. Keep JSON-LD outside it.
- Status: complete

### Phase 3: Rename and check

- [x] Confirm `.planning/2026-10-11-native-rust-handoff/` is the current plan directory; no former directory path remains inside it.
- [x] Rename the data schema to `scratchpad.schema.yaml`; link to it from README.md. Do not keep `handoff-contract.md` here.
- [x] Pass five handoff reader tests from the current path.
- Status: complete

### Phase 4: Commit in prime-agent

- [x] Commit the three Markdown updates as `cdc3f6ad9496d52836b5bad79d84ad468c5c1416`.
- [x] Commit the renamed, smaller directory as `aa51067840e6f972e35fe9d85a2f18be3fb34b91`.
- [x] Exclude `meta.md` and its three links from both commits. The index is empty.
- Status: complete

### Phase 5: External skillz deletions

- [ ] The removed skillz directory has 36 tracked deletions. Do not commit them without a new request.
- Status: pending

## Document clarity pass (2026-10-12)

- [x] Checkpoint the existing native-status and task-plan edits before changing them: `f07e49130`.
- [x] Commit scoped clarity fixes to those two files and the YAML handoff; amended as `b2c25d98e` to remove the redundant checksum manifest. No unrelated dirty files were committed.
- [x] Validate both YAML files, the handoff schema, five handoff reader tests, staged whitespace, and zero references to the former directory name inside this plan. Git tracks the handoff files.
- [x] Keep `sources/` as frozen evidence instead of duplicate live plans. Leave `meta.md` and `meta.luna.quiz.md` untracked under the prior commit boundary.

## Facts for handoff

- The file `meta.md` explains how to manage planning documents, while `native-rust-handoff/scratchpad.yaml` holds active decisions and next actions. Their schema is defined in `native-rust-handoff/scratchpad.schema.yaml`. The files `task_plan.md`, `progress.md`, and `findings.md` do not exist in this directory and are not linked to `meta.md`.
- Older TypeScript evidence still exists outside this repository directory. Four paths in `scratchpad.yaml` point to byte-matching originals there.
- `.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/divergences.jsonld` was not changed.
- The installed `yq` CLI is jq-backed. The script `open-handoff.xsh` reads YAML directly via PyYAML and does not call jq.
- Current handoff files and the live native status and task plan no longer point to the former directory name. Frozen source snapshots remain historical evidence and do not reflect live planning state.
- Keep unrelated dirty files in prime-agent and skillz untouched.

## Review record

Read-only GPT-6 Luna cross-interrogation scores are in [meta.luna.quiz.md](meta.luna.quiz.md). This review record does not represent planning data or build verification.

## Errors seen

| Error | Result |
|-------|--------|
| `git add -A` rejected ignored `history/evidence/build.log` | Unstaged the partial result. The user then asked to delete `history/`. |
| Staged check found trailing spaces in that preserved build log | Did not edit the log. Deleted the local `history/` copy as requested; the next staged check passed. |
