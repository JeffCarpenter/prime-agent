# 功能與風險裁定稽核

**界限。** 僅據 `pre-port-capability-ledger.json`、`resume-product-decisions.json`、`scratchpad.yaml` 與下列定點 source。此為需求考證，未改碼、未測試或建置。`origin/main` 為非祖系之 322 提交池；七例僅為風險索引，非移植義務。已准 Rust、必要 scoped repairs 及 Arch 包裝，不重問。

## 真正待用戶裁定：三項

| 項 | 舊行為 | Native 現況 | 最小選項 | 保守建議；是否須問 |
|---|---|---|---|---|
| Installer UX | 舊 `scripts/install.xsh` 為互動式 Xonsh/Node 安裝路徑；`06bdcf1` 僅示其搬移，TS bootstrap 不能移植為 Rust 需求。 | `install-rust.sh` 與 `install.ps1` 已供原生安裝；`scripts/install.xsh` 不在 native。來源：ledger `six_release_replay_capabilities[5]`；native `install-rust.sh:1-21`、`install.ps1:1-23`。 | A 沿用原生通道、退舊 Xonsh installer；B 明定需求與 UX，再另造原生 Xonsh 入口。 | 薦 A。若欲 B，須用戶裁定；毋以未准 upstream installer 或 TS script 代需求。 |
| dotenv | 舊 TS root 加 `dotenv` 依賴，該提交無應用呼叫點。 | Rust bootstrap 將 `python-dotenv` 列入 Python extra package；此僅安裝 Python 套件，不證 Rust 或 app 載 `.env`。來源：ledger `[4]`；`crates/pa-core/src/kernel/bootstrap/mod.rs:41-56`。 | A 定義、實作、測試 `.env` 路徑/優先序/覆寫；B 僅取程序環境，不承接舊依賴。 | 薦 B，除非有明確產品用例。載入語義真屬產品行為，須問；不得由依賴推導。 |
| Windows | 舊提交加 Windows release artifact、PowerShell installer、checksum install。 | Native 有 `install.ps1` 及 release workflow/Windows test 路徑；本機未跑 Windows E2E 或 release。`install.ps1:1-23,42-55` 說明原生路徑與錯誤處理；ledger `[3]` 記同檔及未驗狀態。 | A 承襲 Windows 支援，補 Windows CI/E2E 綠門後宣稱通過；B 首發只列已驗平台，明示 Windows 延後。 | 薦 A（保留既有支援），但未驗前不得稱 parity/通過。問是否列首發驗收門；不可自行宣告 Windows 不支援。 |

## `origin/main` 七例：非需求問句；先作有界驗證

