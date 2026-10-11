# 原生 Rust 建包續接（2026-10-11）

先讀 `queries.md`，次讀 `successor-context.json`／`scratchpad.yaml`。二者同形；本包 snapshot 唯讀。`evidence/native-trajectory.md` 記 git 命令、native worktree dirty 與**未建新包**。`sources/` 鏡取相干原文；`history/` 原封舊十九檔與 SHA256SUMS，僅供舊 TypeScript 失敗核史，**不得以 `history/scratchpad.yaml` 視今議決**。現時主簿仍在 `/home/jeff/code/skills/incubator/scratchpad.yaml`；封包不會自動追新。

用戶明定 Rust 後端。目標 `feat/native-rust-xonsh@2da0c33ed`，源自 upstream `v0.10.0`，兼有 TUI dirty 與未追蹤 `skills/zsh/`；不可覆改。舊 TS makepkg exit 4 非今 Rust 版成敗。新 Rust release、Arch 包及 CLI 尚未驗；移交亦非開工證。

`SHA256SUMS` 核本封包各項；`history/SHA256SUMS` 可獨核歷封包。若接任者為新顧問，先循 `handoff-contract.md` 明允，然後授路徑。

## 契式要領

`handoff.schema.json`（Draft 2020-12）定十必鍵：`schema_version`、`kind`、`context`、`state`、`sources`、`facts`、`known-unknowns`、`decision`、`constraints`、`next`；不得妄添頂鍵。`state` 分建成與在役；`sources` 記絕對路、識別、職；`facts` 據識別引證；`decision`、`constraints`、`next` 分所決、權界、行動與驗收。`context.scratchpad` 自專案根指活簿；`context.session_id` 記根會話 UUID。JSON／YAML 同形同值；變體入 `kind` 或 `context.tags`。

契式**不**自驗鍵序、識別唯一、路徑存在、證引通達、檔雜湊；此等另以交接核查及 `SHA256SUMS` 驗。
