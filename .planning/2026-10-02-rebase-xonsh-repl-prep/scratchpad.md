# 思維劄記：`xonsh-repl` 變基於 `xonsh-installer` 籌策

夫欲變基（rebase）`xonsh-repl` 於 `xonsh-installer` 之上，首當審其脈絡、度其機變、防其傾覆。今列諸端於下：

---

### 一、諸枝拓撲與淵源（Branch Topology & Lineage）

1. **`xonsh-repl` 枝（commit `4cf70771b`）**：
   - 乃自 `stable-prime`（commit `987effdd8`，本於 `v0.9.5`）分流而出。
   - 凡二十四策（commits），悉為 xonsh 原生 REPL 構建、SDK 聯測與 `context7` 技能之功。

2. **`xonsh-installer-port` 枝（commit `7fa656118`）**：
   - 先前已重基於上游 `upstream`（tag `v0.9.6`，commit `e260085dd`）。
   - 案其史冊，此枝**已盡數融攝** `xonsh-repl` 前開二十四策（自 `084d70d7a` 至 `7c860aa85`）。
   - 復於其頂綴補安裝器五策（commits `df4b12f85` 迄 `7fa656118`，涉 `scripts/install.xsh`、測試及 Arch PKGBUILD）。

3. **倒懸之勢**：
   - 現行之序乃：`v0.9.6` ─→ `xonsh-repl`（已換基者） ─→ `installer-port`。
   - 主令曰「以 `xonsh-installer` 為基而重置 `xonsh-repl`」，若欲使安裝器居下而 REPL 居上，則須顛倒現有層疊（stack inversion）；若僅欲使 REPL 採納新版安裝器，則形勢又有不同。

---

### 二、工作區之虞（Worktree Hazards）

1. **同袍遺緒未靖**：
   - 當前工作區留存三十八件變更案卷（modified files），悉涉模型目次（`model-catalog`）、推論定價（`cache-pricing`）諸役；另有探勘文檔數件尚未納編（untracked）。
2. **訓條森嚴（AGENTS.md）**：
   - 嚴誡諸吏妄動 `git stash`、`git checkout .` 及 `git reset --hard`，防並行諸役之功盡泯。
   - 倘逕於此處切換枝柯（`git checkout`）或舉變基之斧，Git 必見拒，且生侵凌遺棄之害。
3. **隔離立界**：
   - 勢必增設獨立工作區（`git worktree add`）於旁舍，方可施展手腳，不犯正室纖毫。

---

### 三、籌策三端（Available Strategies）

- **策一：翻轉層疊，正位重基（Stack Inversion）**
  - **體制**：`v0.9.6` ─→ `xonsh-installer` ─→ `xonsh-repl`。
  - **施為**：
    1. 自 `v0.9.6`（或 `8709d1ac5`）另闢純粹之 `xonsh-installer` 枝。
    2. 孤立摘取（cherry-pick）安裝器之五策（`df4b12f85`..`7fa656118`）於其上。
    3. 取 `xonsh-repl` 原始二十四策重基於該枝之顛。
  - **難處**：安裝器後段（如 `534f6fd6c`）已含調和 REPL 代碼之功，抽離先置恐致衝突，須加勘驗。

- **策二：順水推舟，指認新基（Fast-Forward / Direct Rebase）**
  - **體制**：`xonsh-installer-port` 既已居 `v0.9.6` 且包容 REPL 全體，若僅需使 `xonsh-repl` 獲取安裝器支援，直將 `xonsh-repl` 推進至 `7fa656118` 即可，免卻重編之苦。

- **策三：截斷分流，各安其位（Decoupled Sync）**
  - 將 `xonsh-repl` 推進至 `7c860aa85`（純 REPL 遷至 `v0.9.6` 之末點），而留安裝器於獨立枝，互不相侵。

---

### 四、施行方略（Execution Steps）

1. **立舍（Worktree）**：
   於鄰室辟淨室：`git worktree add ../prime-agent-rebase xonsh-repl`。
2. **勘界（Verification）**：
   入淨室驗明干戈，核實 `git status` 毫無瑕疵。
3. **依令行事（Execution）**：
   俟主點定策一或策二，依法施行 `git rebase` 或 `git cherry-pick`。
4. **驗校（Verification & Check）**：
   行 `npm run check`，務使無咎。
