# 試務計畫

## 所求
二測檔除時延輪詢；以確定事件代之，守原測義。

## 成果
1. 察基線、定事件 — 畢
2. 改二測 — 畢
3. 緊 diff，守測線額 — 畢
4. 全測、策檢、型檢、差檢 — 畢
5. 多 seed 測、終審 — 畢
6. 用戶請 commit — pre-commit 因他檔全域策告警而阻

## 次舉
待用戶定：授權改他檔以清策警，抑或維持不 commit；不可繞鉤。

## 決
| 決 | 故 |
|---|---|
| 限兩測檔改動 | 守授權界，存他檔舊污 |
| protocol、usage append、activity waiter 註冊後 signal | 不以時延作 readiness |
| timeout 僅敗界 | 不以 timeout 使測試通過 |
