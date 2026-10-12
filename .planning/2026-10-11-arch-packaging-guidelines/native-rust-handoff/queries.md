# Queries first: successor's decision surface

These commands answer key questions without reading old logs. Run them from the prime-agent project root. In zsh, set `H`, `E`, and `S` once. Do not use `path` as a variable name in zsh. Read the handoff data from `$S` (`scratchpad.yaml`).

```zsh
H=.planning/2026-10-11-arch-packaging-guidelines/native-rust-handoff
E=$H/history/evidence
S=$H/scratchpad.yaml
```

## 原生 xonsh 入口（自專案根）

```xonsh
xonsh .planning/2026-10-11-arch-packaging-guidelines/native-rust-handoff/open-handoff.xsh
xonsh .planning/2026-10-11-arch-packaging-guidelines/native-rust-handoff/open-handoff.xsh decision.question
```

首式自校封包 `SHA256SUMS` 而列大綱；次式按點徑讀一節。數組索引自零（例 `facts.0`）；錯徑或雜湊不符則非零退出。舊 zsh 例存於 `history/outline.zsh`，**非**本 xonsh 入口。

## Preserved historical evidence (works now)

1. **Where did the build stop, and what was not run?**
   ```zsh
   yq '{exit: .build_attempt.exit_code, phases: .build_attempt.phases, error: .build_attempt.primary_error.message}' "$E/build-attempt.json"
   ```
2. **What exactly invalidated the historical causal claim?**
   ```zsh
   yq '{status: .causal_correction.status, proof: .causal_correction.proof, replacement: .causal_correction.replacement}' "$E/consultant.json"
   ```
3. **What is the current Rust-backend decision?**
   ```zsh
   yq -r '.decision.question, .constraints.builds' "$S"
   ```
4. **Which checks did a fresh agent independently reproduce?**
   ```zsh
   yq -r '.verified[] | .["事"]' "$E/handoff-verification.json"
   yq -r '.verified[1]' "$E/handoff-verification.json"
   ```

5. **Which Rust backend and working tree did the user confirm?**
   ```zsh
   yq '.facts[] | select(.id == "native-product-line" or .id == "native-dirty-and-package") | {id, claim, evidence}' "$S"
   sed -n '1,18p' "$H/evidence/native-trajectory.md"
   ```

## YAML data queries

These queries read `$S` with `yq`.

1. **Fast orientation, including stop condition and authority:**
   ```zsh
   yq '{context, state, decision, constraints}' "$S"
   ```
2. **Compact fact ledger with provenance, not duplicate reports:**
   ```zsh
   yq -r '.facts[] | [.id, .claim, (.evidence | join(","))] | @tsv' "$S"
   ```
3. **Read one source path without searching the tree:**
   ```zsh
   yq -r '.sources[] | select(.id == "build-log") | .path' "$S"
   ```
4. **See only the open questions and ordered next actions:**
   ```zsh
   yq '{"known-unknowns": .["known-unknowns"], next}' "$S"
   yq -r ".next[] | .action" "$S"
   yq -r ".next[2]" "$S"
   ```
5. **Reject an unresolved or unauthorised build before spawning:**
   ```zsh
   yq -e '.decision.required | length > 0' "$S"
   yq -r '.constraints.builds, .next[0].when' "$S"
   ```

To read one value, use `xonsh "$H/open-handoff.xsh" decision.question`. Replace `decision.question` with another dotted path as needed.
