# Handoff queries

These commands answer key questions without reading old logs. Run them from the prime-agent project root. In zsh, set `H` and `S` once. Do not use `path` as a variable name in zsh. Read the handoff data from `$S` (`scratchpad.yaml`).

```zsh
H=.planning/2026-10-11-native-rust-handoff/native-rust-handoff
S=$H/scratchpad.yaml
```

## 原生 xonsh 入口（自專案根）

```xonsh
xonsh .planning/2026-10-11-native-rust-handoff/native-rust-handoff/open-handoff.xsh
xonsh .planning/2026-10-11-native-rust-handoff/native-rust-handoff/open-handoff.xsh decision.question
```

首式直讀相鄰 YAML 而列大綱；次式按點徑讀一節。數組索引自零（例 `facts.0`）；錯徑或缺資料則非零退出。此處無 zsh 入口。

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
