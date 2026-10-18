# 子工共識：有證之教訓

唯本源：`/home/jeff/code/fork/prime-agent/.planning/2026-10-11-native-rust-handoff/native-rust-handoff/scratchpad.yaml`；本頁只存操作教訓，不另掌計畫。

- 此為 local fork，非 release。Rust v0.10.0 已定；dotenv 從 upstream，Windows 非 gate；native installer、Arch、Xonsh 非互斥。KISS，勿生新需求。
- 只一 shared Cargo target：`/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target`。當前租者 failure-audit；catalog-closure 須根明授，勿並編、勿另造 target。
- 今已實證共用 cache 之 pa-core binary 烘入 bootstrap 樹 `CARGO_MANIFEST_DIR`，故 runtime corpus 讀舊件；UTC 綠/LA 紅非 validation patch 驗收。明用 validation `--manifest-path`，且查 binary 實際 source/corpus 路徑；換樹勿僅信 cwd 或 Cargo Fresh。
- 根僅准 `cargo clean -p pa-core` 作包級失效化，保 dependency cache；不得全清或刪 live target。stable 1.99.0、CARGO_INCREMENTAL=0；昔 incremental linker 敗之因未證，勿臆稱工具鏈缺陷。
- xonsh 原生命令之 env 用 `__xonsh__.env.swap` 或 `env` 前綴；單改 Python os.environ 曾未傳入子程序。勿 bash()；YAML 用 yq、JSON 用 jq/jmespath 擇欄。
- 原生 background job 未必自喚醒 agent；留 handle/PID、command/env、log/status 與退出通知，不 sleep 輪詢。agent completed 非 subprocess completed；遲到啟工訊不可倒覆先到之終值。
- 測試必記 full IDs 與 binary/版本。Python3.11 discovery 空選可 exit0，3.12 為 exit5；bootstrap 已改 exact dotted ID，真名過、錯名敗並留輸出。counts/exit 單獨不足證身份。
- zsh 真 env 應 editable validation runtime+skill；勿借 harness kernel site-packages。PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 加明載 asyncio plugin 已驗10/10，早先 import/plugin 敗只屬環境。
- 四 catalog 全套敗、两 isolated 綠，只證不同結果，不證上游罪或 fork 罪。共用 target 亦令舊跨樹 binary 來源須慎核。禁 unchanged full TUI 重跑，勿加 sleep/timeout 掩因。
- 原件 hashes12/12 已驗；五 TUI dirty、untracked zsh、主 PKGBUILD/.SRCINFO 勿覆。只在授權 copy 修指定檔，不 source commit/merge，不 system install。核心 shared outcomes 非已定因；未驗 package/live Rust roundtrip 不稱完成。

各工只依本職使用；遇真正新障、風險或權界交根，勿將已授小步反覆求准。報只新增結果／阻礙／下一步，詳證留檔。

## 根之判斷提示（按職取用）

### failure-audit

補大模判斷，非添工：
1. 今最省力之因果圖是「舊 binary→舊 corpus→TZ 改 hash」，它同解 UTC 綠與 LA 紅；先證新 binary 真讀新 corpus，勝於再改日期、期望 hash 或重跑一堆。檢查通過後才花 Cargo 額。
2. 每步只動一因：先修來源身份，再驗 timezone，後驗 endpoint cfg；同改 flags/fixture/test 會使綠燈失去解釋力。若 clean -p pa-core 後仍錯根，勿再全清；返查 manifest、路徑 alias、實際執行檔。
3. Endpoint 的審判對象是測試契約是否在 optimized build 仍成立，不是讓 telemetry 停送。以 actual after+cfg 判；若 production 正確而測試假定 debug，最小 test 修即足，勿升為產品重構。
4. 新 log 與 source 可推現因，不能補造舊次 env。結案可稱『缺陷已重現並修』，無須虛稱每段歷史皆已完證。尚有未解就精確隔離，不拖累已證小修。
5. 汝做因果裁斷；若日後分 Luna，僅給 hash/路徑/IDs 等機械核，不把多假設權衡丟給小員。遇兩可即帶最小證據問根，勿添十輪自轉。

### catalog-closure

補大模判斷，非添工：
1. 勿把四敗當一病。先分『初輪零 catalog 請求/錯選』與『後輪 socket 拒連』；後者可能只是前者或 mock 壽命之果。優先找第一個未達 invariant，不追最末錯堆。
2. 三個有判別力觀測點：mock 何時 accept/收命令，UI 何時達可選 catalog state，測試輸入何時送。若時序未記，窄 instrumentation 勝於重跑；若有同步缺口，用現有狀態/事件 barrier 證 readiness，不加固定 sleep。
3. 同源 test、單獨偶過都不能排 fork regression；但亦不足支持重寫產品。先在一個最能觸發首錯的 exact case 分辨 mock contract、事件順序與真連線 lifecycle，再決 test/helper 或產品何者有錯。
4. mock 單鏈是否『錯』取決於被驗契約；莫為變綠把 server 改成無限重連。若產品理應重連，可明驗兩次連線；若不應，重連乃診斷訊號，不能吞掉。
5. 若 focused 再過而無紅例，不宣告修復、不刷到紅。交未解假設、已排分支與唯一最高值後驗；根來裁成本。若 shared binary 路徑錯，先修證據來源，勿分析假對照。汝掌因果，小員只宜機械摘 IDs/hash。

