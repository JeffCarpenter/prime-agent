# Findings: 策檢基準擇取

## Evidence

- 原 `resolveBase` 優取 `origin/main` 之 merge-base `a9b5d88b50d`；此枝實據 `upstream/main` `e260085dd8`，HEAD 其後五十二提交。
- 原策檢誣報六十八檔二百六十條；所報 blob 皆與 `upstream/main` 同。明定 `TEST_POLICY_BASE=upstream/main` 則過。
- `.github/workflows/ci.yml` 同跑 `push main` 與 `pull_request`；若 push 以 `origin/main=HEAD` 作基準，既提交之新違規不入 diff。

## Decisions

- `TEST_POLICY_BASE` 優先；驗 commit 且為 HEAD 祖，無效報錯。明定 HEAD 可作基準，但不查其既存違規。
- CI push 取 `GITHUB_EVENT_PATH` 之 `before`，須為 HEAD 嚴祖；force push 等非祖情形閉拒。
- CI PR 取 `origin/GITHUB_BASE_REF` 與 HEAD 之 merge-base；缺目標或共祖則報錯。
- 本地於 `origin/main`、`upstream/main` 之 HEAD 祖擇最近者，同 HEAD 亦可；皆無則報錯，不暗退 `HEAD^`。

## Verification

- `scripts/check-test-policy.test.mjs` 以臨時 Git 倉驗近祖、staged 新違規及多提交 push；舊版首案敗，改後過；刻意改推送基準為 `HEAD^`，測能捉漏檢。
- 另以臨時倉探 PR 目標、明定祖先、無效明定、無效 push `before`、無遠端基準；結果如期。
- `node --test scripts/check-test-policy.test.mjs`、`npm run check:test-policy`、`npm run check` 皆過；提交鉤再行全檢亦過。
- 提交 `4f108832b` 僅含策檢腳本與回歸測；`pkgbuild/.SRCINFO` 原 staged 仍在，未入提交。

## Remaining Limits

- 明定 `TEST_POLICY_BASE=HEAD` 僅查工作樹、暫存及未追檔；不查 HEAD 既存違規。
- force push 之 `before` 若非祖先，保守報錯，須另定可信基準；不自動放行。