| 舊例（hash 短名） | 舊行為 | Native 現況／證據 | 最小選項 | 保守建議；是否須問 |
|---|---|---|---|---|
| Installer prefix `547b3f9449` | 防止 prefix 搬遷誤刪外部 launcher，失敗可回復。 | 原生保護 foreign launcher/rollback 部分等價未驗；`install-rust.sh:2780-2805` 會旁移無主檔；`installer_update_e2e.rs:229-245` 覆蓋失敗保留舊安裝。 | A 保留 native 機制並補 path alias/foreign symlink/rollback 定點驗；B 若發現缺口，再 scoped repair。 | A；此為安全驗證，非要求照搬 npm prefix。無新產品決策；若修復升為大改再問風險胃納。 |
| Interrupted cleanup `99faace18b` | 舊例要求中斷時清理子程序，TERM 後 KILL。 | Ledger 判 native renderer wait/restore 部分等價，後代 TERM→KILL 未證；尚缺 interruption/process-tree 證據（`install-rust.sh:548-565,693-725,2557-2621`，ledger）。 | A 在隔離環境驗 INT/TERM、重複中斷、子程序及殘檔；B 僅對實證缺陷作修復。 | A；不預先移植舊實作。驗證自主；需擴改才問。 |
| Host request `b5614c3842` | 舊例強化 request/reply lifecycle 與限時。 | Native 有 in-flight task 與 bounded shutdown wait；一般 reply/write 路徑及 missing/late/EOF/cancel 語義仍未證。`host_requests.rs:45-67,107-125`。 | A 定點測 missing/late reply、EOF、slow write、cancel、worker shutdown；B 只修重現之差異。 | A；舊 TS 行為不自動成契約。改變產品 timeout/reply contract 才問。 |
| Verified publication `50cfcf6c94` | 舊例要求驗證發佈、避免回退及不安全封裝。 | Native 有 checksum、單調指標等部分防線；run-attempt pin/封存大小限制未證。`verify_release.py:124-153` 驗 tar 形態與 SHA256SUMS；ledger workflow 引據列其餘位置。 | A 對 retry attribution、並發指標、惡意 ZIP/TAR 做 CI 驗；B 依可重現缺口 scoped repair。 | A；勿因舊提交直接擴成全面發佈重構。修復超必要範圍才問。 |
| Session teardown `33279976c0` | 舊例防 shutdown 與新工作競態、要求 teardown。 | Native 先關 shutdown gate，再 abort/settle；ledger 指 entry race 未解。`lifecycle.rs:77-109,142-160`。 | A 對 drain pause 的 prompt/refine/compact/spawn 與 shutdown error propagation 作競態驗；B 以結果修必要缺口。 | A；不假定原 TS owner/機制須搬。測試自主，破壞性大改再問。 |
| Supervisor restore `1898e4e76e` | 舊例維持 supervisor owner/scope restoration。 | TS owner records 已退；native orphan-exit/失聯偵測存在，singleton safety 未驗。`supervisor_lost.rs:1-4,40-85`。 | A 驗兩 supervisor 競態、舊 owner 遲退、新服務可用；B 缺口成立後作 scoped repair。 | A；先驗 native socket/ownership，勿移植 TS records。改 singleton contract 才問。 |
| Startup persistence `7b1f7e3ae7` | 舊例調和 daemon startup 與 session 持久化。 | TS Vitest isolation 已退；native 在 worker creation 建 session path，但早期 durable materialization 未驗。ledger 引 `interactive_mode.rs:522-533`、`worker/create.rs:347-374`。 | A 驗首次進入與中斷啟動/恢復、不得留半成品；B 實證差異後作 scoped repair。 | A；native 行為以驗收定，不因舊測試框架補回 TS。需改持久化契約才問。 |

**判定。** 必問者僅 installer 是否另需 Xonsh UX、`.env` 是否屬產品契約、Windows 是否列首發驗收門。其餘七例是歷史風險線索：先按列驗證，舊 origin/main 非祖系且不生移植義務；安全修補在已准範圍內可自主，若要變更契約或擴大風險則另問。可驗項不得以「不確定」轉嫁用戶。

**可直問用戶：** 請裁定：(一) 是否另需 Xonsh 專用安裝 UX（否則沿用原生 installer）；(二) 是否要求載入 `.env` 並另定其語義（否則僅取程序環境）；(三) Windows 是否列首發支援/驗收門（未驗前不稱通過）？

## Protected inputs：只查紀錄結構與根驗法

`phase0-baseline-20261011.json` 的 `.protected_inputs` 是 12 項清單；每項有 `group`、相對 `path`、`expected_sha256`、`observed_sha256`、`match`、`size_bytes`。紀錄標 `all_protected_hashes_match: true`，但該值是 2026-10-12 快照，不證此刻未變。根應按 `.group` 選 main/native 根目錄，對 `.path` 現檔逐一重算 SHA-256，比 `expected_sha256` 並核 `match`，記錄新輸出；只讀，不覆寫原件。可先以 jq 列出核對清單：

```sh
jq -r '.protected_inputs[] | [.group,.path,.expected_sha256,.observed_sha256,.match,.size_bytes] | @tsv' .planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/phase0-baseline-20261011.json
```

此處未重算雜湊，未聲稱當前校驗通過。`
