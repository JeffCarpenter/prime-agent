# Task Plan: 策檢基準擇取

## Goal

修 `scripts/check-test-policy.mjs` 基準誤取，既有違規勿誣報，新違規勿漏檢。

## Next Step

無；修、驗、提交俱畢。後若另有所命，另立階段。

## Current Phase

Phase 4（已畢）

## Phases

### Phase 1: 究因
- [x] 覈 `origin/main` 分歧、`upstream/main` 祖先與 CI push／PR 語義。
- **Status:** complete

### Phase 2: 定策
- [x] 明定、push、PR、本地各擇基準；無基閉拒。
- **Status:** complete

### Phase 3: 施修
- [x] 修 `scripts/check-test-policy.mjs`；增 `scripts/check-test-policy.test.mjs` 臨時 Git 倉回歸測。
- **Status:** complete

### Phase 4: 驗交
- [x] 舊版回歸測敗，改後過；定向策檢與 `npm run check` 俱過。
- [x] 以僅含二檔之提交 `4f108832b` 交付；旁檔未入。
- **Status:** complete

## Decisions Made

| 決 | 故 |
|----|----|
| 本地取距 HEAD 最近之 main 祖先 | 避分歧 `origin/main` 之舊 merge-base 誣報。 |
| CI push 取事件 `before` 嚴祖 | `origin/main=HEAD` 時仍查所推諸提交。 |
| CI PR 取目標枝 merge-base | 依目標而非臆取 main。 |
| 無效基準報錯，不退 `HEAD^` | 勿默然漏檢。 |

## Errors Encountered

| 誤 | 處 |
|----|----|
| 舊版於臨時倉回歸測誣報既存 `.skip` | 改本地擇基，測轉過。 |
| 首寫 `scratchpad.yaml` 少一映射鍵，YAML 剖析敗 | 補鍵 `舊法`，重驗已過。 |
