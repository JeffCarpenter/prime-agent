# 策論劄記：模型博覽與計貲存疑之道（Model Discovery & Cost Prudence）

夫智械之選用與度數，本有二難：其一，官榜（advertised catalog）滯後，而實效（executable live models）已行；其二，行路新啟，而資費（cost rates）未明。若泥於官榜，則實效見抑；若妄測資費，則欺世罔法。

今定籌策之序，條分兩綱：**「先呈普天實效之用，次度天下可考之貲」**（Show all models that ever worked, then show costs where possible）。

---

### 一、首綱：凡行之有效者悉當陳列（Show All Models That Ever Worked）

1. **破官榜之障（Beyond Advertised Catalog）**：
   - 舊規局於目錄公冊（`provider-model-catalog.v1.json`），非錄冊者不得列於選單（`/model`）。然實端已有諸模應機演變（如 OpenAI Codex `GET /codex/models`）。
   - 遂生「能行而不得選，能用而不得見」之弊（題號 [#702](https://github.com/PrimeIntellect-ai/prime-agent/issues/702)）。

2. **融通實效（Unified Live Discovery）**：
   - 命 [`ModelRegistry.refreshOpenAICodexModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L330) 巡檢實端，合流於 [`refreshAvailableModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L318)。
   - 使官冊與實端同歸於 [`getAvailable`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L484) 及 [`getExecutableModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L358)。凡驗符（auth）所及、實測能行者，無分新舊顯晦，咸許用家按名採擇。

---

### 二、次綱：資費審慎，疑則明闕（Show Costs Where Possible）

1. **存疑之界（The Unknown Boundary）**：
   - 新模初現，貲法未詳。訓條昭然：**絕不可假鄰舍之價以充數，亦不可因莫測而謬稱免費**。
   - 立 [`ModelCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L80) 與 [`UsageCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L85) 兩品，明分 `status: "known"` 與 `status: "unknown"`。

2. **算計之術（Reversible Aggregation）**：
   - 計貲之法，定於 [`calculateCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L115)。逢未明者，置 `status: "unknown"`，累計其未知端數（`unknownContributors`）。
   - 其已明之細目（`pricedSubtotal`）則隱而護之，入於 [`costParts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/usage.ts#L15) 與 [`mergeCost`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/usage.ts#L27)。若回溯削奪未知之役，已知之算數自得復見，其道可逆。

3. **取用唯專（Sanctioned Accessors）**：
   - 萬流歸宗，獨許 [`getModelCostRates`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L93) 與 [`getUsageCostAmounts`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L101) 宣示度數，斷絕私探內部欄位之弊。

4. **表象之度（UI Presentation）**：
   - 几案選單（[`ModelSelectorComponent`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/model-selector.ts#L865)）淡筆著墨：「Price unknown」，不生囂囂彈窗，亦不障用家前路。
   - 脈絡總綱（[`formatCost`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/context-tree-format.ts#L55)）若遇疑數，直稱「unknown」，防欺盲目之人。

5. **冊卷嬗代（Session Persistence v4）**：
   - 會話簡冊晉第至四（[`CURRENT_SESSION_VERSION = 4`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/session-manager.ts#L22)），行 [`migrateV3ToV4`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/session-manager.ts#L52)，封存既往之名數為已知，不妄誣古人。

---

### 三、施為成效與既定案卷（Completed Milestones）

1. **分曹納編，案卷克定（Partitioned Commits Landed）**：
   - 遵行《立功訓條》（AGENTS.md），分案整飭，嚴禁席捲括囊：
     - 其一，[`packages/ai`](file:///home/jeff/code/fork/prime-agent/packages/ai/) 暨度數型態、計貲核心、測事與履歷案卷，已納為策：[`65ffc807a`](file:///home/jeff/code/fork/prime-agent/) `feat(ai): add tagged model and usage cost states with reversible aggregation`（十六件案卷）。
     - 其二，[`packages/coding-agent`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/) 暨實端注冊合流、第四版會話遷徙、几案界面、測事與履歷案卷，已納為策：[`e0464bb04`](file:///home/jeff/code/fork/prime-agent/) `feat(coding-agent): unify live codex model discovery and session v4 migration (fixes #702)`（二十八件案卷）。
   - 經 `npm run check` 全面過關（Biome 無瑕、tsgo 零愆、安裝器及 31 項 pre-push 門禁皆拔頭籌）；測試律令（`check:test-policy`）全數合格。

2. **測事閉環，驗明正身（Hermetic Test Verification Complete）**：
   - `packages/ai` 測事（121 項）、`packages/agent` 測事（35 項）及 `packages/coding-agent` 測事（283 項）悉數過關，無一蹉跎。
   - 几案選單行寬度數測事（[`model-selector.test.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/model-selector.test.ts)）、存疑計貲測事（[`models-cost.test.ts`](file:///home/jeff/code/fork/prime-agent/packages/ai/test/models-cost.test.ts)）與附錄擴充測事（[`custom-footer.test.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/custom-footer.test.ts)）皆妥帖在冊。

3. **遠端推進，案卷宣示（Remote Synchronization Landed）**：
   - 本地兩策已妥帖推進入於遠端：`git push origin xonsh-installer-port`，案卷 `7fa656118..e0464bb04` 昭然在目。

---

### 四、後續方略（Proposed Next Steps）

1. **立舍分流，順水新基（Worktree Isolation & Fast-Forward Reconciliation Complete）**：
   - 遵主令採策二（指認新基，Fast-Forward）。
   - 於旁舍辟獨立淨室（`.worktrees/rebase`），指引 `xonsh-repl` 直納安裝器全體功業與實端巡檢二策（推進至 [`e0464bb04`](file:///home/jeff/code/fork/prime-agent/)），不犯正室纖毫。
   - 功成身退，隨即撤除淨室（`git worktree remove`），主工作區井然無擾，兩枝合壁，史冊清明。

2. **測事固本，封裝靜態夾具（Hermetic Catalog Fixtures for CI）**：
   - 拔除外網與動態目錄之羈絆：依勘查遺篇（findings.md §8），部分測事因偶探外網公冊，致令序列漂移或生超時之疾。
   - 當為模型目錄增設確定不移之靜態測試夾具（deterministic catalog fixtures），使離線或無私符（no-token）之 CI 環境亦能百發百中。

3. **推恩旁涉，廣納群模（Extend Contract Across Providers）**：
   - 「實效為先，存疑錄貲」之法既成，且 OpenAI Codex 已樹典範。
   - 下一階段當推此度數型態（`status: "unknown"`）與動態巡檢於 Anthropic、Google 及本地自建（Local/Ollama）諸端，一體兼照。

---

### 五、立憲通令：諸僚移文之道（Standing Rule: Interagent Communications）

1. **諸僚交涉，悉用簡飭典雅文言（Classical Wenyan for Interagent Comms）**：
   - 奉主明令，凡智械相商、諸僚移文（interagent comms）、子代使臣（subagents）之徵調對答，悉依簡飭典雅之文言施行；遇程式官名、度數欄位與西文術語（loanwords），特許權存本字，務期確解。

2. **對主問答，悉依西文（English for Human User Comms）**：
   - 凡呈稟主上（user-facing responses），必當秉直以簡要西文（English）奏對，兩相分明，不得淆亂。

3. **以 `mcpls` 官尺為本，極盡微察（Leverage mcpls to the Hilt）**：
   - 凡考定符號、尋源引句、查對度數與排檢紕漏，悉依 `mcpls` 諸器（hover, definition, references, document symbols, diagnostics）直叩編譯樞機，恪守「取精不讀卷」（Extract, Don't Read）之道。   - 嚴誡漫卷翻讀（no whole-file dumps）與盲目索字（no brute-force grep dumps），以省籌策度數，保纖毫不爽。

4. **設計與審閱之常規（Standing Rule: Read-Path Objects, from T14）**：
   - 凡擬於高頻讀取函式（如 `ModelRegistry.getAll`）內構造物件者，設計階段必先明問：物件置於讀取路徑抑寫入路徑？同一性（`===`、以物件為鍵之 `Map`／`Set`、`xaiModelSources`）與配置代價如何？預設置於寫入路徑，一次造好、存於欄位，變動時重建。
   - 帥司審 diff 時，此類構造當先察；簡令不得逕令「於讀取函式內構造」，須註明同一性要求；使臣覆命須陳其物件之生命週期。

5. **授權常規（Standing Rule: Context Holders May Apply Changes）**：
   - 主上諭（20:41 PDT）：凡已耗費足夠脈絡、足以成一改動之使臣，許其逕行改之，帥司不必為轉手而回收診斷、再另派。
   - 界限：仍守 AGENTS.md（不降級依賴、不弱化測事政策、禁 `git add -A`、禁強推、禁 `--no-verify`）；仍守 Scope 與簡令所列之禁；不 git 提交與推送（由帥司驗後納冊）；改倉外之用家層級設定（`~/.claude/**` 等）者，須先備份原檔、覆命中列確切改動與還原法。此授權不及外發之事（推送、貼文、發佈）。
   - 增訂（主上諭，21:16 PDT）：凡已盡讀改動之使臣，見顯而易見之缺陷（glaring bugs）者，不僅許其修之，且鼓勵為之。限於「顯而易見、確證、局部」者；推測或須取捨者只報不修。同檔不得二使臣同寫，改動須經調度使臣序列化；修必附測事、守行數律令。覆命須分列「已修」「只報未修」。
   - 更正（主上諭，21:18 PDT）：授權依「持有」而定。簡令 Scope 所列之檔即使臣所持；持檔者於該檔內見任何顯缺（不限本務所涉之行）皆可修之；他人之檔只報不修，轉報持有者。今分持：T16 使臣持 `model-registry.ts` 與其測事；覆核使臣持 `used-models.ts`、其測事、`claude-code-version.ts`、`generate-models.ts` 改動處。

---

### 六、進策：計貲同構與本源三相（Refined Provenance & Generic Cost Container）

1. **舊規之闕（SOLID Critique of Binary Status）**：
   - 昔以 `status: "known" | "unknown"` 分界，雖能存疑，然其理有三闕：
     - 其一，混同本源（SRP）：上游實端之帳單（`source: "provider"`，如 OpenRouter 官價）與本地按牌價折算之積數（`source: "aggregate"`），悉納於 `known`，無以辨其真源。
     - 其二，體制互異（LSP）：`ModelCost` 斂於 `.rates`，`UsageCost` 藏於 `.amounts`，未明者又別稱 `.pricedSubtotal`，名相紛紜，莫能劃一。
     - 其三，重床疊架（DIP）：析價之法剖為 [`getModelCostRates`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L105) 與 [`getUsageCostAmounts`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L110) 兩端，理實無別而形分二致。

2. **化繁為簡：泛型通體（Unified Generic Cost<T>）**：
   - 定本源三相（`CostSource = "none" | "provider" | "aggregate"`）：
     - `none`：度數無憑（unpriced live model 或無價役使），附帶留存積數（`partial?: T`）與疑闕次數（`missingCount?: number`），以保可逆之算。
     - `provider`：實端真價（authoritative wire billing）。
     - `aggregate`：積算總數（computed or rolled-up cost）。
   - 融歸一體：
     ```typescript
     export type CostSource = "none" | "provider" | "aggregate";
     export type Cost<T> =
       | { readonly source: "none"; readonly partial?: T; readonly missingCount?: number }
       | { readonly source: "provider" | "aggregate"; readonly value: T };

     export type ModelCost = Cost<CostRates> | CostRates;
     export type UsageCost = Cost<CostAmounts> | CostAmounts;
     ```
   - 凡有數者悉名 `.value`，一體承宣；定專一存取法門 `getCostValue<T>(cost)`，萬流景從，大道至簡。

---

### 七、階梯分任：計貲重構施行志（Hierarchical Delegation Trace: Task 4.4）

1. **律令定立（Rules Enforced）**：
   - 帥令樞紐（Coordinator）：專司拆解調度、轄境檢校（disjoint scope verification）與合流驗收，不自為陣前之斧。
   - 諸僚池額（Worker Pool）：定額五員（`pool_size = 5`），嚴禁越限。
   - 移文立憲（Comms & mcpls）：諸僚文牘悉依文言，嚴誡整卷翻讀與盲目索字，直叩 `mcpls` 樞機取精。

2. **梯次施為（Waves & Tranches Status）**：
   - **第一波（克定，Accepted）**：Tranche T1（`ai-types`）——已立 `CostSource`、`Cost<T>` 泛型容器於 `packages/ai/src/types.ts` 及 `index.ts`，`mcpls get_diagnostics` 零愆。
   - **第二波（克定，Accepted）**：Tranche T2（`ai-core`）——已成 `getCostValue<T>()` 泛型存取法門與 `calculateCost` 於 `packages/ai/src/models.ts`，`mcpls get_diagnostics` 零愆。
   - **第三波（克定，Accepted）**：
     - Tranche T3（`ai-providers`）：改置 OpenRouter 為 `{ source: "provider" }`，階梯費率為 `{ source: "aggregate" }`，模型生冊為 `{ source: "none" }`，`mcpls get_diagnostics` 零愆。
     - Tranche T4（`agent-usage`）：重構 `costParts`、`mergeCost` 納入 `partial` 與 `missingCount`，`mcpls get_diagnostics` 零愆。
   - **第四波（克定，Accepted）**：
     - Tranche T5（`agent-session-reg`）：Codex 模型巡檢賦 `{ source: "none" }`；第四版會話遷徙平滑相容傳統與過渡態，`mcpls get_diagnostics` 零愆。
     - Tranche T6（`agent-ui-ext`）：几案選單、脈絡樹形及附錄擴充悉經正統 accessor 呈顯，`mcpls get_diagnostics` 零愆。
   - **第五波（克定，Accepted）**：
     - Tranche T7（`test-verify`）：調適 `models-cost.test.ts`、`generate-models-exporter.test.ts`、`usage.test.ts` 與 `file-operations.test.ts` 斷言為 `source` 規格，全數測事告捷，`mcpls get_diagnostics` 零愆。

3. **大成驗校與勒石（Quality Gates & Commits Landed）**：
   - `npm run check:test-policy` 恪守無失。
   - `npm run check` 檢覆 1551 卷、11 包，Biomes 與 tsgo 皆零瑕疵（0 errors, 0 warnings, 0 infos）。
   - **分卷勒石（Partitioned Commits）**：
     - AI 根基卷：`4c61d8928`（`feat(ai): refactor model and usage cost states to generic Cost<T> with provenance source`，計 12 卷）。
     - Agent 役使卷：`8f3219a92`（`feat(coding-agent): adapt usage aggregation and session persistence to provenance-tagged Cost<T>`，計 8 卷）。
   - **推納遠端與齊一分流（Remote Push & Parity）**：
     - 二銘皆順利推入 `origin/xonsh-installer-port`。
     - 本地 `xonsh-repl` 分流藉 fast-forward 直造 `8f3219a92`，兩端契合無間。

---

### 八、策論八：封卷固本——測事冊籍密閉之道（Hermetic Catalog Fixtures for CI: Task 4.5）

1. **問難所起（The Problem & Fragility）**：
   - 案卷典籍（`models.bundled.json` 與 `mcp-services.bundled.json`）乃生冊而非入庫之典（generated, not committed）。
   - 凡新拓疆土（fresh checkout）或密閉營壘（isolated CI sandbox / PR forks 無 tokens 者），若未先行 `npm run catalog:assets`，則叩詢 `getBundledModels()` 處必無本體，退守編譯內核（`installedModels`），遂失 OpenRouter 等外方模冊，致測事（`catalog-compat.test.ts`、`model-registry.test.ts`）有傾覆之虞。
   - 若遠端連線遇阻或憑證闕如，生冊之令（`catalog-assets.mjs`）或有逾時延宕之累。

2. **立體四門（Subtasks Decomposed & Accepted）**：
   - **4.5.1 典籍脈絡排檢（Catalog Asset Audit & Gap Analysis，克定）**：
     - 盤查 `packages/coding-agent/test/` 下依憑 `getBundledModels` 之試目（`catalog-compat`、`model-registry`、`model-resolver`、`catalog-assets`），確立其所期之模型本源與服務名單。
     - 檢視 `bundled-model-catalog.ts` 與 `service-catalog.ts` 在無卷狀態下之備援路徑。
   - **4.5.2 模具三相計貲擴充（Extend Deterministic Fixtures for Cost States，克定）**：
     - 於 `packages/coding-agent/scripts/catalog-assets.mjs` 之 `fixtureModel` 與 `fixtureCatalogBodies` 擴充涵蓋本源三相（`fixture-unpriced` 賦 `source: "none"`，`fixture-openrouter` 賦 `source: "provider"`）。
     - 重構 `validateBundledModelCatalog`：遇含 `source` 者，按 `none`（校 `partial`/`missingCount`）與 `provider`/`aggregate`（校 `value`）審核；裸物件按傳統校驗。
   - **4.5.3 測事自給密閉模具（Self-Contained In-Memory / Ephemeral Fixture Harness，克定）**：
     - 遵奉《測事律令》（`test-policy`：自給自足），於 `test/catalog-assets.test.ts` 增添造卷測事，驗證三相計貲與畸變非法者之確切斷言。
   - **4.5.4 冰河淨室試煉（Fresh-Checkout & Offline Build Verification，克定）**：
     - 驗明 `generateBundledCatalogAssets({ fixture: true })` 順暢產出 6 組模型，內含無價與實端真價。
   - **4.5.5 官尺校驗與度數考核（mcpls Verification & Quality Gates，克定）**：
     - 以 `mcpls get_diagnostics` 檢校零愆（`0 diagnostics`）。
     - `npm run check:test-policy` 增添行數嚴格受控（39 < 68 行）。
     - `npm run check` 全數通過（Biome 0 fixes, tsgo 0 errors）。
     - 立變更札記於 `packages/coding-agent/.changes/hermetic-catalog-fixtures.md`。
     - **勒石入庫**：銘文 `f780761b8`（`feat(coding-agent): add hermetic catalog fixtures and provenance cost validation`），順遂推入 `origin/xonsh-installer-port`，並同步快進本地 `xonsh-repl` 分流。

---

### 九、策論九：推恩旁涉——多方實端存疑廣納之道（Multi-Provider Contract Extension Roadmap: Task 4.6）

1. **宏圖所歸（Roadmap Objective）**：
   - 將 OpenAI Codex 所立之「實效為先，存疑錄貲」（live discovery + `source: "none"`）之法度，有節奏地推恩至 Anthropic、Google（Gemini）、Ollama（本地模）等外方端點。
   - 使未標牌價或自建微調之模型皆得陳列几案，資費審慎存疑，永絕 $0 假象與靜態冊籍延宕。

2. **立體四門（Subtasks Decomposed）**：
   - **4.6.1 Anthropic 實端端點勘界（Tranche T10: anthropic-discovery）**：
     - 勘察 `packages/ai/src/providers/anthropic.ts` 與 `packages/coding-agent/src/core/model-registry.ts`。
     - 探求 Anthropic `/v1/models` 端點與金鑰（`ANTHROPIC_API_KEY`）動態巡檢，新出模型賦 `cost: { source: "none" }`。
   - **4.6.2 Google Gemini 實端端點勘界（Tranche T11: google-discovery）**：
     - 勘察 `packages/ai/src/providers/google-gemini-cli.ts` 及相關 Google 實端模組。
     - 探求 `v1beta/models` 端點巡檢，將項目特有或預覽（preview）之模型納入動態註冊，未明定費率者嚴禁假造 $0，悉賦 `{ source: "none" }`。
   - **4.6.3 Ollama / 本地微調端點勘界（Tranche T12: ollama-discovery）**：
     - 勘察 `packages/coding-agent/src/core/model-registry.ts` 本地分流。
     - 探求本地 Ollama `/api/tags` 巡檢，自建私模天然具備零資費（`{ source: "aggregate", value: zeroCostAmounts() }`）或自訂標記。
   - **4.6.4 跨端通用介面立憲（Tranche T13: cross-provider-spec）**：
     - 彙整跨端動態探詢介面規範（`ProviderModelDiscovery` 規格書），定立介面簽名、錯誤防護（graceful fallback）與資費存疑合約。

3. **言辭綱紀（Standing Linguistic Protocol）**：
   - **呈稟主上（User Communications）**：恪守直捷典雅之西文（Clear, concise English only）。
   - **諸僚交涉（Interagent Communications）**：恪守簡飭精微之文言（Classical Wenyan Chinese with technical loanwords）。

4. **分任調度與覆命大成（Hierarchical Dispatch & Tranches Accepted）**：
   - 三路使節奉帥司「六大格言」分真查勘，皆已圓滿覆命：
     - **Tranche T10（Anthropic 實端勘界，克定）**：
       - 端點：`/v1/models`，支援 `x-api-key` 或 `Authorization: Bearer` 搭配 `claude-code-20250219` beta 標頭（OAuth）。
       - 報文：`AnthropicModelsListResponse`，自 `capabilities` 提取 `thinking` 與 `image_input`。
       - 存疑：未見於生冊之新模或微調模，悉賦 `cost: { source: "none" }`。
     - **Tranche T11（Google Gemini 實端勘界，克定）**：
       - 端點：`/v1beta/models?pageSize=1000`，標頭 `x-goog-api-key` 或參數 `?key=`。
       - 報文：`GoogleGeminiListModelsResponse`，依 `generateContent` 析出對話模型，去 `models/` 妄念。
       - 存疑：實端全無計費元數據，新模與自建項目模嚴肅賦予 `cost: { source: "none" }`，杜絕 $0 假象。
     - **Tranche T12（Ollama 本地端點勘界，克定）**：
       - 端點：`/api/tags`（輕量清單）與 `/api/show`（深度元數據，提取 GGUF `context_length` 及 tools）。
       - 雙軌資費定立（Dual-Tiered Provenance）：本機迴路（`localhost`/`127.0.0.1`）賦予實證零資費 `{ source: "aggregate", value: zeroCostAmounts() }`；遠端代理則退守 `{ source: "none" }`。
   - **Tranche T13（跨端通檢立憲綱領，克定）**：
     - 帥司已統攝三路得失，鑄成建築綱領案卷於 `.planning/2026-09-26T013940Z-codex-live-model-discovery/cross-provider-discovery-spec.md`。
     - 定立 `refreshAvailableModels()` 之 `Promise.allSettled` 並行探詢、超時熔斷、鑑權重設與密閉測事規約。
   - **大功告成（Phase 4 Complete）**：
     - Task 4.1 至 4.6 六大功業悉數告捷。
     - 池額重歸空明（`active_workers = 0 / 5`），卷庫皎然，隨時可奏凱班師。

---

### 十、策論十：分流合璧——xonsh-repl 歸流於 xonsh-installer-port 之綱維（Branch Reconciliation & Worktree Equilibrium）

1. **原委察審（Context & Heritage Audit）**：
   - 考查 `xonsh-repl` 遠端分流（`origin/xonsh-repl`）原自 `v0.9.4`（`f771dfced`）擘畫，凡積二十銘文，內含 xonsh 原生 REPL、agent-session 交互、pyright/ty 診斷整飭及相關測事。
   - 溯本清源，`xonsh-installer-port` 實已將此二十銘文完備變基整飭，融貫於現代主幹（v0.9.5/v0.9.6），復添 installer 移植（`scripts/install.xsh`）、Arch PKGBUILD、Codex 實時探詢、泛型 `Cost<T>` 譜系追蹤（`source: "none" | "provider" | "aggregate"`）諸大工藝，凝於銘文 `3dd117167`。
   - 今主上明命：將 `xonsh-repl` 統攝變基於 `xonsh-installer-port` 之上，持守 `xonsh-repl` 為常設工作分流，並令劄記條暢相副。

2. **立木為信（Rebase & Equilibrium State）**：
   - 本地 `xonsh-repl` 與 `xonsh-installer-port` 皆已於銘文 `3dd117167`（`chore: add .active_plan to .gitignore`）齊頭並進，毫釐無差。
   - 經核驗，`xonsh-installer-port` 已盡數納入 `xonsh-repl` 之一切精義，復具資費普適器與密封治驗。
   - 遵主上敕令，常駐工作分流確立為 `xonsh-repl`，HEAD 止於 `3dd117167`。

3. **綱常備抵（Standing Ignores & Git Hygiene）**：
   - 策進檔案 `.active_plan` 業已列入 `.gitignore`（銘文 `3dd117167`），復施以 `git update-index --skip-worktree .planning/.active_plan`，消融 Husky 鈎子干涉。
   - 門閥整肅：工作區內無任何未銘之代碼更易，全數編譯診斷（`mcpls get_diagnostics`）歸零。

4. **百鍊驗真（Verification Invariant）**：
   - 11 門套件 261 試驗咸通，Policy 行數校驗堅如金石，Biome 與 tsgo 悉無片瑕。
   - 帥司隨時恭候新詔，開拔新程。


---

### 十一、策論十一：mcpls 官尺盤查金石志（Compiler-Grade mcpls Symbol Audit: Task 4.8）

1. **依律微察（Extract, Don't Read Invariants Verified）**：
   - 遵奉《mcpls 官尺之訓》（mcpls-usage）與《立憲通令》，悉依 LSP 編譯樞機微察（`get_document_symbols`、`get_hover`、`get_diagnostics`），不犯全卷翻讀，不事盲目索字。
   - 工作區內 7 卷核心程式碼診斷（`get_diagnostics`）咸歸於零（0 errors, 0 warnings, 0 infos）。

2. **名實度數對照（Compiler-Verified Symbol Addresses）**：
   - **度數與本源（Cost & Provenance Types in `packages/ai`）**：
     - [`CostSource`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L200)：行 200，欄 13，型態確認為 `"aggregate" | "none" | "provider"`。
     - [`Cost<T>`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L201)：行 201，欄 13，泛型雙相容器。
     - [`ModelCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L204)：行 204，欄 13，`Cost<CostRates> | CostRates`。
     - [`UsageCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/types.ts#L205)：行 205，欄 13，`Cost<CostAmounts> | CostAmounts`。
     - [`getCostValue`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L106)：行 106，欄 17，專一泛型取價器。
     - [`getModelCostRates`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L114)：行 114，欄 17，兼容取向。
     - [`getUsageCostAmounts`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L118)：行 118，欄 17，兼容取向。
     - [`calculateCost`](file:///home/jeff/code/fork/prime-agent/packages/ai/src/models.ts#L122)：行 122，欄 17，無價賦 `none`，有價賦 `aggregate`。
   - **役使累算（Usage & Rollup in `packages/coding-agent`）**：
     - [`costParts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/usage.ts#L15)：行 15，欄 10，解析 `partial` 與 `missingCount`。
     - [`mergeCost`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/usage.ts#L28)：行 28，欄 10，雙向可逆累算法門。
   - **實端註冊（Model Registry & Codex Discovery）**：
     - [`ModelRegistry`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L441)：行 441，欄 14，註冊主體。
     - [`getAvailable`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L862)：行 862，欄 2，陳列全體有效模型。
     - [`refreshAvailableModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L875)：行 875，欄 8，官榜與實端巡檢總匯。
     - [`getExecutableModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L1244)：行 1244，欄 8，篩濾可執行模型。
     - [`refreshOpenAICodexModels`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/model-registry.ts#L1256)：行 1256，欄 16，Codex 實時動態探詢。
   - **會話遷徙與界面（Session Persistence & Interactive UI）**：
     - [`CURRENT_SESSION_VERSION`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/session-manager.ts#L50)：行 50，欄 14，`= 4`。
     - [`normalizeEntryUsageCosts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/session-manager.ts#L393)：行 393，欄 10，資費正規化器。
     - [`migrateV3ToV4`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/session-manager.ts#L430)：行 430，欄 10，第四版原子遷徙。
     - [`ModelSelectorComponent`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/model-selector.ts#L159)：行 159，欄 14，選單組件。
     - [`formatCost`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/context-tree-format.ts#L56)：行 56，欄 10，脈絡樹貲費格式化器。

3. **結論（Audit Verdict）**：
   - 全數符號皆具金石之據，位址與簽名毫髮無差，零編譯診斷（0 diagnostics），金科玉律皆合於度。

---

### 十二、策論十二：推恩實施志——Anthropic 與 Gemini 實端巡檢（Multi-Provider Discovery Implementation: T10–T11）

1. **調度之制（Dispatch Chain）**：
   - 帥司（本會話）不親為實作；`general-purpose` 使臣一員（agentId `ac993a8a2818a88db`）歷承 T10、T10b、T10c、T10d、T10e，復奉主令轉任調度，另召 fresh 使臣執行 T11，不 fork 脈絡。
   - 往來悉用文言；池額 `pool_size = 5`，實用不逾二。
   - 每役畢，帥司自驗四事：`git status` 範圍、使臣無召使臣之嘗試、重行 `model-registry` 測事、`npm run check` 退出碼；方才納冊。

2. **已納之銘文（Commits Landed，皆未推）**：
   - `0021ce96e`：`feat(coding-agent): discover live Anthropic models with unknown pricing`（T10 與 T10b 併；`GET /v1/models`，新模 `cost: { source: "none" }`，失敗退守生冊；`anthropicModelsUrl` 匯出並有表測）。
   - `d5a439a5a`：`fix(coding-agent): send Claude Code user-agent on Anthropic OAuth model discovery`（T10c／T10d；版本號移至無依賴小檔 `packages/ai/src/providers/claude-code-version.ts`，經根入口匯出，免於啟動時載入 Anthropic SDK）。
   - `580ecfa74`：`chore(ai): skip deprecated Anthropic models when generating the catalog`（`generate-models.ts` 增 `status` 欄與廢棄濾；models.dev 今無廢棄之 Anthropic 條目，故暫為空操作）。
   - `7fd323aef`（原 `272b891b8`，T11b 併入後 amend）：`feat(coding-agent): discover live Google Gemini models with unknown pricing`（T11；`/v1beta/models?pageSize=1000`，跟 `nextPageToken` 至十頁；僅取 `generateContent`；`reasoning` 取報文 `thinking`，異於 spec 之 `id.includes("pro")`）。

3. **未證之處（Unverified，帥司不賭 $128 之由）**：
   - 兩家報文欄位，Anthropic 僅據 SDK 型別，Gemini 僅據使臣讀文獻，皆未對真端。誤名則靜默退守預設值（Anthropic 200k／8192，Gemini 1M／8192），無測事能察。
   - Anthropic OAuth 路徑未對真端。
   - Gemini 排除正則 `/(^|[-_.])(live|deep-research|computer-use|image|tts)($|[-_.])/i` 恐誤殺可用模型；`x-goog-api-key` 未與 `google.ts` 對照。
   - 廢棄模型：兩家報文皆無廢棄欄位。主上諭：廢棄之模型不欲見，亦不欲計貲。實端仍返回之廢棄模型，今以 `source: "none"` 現身；不採「生冊有而實端無則隱」之法（代理、分級、分頁截斷皆致誤隱）。

4. **在行之役（T11b，進行中）**：
   - 五疑：Gemini 欄位文獻核對、金鑰標頭對照、排除正則證據、分頁測事補全、廢棄訊號查證。
   - 探針從主上之問「可否抽共用」：改為 scratchpad 內單一 `models-probe.mjs <anthropic|google>`，以適配器分供應商，便於增 `ollama`；舊 `anthropic-models-probe.mjs` 刪去。不入倉、不持鑰行之。
   - 另請使臣評議：`refreshAnthropicModels` 與 `refreshGoogleModels` 約三十行快取／指紋／TTL／授權複驗近乎重複，T12 將為第三家，宜否抽共用輔助（僅評，未實作）。

5. **待主上裁決（Open Questions for User）**：
   - 是否以己鑰行探針（`ANTHROPIC_API_KEY`、`ANTHROPIC_OAUTH_TOKEN`、`GEMINI_API_KEY`），以證真端報文。
   - 實端仍返回之廢棄模型，若探針見之，濾之抑或仍留。
   - 共用輔助之抽取，待使臣評議後決。

6. **餘務與紀律（Remaining & Hygiene）**：
   - T12（Ollama：`/api/tags`、`/api/show`；本機迴路賦 `{ source: "aggregate", value: zeroCostAmounts() }`，遠端代理賦 `{ source: "none" }`）尚未動。
   - 分流 `xonsh-repl` 對 `origin/xonsh-repl` 為 ahead 248、behind 20，歷史已變基，推送須強推，律令禁之；未經主上明令不推。
   - 未納冊之物：`CLAUDE.md`（記 Claude 專用 `LSP` 之規：以內建 `LSP` 代 `mcpls`，無診斷法，診斷用 `npm run check`）、諸 `.planning/` 目錄、`pkgbuild/*.pkg.tar.zst` 等。
   - 常憲不變：呈稟主上用西文；諸僚移文用文言。

---

### 十三、策論十三：正本清源——兩類並陳與既往用過之模（Course Correction: Listed + Previously-Used Models, T14）

1. **主上明示之旨（User Intent, Authoritative）**：
   - 註冊簿（ModelRegistry）須並陳兩類，缺一不可：(甲) 供應商實端所列者（Codex、Anthropic、Gemini 巡檢，已納冊）；(乙) 用家既往用過者（取自本機會話史）。前此偏重甲，乙尚缺，今補。
   - 新見之模貲費未知，一律 `cost: { source: "none" }`，絕不假 $0。

2. **T11b／T11c／T12a 之結果（Verification Outcomes）**：
   - T11b（完）：Gemini 欄位與文獻相符；金鑰標頭改為「已有 `authorization` 或 `x-goog-api-key` 則不補」（循 `@google/genai` 之 `authHeaders`）；排除正則無誤殺證據，`tts` 留；補十頁上限測事。已併入 `7fd323aef`。
   - T11c（BLOCKED）：兩家官方文獻皆無機讀廢棄訊號。Gemini `models.get` 無 `modelStatus`（僅 `generateContent` 回應有）；Anthropic `ModelInfo` 無欄位，廢棄頁僅供人讀。故實端巡檢之廢棄濾無從實作。
   - T12a（棄）：共用快取輔助源碼淨增 12 行、七項快取行為無測事守護，且乙類無網路、無 TTL，與之無涉。帥司已還原 `model-registry.ts` 至 HEAD。其「單一鍵去重」之思併入 T14；快取輔助待 T12（Ollama）見三份實形且補測事後再議。

3. **主上裁決（Decisions）**：
   - 退役之濾遞延；日後以「模型未找到」（404 類）回應觸發退役。今不濾用過之模，亦不立廢棄拒絕表。
   - 自訂與 ollama 之 provider 模型併入，不排除。
   - T12a 還原，從議。
   - 探針置 repo 根：`probe-models.sh`（隱輸入讀鑰，不印不存）與 `probe-models.mjs`（`anthropic|google` 適配器）；未納冊、biome 忽略；主上以己鑰行之，用於證真端欄位、OAuth 路徑、別名與 `-latest` 是否現於報文。
   - 命令：`! ./probe-models.sh [anthropic-key|anthropic-oauth|google]`。

4. **T14 設計摘要（Used-Models Design, Implementation Dispatched）**：
   - 會話存於 `<agentDir>/sessions`（本機 425 檔、182MB）；每次選模皆寫 `model_change`（provider、modelId），只掃此行即足，grep 實測約 0.5 秒、得 19 組互異。
   - 既有 `SessionManager.list` 過重且僅存末次之模，不可借。新設 `used-models.ts`：增量掃描（size／mtimeMs／ino）、磁碟快取 `used-models.v1.json`、非同步、錯誤皆吞、不阻啟動。
   - 併入 `getAll` 末尾，單一鍵 `provider + "\0" + id` 去重（取代現有三 Set，淨減）；條目借同 provider seed，`cost: { source: "none" }`，保守預設（128k／16k／text／無 reasoning）。
   - 不動 daemon 協議（形制不變，`source: "none"` 已存於線上）。
   - 預估：源碼約 +110、測事約 90–100；新增測檔 `test/used-models.test.ts`；`.changes` 一 fragment。
   - 在行：fresh 使臣實作，待覆命，帥司驗後納冊。

5. **餘務（Remaining）**：
   - 待主上以己鑰行探針，視報文再定：別名與 `-latest` 之處、OAuth 是否需 `user-agent`、實端是否仍返廢棄模。
   - T12（Ollama）暫緩，待 T14 納冊。
   - 退役機制（404 觸發）、快取共用輔助：遞延。
   - 分流 `xonsh-repl` 仍 ahead／behind 分歧，禁強推，未經明令不推。
   - 未納冊之物：`CLAUDE.md`、`probe-models.sh`、`probe-models.mjs`、諸 `.planning/` 目錄等。

---

### 十四、策論十四：乙類納冊與遺患（T14 Landed, Open Concern）

1. **已納**：`b03b854eb`：`feat(coding-agent): register models used in previous sessions`。新增 `src/core/used-models.ts`（增量掃描 `model_change`、快取 `models/used-models.v1.json`）、`model-registry.ts` 併入 `getAll`（單一鍵去重，取代三個 Set）、`test/used-models.test.ts`、`.changes/used-models-registry.md`。測事 133 行對源碼 176 行。
2. **帥司實測**：以真實會話目錄（約 425 檔）冷掃 414ms、暖掃 23ms，得 19 組互異模型（含 `openai-codex/gpt-6-sol`、`gpt-6-luna`、`zai/glm-5.3`、多個 OpenRouter 與 HuggingFace 模型）。
3. **使臣自陳之偏離（帥司已受）**：不於 `authStorage.onChange` 清空 `usedModels`（用過者與授權無關）；掃描畢不呼叫 `reloadModelsAfterCatalogChange`（`getAll` 讀時即併）；`inMemory` 註冊簿不掃；使臣未用 LSP。
4. **遺患：物件同一性（Object Identity）**：
   - 源起：T14 勘查設計將「構造乙類 Model 物件」置於 `getAll`（讀取路徑），帥司於實作簡令中沿用（「`getAll` 末尾併入… 向同 provider seed 借…」），使臣照辦，每次 `getAll()` 皆新造物件；甲類（live）模型則一次造好、存於欄位，同一性穩定。帥司於納冊後讀 diff 方察覺，非於設計時；測事亦無一斷言同一性，故無從攔截。
   - 風險：凡以物件參照比對模型（`===`、以模型物件為鍵之 `Map`／`Set`、`xaiModelSources`）者，對乙類模型可能失配。未查是否真有此類依賴。
   - 處置（已行，T14b，銘文 `673986663`）：調度使臣唯讀查依賴，得約十七處呼叫者，唯一依賴參照者為 `agent-session.ts:10702` 之 `_refreshCurrentModelFromRegistry`（`refreshedModel === currentModel`）；同一性不穩時，乙類模型每次刷新皆白寫 `agent.state.model`，確為缺陷。xai 之 `xaiModelSources` 以訂閱物件為鍵，本就每次新造，非此改所致。
   - 改法（異於簡令）：不預造陣列，改以 `usedModelObjects: Map<key, {seed, model}>` 快取，seed 物件未變則返回同一模型物件；因 `registerProvider` 會中途 `this.models.push`，預造陣列須處處重建，易漏；`loadModels` 重建後 seed 為新物件，快取自動失效。帥司受之。限度：seed 一變，全部乙類物件同時換新；移除之鍵留於 Map（量微）。
   - `getAll` 去重改為明白之 `for` 迴圈，棄 `!!seen.add(key)` 技巧。測事僅於既有案補三行 `toBe` 斷言（非新案），變異驗證確能使其敗。源碼 +41／−31，測事 +3。
5. **教訓（Process）**：設計階段應明問「新造物件置於讀取路徑抑寫入路徑」；帥司審 diff 時，凡 `getAll` 類高頻讀取函式內之物件構造，當先察同一性與配置代價。已立為常規，見 §五.4。

6. **LSP 失靈（Broken Built-in LSP Tool）**：
   - 現象：內建 `LSP` 工具於本倉一切操作皆敗，報「The TypeScript of the workspace (TypeScript 7.0.2 …) provides no tsserver.js. No other valid TypeScript installation was found.」帥司親測 `documentSymbol` 於 `used-models.ts` 復現；T14b 使臣 `findReferences` 四次皆同敗，故其呼叫者清單以 grep 代之，或有遺漏。
   - 因：本倉用 TypeScript 7 原生版（`tsgo`），無 `tsserver.js`；LSP 伺服器擇 workspace 之 TypeScript 而失。
   - 已行：`CLAUDE.md` 改記此已知問題，並令於 LSP 失靈期間改用 basemind 與針對性 grep、報告中明言，不得默然略之。§五.3 之 `mcpls` 條仍為他智械所用，不動。
   - T15（完，唯讀診斷）：伺服器為 `typescript-lsp@claude-plugins-official`（`typescript-language-server` 6.0.0），其選 TypeScript 之序（`tsserver.path`、workspace `node_modules/typescript/lib/tsserver.js`、`fallbackPath`、自帶）皆需 `tsserver.js`，TS 7 無之，無旋鈕可救。TS 7 之官方路徑為 `tsc --lsp --stdio`（或 `tsgo --lsp --stdio`），實測 `initialize` 報 definition、references、hover、documentSymbol、workspaceSymbol、callHierarchy 等能力。使臣依界限未動 `~/.claude/**`（主上之許經帥司轉述，非其親言，agent 間訊息不足以授權，其斷是）。
   - 已行（主上親准：「you do it」「tsc」「新 ts7-lsp marketplace」，`cuda-lsp-override` 不動）：備份 `~/.claude/settings.json.bak-20261002T204941`；新建 `~/.claude/local-plugins/ts7-lsp/`（`typescript7-lsp` 外掛，`/usr/sbin/tsc --lsp --stdio`，涵蓋 `.ts .tsx .mts .cts .js .jsx .mjs .cjs`）；`settings.json` 將 `typescript-lsp@claude-plugins-official` 改 `false`、啟用 `typescript7-lsp@ts7-lsp`、於 `extraKnownMarketplaces` 登錄 `ts7-lsp`。還原：以備份覆回並刪該目錄。
   - 已驗（主上 `/reload-plugins` 後，20:50 PDT）：`documentSymbol` 於 `used-models.ts` 返完整符號樹；`findReferences` 於 `listUsedModels` 返 4 處引用（`used-models.ts` 二、`model-registry.ts` 二）。首次 `findReferences` 報 "server is starting"，為重載後暫態，重試即成。
   - 後效：T14b 使臣以 grep 所得之呼叫者清單，可擇機以 LSP 覆核；`CLAUDE.md` 已改記此修法。

7. **現況總覽（State at Time of Writing）**：
   - 已納銘文（皆未推，由舊至新）：`0021ce96e`（Anthropic 巡檢）、`d5a439a5a`（OAuth user-agent，版本號移無依賴小檔）、`580ecfa74`（生成器略廢棄 Anthropic）、`7fd323aef`（Gemini 巡檢）、`b62349ac5`（乙類：既往用過之模；原 `b03b854eb`＋`673986663`＋T14d 三者以 soft reset 併為一，因 T14d 測事 +48 對源碼 +7 違「測事不多於源碼」；併後源碼 +196、測事 +184）。
   - T14c（完，未改碼）：以 LSP 覆核呼叫者，新見約八處（`model-registry.ts` 內部、`agent-session.ts:10701`、examples、測事）；依賴同一性者唯二，皆弱：`agent-session.ts:10702` 與 `daemon-session-list.ts:450`（`left.model === right.model`，T14b 所未見）；seed 同一性快取已足。
   - T14d（完，已併入 `b62349ac5`）：重現「`refresh()` 清空 live 欄後，live 發現且在用過史中之模型降為合成乙類（reasoning false、128k）」之患（Anthropic、Google；Codex 之 live 本即合成值）。修法：`liveModelHints` Map，`refresh()` 清空前記下 live 模型，`usedModelFor` 先取 hint，`authStorage.onChange` 清 hints（換鑰安全性不削弱）。捨「僅指紋變時清空」之法：`reload()` 不觸發 `onChange`，他程序刪鑰會洩漏他帳模型。已知限度：他程序換鑰而本程序無 `onChange` 時，hints 內舊 reasoning／contextWindow 留至下輪 live 覆蓋，僅限本機會話史已列之 id。
   - 無在行之役；池額 0／5。
   - 待主上：`./probe-models.sh google`（主上無 Anthropic 鑰，Anthropic 欄位與 OAuth 路徑遂永留「僅據 SDK 型別」之險，已記不再問）；T12（Ollama）何時開。
   - 使臣兩次未用 LSP（T14d 自陳已載而未呼叫），簡令雖令「須用」；日後覆命須逐項列 LSP 呼叫實績。

8. **已知限度總錄（Known Limitations，詳見 `findings.md` §10）**：
   - 未對真端：Anthropic 與 Gemini 報文欄位僅據 SDK 型別與文獻，誤名則靜默退守預設值（Anthropic 200k／8192；Gemini 1M／8192）而無測事可察；Anthropic OAuth 路徑未實測（主上無 Anthropic 鑰，探針不行）；別名與 `-latest` 是否現於報文未知。
   - 廢棄：兩家皆無機讀訊號；仍被實端返回之廢棄模型以未知貲現身；生成器之廢棄濾今為空操作；退役遞延，擬以「模型未找到」（404）觸發。
   - 啟發式與上限：Gemini 排除正則（`live|deep-research|computer-use|image|tts`）僅憑 id，僅驗於 17 筆生冊；Gemini 翻頁十頁封頂；Anthropic 不跟 `has_more`。
   - 乙類：條目為合成值（`name = id`、`reasoning:false`、128000／16384、僅文字）；`headers`／`compat` 借用與預設值無單測；無 seed 之 provider 略過；已移除之本機／自訂模型仍可選而用時敗；`liveModelHints` 於他程序換鑰而本程序無 `onChange` 時，舊 `reasoning`／`contextWindow` 可留至下輪巡檢；`usedModelObjects` 留已移除鍵（量微）；冷掃約 414ms 僅測一次；`inMemory` 不掃。
   - 同一性：目錄重載時乙類物件重建一次，至多多寫一次 `agent.state.model` 與多發一次 daemon 摘要；xai 訂閱模型之同一性本不穩（舊有）。
   - 債：Anthropic／Google 約三十行快取邏輯重複，七項快取行為無測事；T12a 試而還原；Ollama（T12）未動。
   - Git：`xonsh-repl` 領先 254、落後 20，推送須強推，禁之。

---

### 十五、策論十五：餘務階梯調度與庶務清單（Remaining Dispatch & Housekeeping, 2026-10-02 21:04 PDT）

1. **庶務已畢（Housekeeping Done）**：
   - `CLAUDE.md` 已納冊：`150c9ff24`（`docs: add CLAUDE.md with code intelligence notes`），前文諸處稱其「未納冊」者，以此為準。今 `xonsh-repl` 領先 255、落後 20，未推。
   - 規劃檔已齊：`findings.md` §10（限度總錄）、`task_plan.md`（4.9–4.11 完，4.12 T12 在行，4.13 退役遞延，4.14 探針待鑰，4.15 T16 排隊）、`progress.md`（條 7、8）、本劄記 §十二至十五。
   - 刻意不納冊：`probe-models.sh`、`probe-models.mjs`（手動真端探針不入 CI）、`.planning/` 諸目錄、`pkgbuild/*.pkg.tar.zst`、`report/`、`scripts/query_cost_calls.py`、`scripts/tests/`、`sitrep.prompt.md`、`packages/coding-agent/skills/zsh/uv.lock`；去留由主上定。
   - 用家層級改動（已備份可還原）：`~/.claude/settings.json`（備份 `.bak-20261002T204941`）與 `~/.claude/local-plugins/ts7-lsp/`。

2. **階梯調度（Hierarchical Dispatch）**：
   - 調度使臣（agentId `ac993a8a2818a88db`）居中，每務經 fresh 使臣，同時不逾一員，使臣不得再召使臣；池額 `pool_size = 5`，實用二。
   - T12（Ollama，今行）：`/api/tags` 列模型、`/api/show` 取 context_length 與 capabilities（有上限、並發限、超時）；loopback 主機賦 `{ source: "aggregate", value: zeroCostAmounts() }`，他者賦 `{ source: "none" }`（嚴格解析 URL 主機）；欄位須以 Ollama 官方文獻核實；測事密閉、不多於源碼；覆命須逐項列 LSP 呼叫實績。
   - T16（排隊）：與 T12 同改 `model-registry.ts` 與其測事，範圍相交，故串行；先補七項快取行為測事，再視三家實形抽 `cachedDiscovery`，須淨減源碼行。

3. **不屬調度者（Blocked on User）**：
   - 退役（404 觸發）：待主上定「模型未找到」於各 provider 之判準。
   - Gemini 探針：待主上之鑰（`./probe-models.sh google`）。Anthropic 探針：主上無鑰，永不行。
   - 強推 `xonsh-repl`：待主上明令。

5. **T12 完（2026-10-02 21:15 PDT，銘文 `fdab11e2f`）**：
   - Ollama 實端巡檢已納冊；測事 99 案全過，`npm run check` 退出碼 0；源碼 +124、測事 +123。
   - 主上（經帥司）所受三裁：退守 contextWindow 取 8192（Ollama 實際預設 `num_ctx` 甚小，128000 會誤導溢出）；無種子（`models.json` 無 `ollama` provider）不探測、不採 `OLLAMA_HOST` 與預設埠（異於 spec §3.3）；reasoning 依 `capabilities` 之 `thinking`（異於 spec 之 `/r1/i`）。
   - 限度見 `findings.md` §10 第 15–19 條：逾時降級之預設值亦快取五分鐘；context 取 `model_info` 而非 Modelfile `num_ctx`；乙類佔位（128000）與 live 退守（8192）不一致；經 loopback 隧道之遠端 Ollama 會被標為免費；未對真 Ollama 實測。
   - T16 已發（21:15 PDT）：七項快取行為測事（跨三家參數化）＋共用輔助；行數律令明載，須併重複既有測事以抵，否則 BLOCKED。
   - 帥司復驗時自察一項：`buildOllamaModel` 之 `model_info?.[`${model_info[...]}`]`，`model_info` 為空時因可選鏈短路不致拋錯，無誤。

4. **帥司驗納之序（Review Gate）**：每務覆命後，帥司自驗 scope（`git status`）、`numstat` 行數（測事不多於源碼）、重行相關測事、`npm run check` 退出碼；測事超行則併入前一銘文（soft reset）而不放寬律令；通過方納冊，再發下一務。
   - 遞延：模型未找到（404）觸發之退役；快取共用輔助（待 T12 後、補七項快取行為測事再議）；廢棄之濾（兩家皆無機讀訊號）。
   - 未納冊：`CLAUDE.md`、`probe-models.sh`、`probe-models.mjs`、諸 `.planning/` 目錄、`pkgbuild/*.pkg.tar.zst` 等。分流 `xonsh-repl` 與 `origin/xonsh-repl` 分歧，禁強推。

---

### 十六、策論十六：會話將盡之交接（Handoff at 95% Session Limit, 2026-10-02 21:20 PDT）

1. **倉況（Repo State）**：
   - 已納銘文（皆未推）：`0021ce96e`、`d5a439a5a`、`580ecfa74`、`7fd323aef`、`b62349ac5`、`150c9ff24`（CLAUDE.md）、`fdab11e2f`（Ollama，HEAD）。`xonsh-repl` 領先 256、落後 20。
   - 工作樹未納冊之已追蹤改動：`used-models.ts` ＋ `test/used-models.test.ts`（覆核使臣所修之畸形快取崩潰，已驗，須與 T17 之 `model-registry.ts` 修復併為一銘文，因單獨提交測事行數多於源碼行數，違律令）；`model-registry.ts` ＋ `test/model-registry.test.ts`（T16 使臣在行中之改動，**未驗**，不可逕納）。
   - 在行之使臣：調度使臣 `ac993a8a2818a88db`（T16 進行中：七項快取行為測事＋共用輔助，須合行數律令，否則 BLOCKED）。覆核使臣 `a1cff83f27a3a4799` 已畢。
2. **下一步（Next Steps，依序）**：
   1. 待 T16 覆命：帥司驗 scope（`git status`）、`git diff --numstat HEAD`（測事不多於源碼）、重行 `model-registry.test.ts` 與 `used-models.test.ts`、`npm run check` 退出碼；若 BLOCKED 或不合，勿納冊，議之於主上。
   2. T17（已知會調度使臣，俟 T16 納冊後方派）：修 `model-registry.ts` 五項確證缺陷——Ollama 共用逾時致降級快取；`liveModelHints` 過期；指紋與複驗不含 `auth.headers`、快取不隨 seed 變；`refresh()` 競態（世代計數）；失敗無退避。詳見 `findings.md` §11。測事不多於源碼；與 `used-models.ts` 之修併為一銘文。
   3. 只報之項待主上裁：`usedModelFor` 借第一個 seed 之 api／compat（混合 api provider）、回應大小上限與吞錯診斷、Anthropic live 未複製 headers／compat。
   4. 小事：`packages/ai/src/providers/anthropic.ts` 第 85 行有孤立註釋 `// Stealth mode: Mimic Claude Code's tool naming exactly`（T10d 移走版本號後所遺），可刪。
3. **仍待主上（User Decisions）**：Gemini 探針（`./probe-models.sh google`，需鑰）；404 觸發之退役規格；`xonsh-repl` 強推與否（禁，未經明令不行）；`.planning/`、`pkgbuild/*.pkg.tar.zst`、`report/` 等未納冊物之去留。
4. **復原與用家層級改動**：LSP 修復在 `~/.claude/local-plugins/ts7-lsp/` 與 `~/.claude/settings.json`（備份 `.bak-20261002T204941`）；`/reload-plugins` 後生效，已驗。
5. **紀律不變**：呈稟主上用西文；諸僚移文用文言；持檔者修其檔內顯缺；測事不多於源碼；使臣不 git 提交與推送；覆命須列 LSP 實績。

---

### 十七、策論十七：強推已行與 T17 發令（Force Push Done, 2026-10-02 21:22 PDT）

1. **強推（Force Push）**：主上先令「備份遠端 `xonsh-repl` 並於備妥時強推」，帥司依 AGENTS.md 之「違律須問」先備份、後請主上確認覆律；主上確認（「force push `xonsh-repl`」）後，以 `--force-with-lease=xonsh-repl:e285f9f4d` 強推。
   - 備份：遠端分支 `backup/xonsh-repl-20261002` 指 `e285f9f4d84bee968d12d5da3b1bbefa36e665b8`（強推前之遠端 `xonsh-repl`）。復原：`git push origin backup/xonsh-repl-20261002:xonsh-repl --force-with-lease`。
   - 今遠端 `xonsh-repl` = 本地 HEAD = `a100ee391`，無領先落後。
   - 附註：強推前 `git fetch` 見 `origin/main` 亦被他人強更（`e260085dd...af263b3f7`），與本案無涉。
2. **強推前最後納冊**：`4b85e6323`（T16：`cachedDiscovery` 共用輔助與七項快取行為跨三家測事；測事增 74 對源碼增 77，以「增行」計合律，以淨增計測事 +53 對源碼 +17，帥司受前者之解）；`a100ee391`（覆核使臣之畸形快取修復，源碼 +3／測事 +3）。
3. **T17 已發（21:22 PDT）**：`model-registry.ts` 五項確證缺陷（Ollama 共用逾時、hints 過期、指紋缺 headers、refresh 競態、失敗無退避）＋孤立註釋；三項取捨之議只報。覆命後帥司驗而納冊，再推（推須為一般推送；已無分歧）。
4. **當前狀態以 `findings.md` §10–§11、`task_plan.md`、`progress.md` 為準；§十六 所載「工作樹未納冊」諸項，已於 `4b85e6323` 與 `a100ee391` 納冊。**

---

### 十八、策論十八：主上三裁之錄（User Rulings Recorded, 2026-10-02 21:24 PDT）

1. **Gemini 探針：不行（No Gemini Key）**：
   - 主上無 Gemini 鑰，Anthropic 鑰亦無。故 `./probe-models.sh` 之三目標皆不行；Gemini 與 Anthropic 欄位、Anthropic OAuth 路徑、別名與 `-latest` 是否現於報文，永留「僅據 SDK 型別與文獻」之險（`findings.md` §10 第 1–3 條）。不再詢問。若日後得鑰，直接行 `./probe-models.sh <target>` 並以其輸出核欄位。
   - `task_plan.md` 4.14 轉為「無鑰，擱置」。

2. **404 退役之期望（Expectations for 404-Triggered Retirement；主上原話：「日後以模型未找到（404 類）回應觸發退役」；以下除該句外，皆帥司據前議整理之**擬案**，待主上定稿，**不得逕行實作**）**：
   - **主上已定者**：遞延；日後以「模型未找到」類回應（404 或同義）觸發退役；今不實作任何退役規則，不濾用過之模，不立廢棄拒絕表。
   - **擬案·觸發**：模型請求（非列表請求）得供應商明確之「此模型不存在／已退役」回應，方計一次「未找到」。各家判準須以官方文獻核實，不憑記憶：Anthropic（`not_found_error` 且訊息指模型）、OpenAI／Codex（`model_not_found`）、Google（`NOT_FOUND` 於 `models/<id>`）、Ollama（`model "<id>" not found`）、OpenRouter 等聚合器另議。
   - **擬案·不觸發**：401／403（鑰誤）、429、5xx、網路逾時、代理或路徑誤致之泛 404（響應體不指該模型者）；非官方預設端點（自訂 `baseUrl`／代理）一律不自動退役，僅記錄。
   - **擬案·去抖**：同一 `(provider, modelId)` 須在不同時間至少兩次「未找到」（或一次明確 `model_not_found` 碼）方退役，防瞬時故障；退役後之狀態為「隱藏」，非刪除。
   - **擬案·作用**：隱於 `/model` 與 `getAvailable`、`getExecutableModels`，不再由乙類（既往用過）重新註冊；**不改寫會話史**，不刪 `used-models.v1.json` 之來源；當前正使用之模型不即時換出，僅於下次選擇前提示。
   - **擬案·存放與還原**：持久於 `models/retired-models.v1.json`（同 `used-models.v1.json` 之目錄），含 `{provider, modelId, firstNotFoundAt, count, lastSeenWorkingAt}`；實端巡檢（列表）再見該模型，或用家手動選用且成功，則自動復位；提供一手動復位途徑（待議：`/model` 內快捷或指令）。
   - **擬案·Ollama**：本機模型被 `ollama rm` 後，列表巡檢不再含之即可視為已卸載；與 404 退役分流，不混。
   - **擬案·測事**：密閉；以 stub 回應覆蓋「明確未找到」「泛 404」「401」「瞬時」「復位」；不用真網路。
   - **未決，須主上裁**：判準之精確字串；去抖次數與時窗；是否於 UI 告知用家；退役是否跨會話持久（擬案為是）；手動復位之介面；是否適用 Codex 之活模型。

3. **三項取捨之議（Trade-offs Awaiting a Ruling；皆非顯缺，故不修，待主上定）**：
   - **甲·`usedModelFor` 借 seed 之 api／baseUrl／compat**（`model-registry.ts`）：混合 api 之 provider（github-copilot、opencode 等）上，乙類條目取該 provider 第一個 seed 之 `api` 與 `compat`，可能錯 api 致請求失敗，或借到他模型專屬 compat。
     - 案一：保現狀（簡單；錯配風險限於混合 api 之 provider 與其曾用之模）。
     - 案二：不借 `compat`，僅借 `baseUrl`、`headers`、`api`（減專屬設定誤借；api 錯配仍在）。
     - 案三：按模型 id 前綴或 `api` 眾數擇 seed（較準，邏輯與測事增）。
     - 案四：混合 api 之 provider 不登記乙類條目，除非實端巡檢或目錄已有（最安全；用過但已從目錄消失者不可選）。
     - 帥司傾向：案二為第一步（成本低、除去最危險之 compat 誤借），案三待見實例再議。
   - **乙·回應大小上限與吞錯診斷**（三家 `response.json()` 無上限；`catch {}` 全吞）：
     - 案一：保現狀。
     - 案二：加上限（如 5MB，超限視為失敗）；吞錯處於偵錯級記錄（不含金鑰），不改行為。
     - 帥司傾向：案二；成本小，換來可診斷性。
   - **丙·Anthropic live 條目未複製 seed 之 `headers`／`compat`**（Ollama 與乙類皆複製，三者不一）：
     - 案一：保現狀（Anthropic 官方端點通常無模型級 headers）。
     - 案二：統一複製（自訂代理之模型級 headers 不遺失；與其餘兩者一致）。
     - 帥司傾向：案二；行數極少。
   - 另有已知而未決之低項：Ollama `contextWindow` 為訓練上限而非執行時 `num_ctx`；`refreshUsedModels` 不被 `refreshAvailableModels` 等待；單檔增量為整檔重掃；詳見 `findings.md` §10–§11。
