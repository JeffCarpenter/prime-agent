# 原生 Rust 建包續接（2026-10-11）

## 唯一本源

The handoff data is in `.planning/2026-10-11-native-rust-handoff/native-rust-handoff/scratchpad.yaml`. There is no JSON copy. The old copies in incubator and skillz are gone.

Other files have separate jobs. `README.md` explains how to use the data. `queries.md` lists commands. [scratchpad.schema.yaml](scratchpad.schema.yaml) defines the data format. Git tracks changes to these files.

## Authority and order

`context.scratchpad` resolves from `context.root` to the live `scratchpad.yaml` beside this README. This file records the current handoff decisions and next actions. The separate native-port `task_plan.md` and `native-status.yaml` hold the live implementation sequence and status. Files in `sources/` are frozen evidence snapshots; they are not current plans and must not be synchronized with later working copies.

Native Rust packaging is approved, not built or verified. First complete the capability ledger and baseline, then test the isolated integration; only then build the release and Arch package. Asking about a still-unknown risk boundary is not asking again for approval of the Rust backend or the approved packaging scope. System installation, destruction of protected work, and scope expansion need separate approval.

Git tracks the current handoff files. A handoff reader test does not prove that a Rust package or CLI works.

## 原生 xonsh 入口

自專案根行 `xonsh .planning/2026-10-11-native-rust-handoff/native-rust-handoff/open-handoff.xsh`，直讀相鄰 YAML 而列大綱；加 `decision.question` 則詢單節，數組索引自零（如 `facts.0`）。錯徑／損件非零退出。此處無 zsh 入口。

先讀 `queries.md`，次讀唯一現行資料檔 `scratchpad.yaml`。`evidence/native-trajectory.md` 記 git 命令、native worktree dirty 與**未建新包**。`sources/` 存相干原文；舊 TypeScript 建包證據依 `scratchpad.yaml` 所列原址查核。

用戶明定 Rust 後端。目標 `feat/native-rust-xonsh@2da0c33ed`，源自 upstream `v0.10.0`，兼有 TUI dirty 與未追蹤 `skills/zsh/`；不可覆改。舊 TS makepkg exit 4 非今 Rust 版成敗。新 Rust release、Arch 包及 CLI 尚未驗；移交亦非開工證。

## 資料格式

欄位及規則見 [scratchpad.schema.yaml](scratchpad.schema.yaml)；資料見 `scratchpad.yaml`。路徑及證引須以 Git 紀錄與原始證據核對。
