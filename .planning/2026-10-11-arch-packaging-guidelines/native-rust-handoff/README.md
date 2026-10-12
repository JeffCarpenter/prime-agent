# 原生 Rust 建包續接（2026-10-11）

## 唯一本源

The handoff data is in `.planning/2026-10-11-arch-packaging-guidelines/native-rust-handoff/scratchpad.yaml`. There is no JSON copy. The old copies in incubator and skillz are gone.

Other files have separate jobs. `README.md` explains how to use the data. `queries.md` lists commands. `handoff.schema.json` defines the data format. `SHA256SUMS` checks the files. `history/` holds old evidence, not another current data file. If you change `scratchpad.yaml`, update `SHA256SUMS`.

## 原生 xonsh 入口

自專案根行 `xonsh .planning/2026-10-11-arch-packaging-guidelines/native-rust-handoff/open-handoff.xsh`，自驗 `SHA256SUMS` 而列大綱；加 `decision.question` 則詢單節，數組索引自零（如 `facts.0`）。錯徑／損件非零退出。舊 zsh 查詢例封存於 `history/outline.zsh`，非 xonsh 入口。

先讀 `queries.md`，次讀唯一現行資料檔 `scratchpad.yaml`。`evidence/native-trajectory.md` 記 git 命令、native worktree dirty 與**未建新包**。`sources/` 鏡取相干原文；`history/` 原封舊十九檔與 SHA256SUMS，僅供舊 TypeScript 失敗核史，**不得以 `history/scratchpad.yaml` 視今議決**。

用戶明定 Rust 後端。目標 `feat/native-rust-xonsh@2da0c33ed`，源自 upstream `v0.10.0`，兼有 TUI dirty 與未追蹤 `skills/zsh/`；不可覆改。舊 TS makepkg exit 4 非今 Rust 版成敗。新 Rust release、Arch 包及 CLI 尚未驗；移交亦非開工證。

`SHA256SUMS` 核本封包各項；`history/SHA256SUMS` 可獨核歷封包。若接任者為新顧問，先循 `handoff-contract.md` 明允，然後授路徑。

## 契式要領

`handoff.schema.json`（Draft 2020-12）定十必鍵：`schema_version`、`kind`、`context`、`state`、`sources`、`facts`、`known-unknowns`、`decision`、`constraints`、`next`；不得妄添頂鍵。`state` 分建成與在役；`sources` 記絕對路、識別、職；`facts` 據識別引證；`decision`、`constraints`、`next` 分所決、權界、行動與驗收。`context.scratchpad` 自專案根指活簿；`context.session_id` 記根會話 UUID。現行結構化交接資料僅有 YAML；變體入 `kind` 或 `context.tags`。

契式**不**自驗鍵序、識別唯一、路徑存在、證引通達、檔雜湊；此等另以交接核查及 `SHA256SUMS` 驗。
