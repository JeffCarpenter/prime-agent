# Queries first: successor's decision surface

These are the questions a fresh agent must answer without scanning whole transcripts. Both the JSON packet and Wenyan YAML scratchpad expose the same top-level keys. Set `H`, `E`, and `S` once in zsh; do not use the special zsh variable `path`.

```zsh
H=$HOME/code/skills/incubator/packets/prime-agent-pkgbuild-native-2026-10-11
E=$H/history/evidence
S=$H/scratchpad.yaml
```

## Preserved historical evidence (works now)

1. **Where did the build stop, and what was not run?**
   ```zsh
   jq '{exit: .build_attempt.exit_code, phases: .build_attempt.phases, error: .build_attempt.primary_error.message}' "$E/build-attempt.json"
   ```
2. **What exactly invalidated the historical causal claim?**
   ```zsh
   jq '{status: .causal_correction.status, proof: .causal_correction.proof, replacement: .causal_correction.replacement}' "$E/consultant.json"
   ```
3. **What is the current Rust-backend decision?**
   ```zsh
   yq -r '.decision.question, .constraints.builds' "$S"
   ```
4. **Which checks did a fresh agent independently reproduce?**
   ```zsh
   source "$H/outline.zsh"
   pa_items "$E/handoff-verification.json" verified
   pa_item "$E/handoff-verification.json" verified 2
   ```

5. **Which Rust backend and working tree did the user confirm?**
   ```zsh
   jq '.facts[] | select(.id == "native-product-line" or .id == "native-dirty-and-package") | {id, claim, evidence}' "$H/successor-context.json"
   sed -n '1,18p' "$H/evidence/native-trajectory.md"
   ```

## Desired single-entry queries (define packet only to support these)

These queries target the canonical `$H/successor-context.json`; the matching YAML view answers the same paths with `yq`.

1. **Fast orientation, including stop condition and authority:**
   ```zsh
   jq '{context, state, decision, constraints}' "$H/successor-context.json"
   ```
2. **Compact fact ledger with provenance, not duplicate reports:**
   ```zsh
   jq -r '.facts[] | [.id, .claim, (.evidence | join(","))] | @tsv' "$H/successor-context.json"
   ```
3. **Read one source path without searching the tree:**
   ```zsh
   jq -r '.sources[] | select(.id == "build-log") | .path' "$H/successor-context.json"
   ```
4. **See only the open questions and ordered next actions:**
   ```zsh
   jq '{"known-unknowns": .["known-unknowns"], next}' "$H/successor-context.json"
   pa_items "$H/successor-context.json" next
   pa_item "$H/successor-context.json" next 2
   ```
5. **Reject an unresolved or unauthorised build before spawning:**
   ```zsh
   jq -e '.decision.required | length > 0' "$H/successor-context.json"
   jq -r '.constraints.builds, .next[0].when' "$H/successor-context.json"
   ```

Queries return only a bounded summary or one indexed passage. The optional `jmespath` adapter must reproduce these questions with its own syntax; `glom` may follow if it adds value. Neither should be added by pretending the jq expression grammar is shared.
