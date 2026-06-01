# E2Eテスト

SPEED AD の主要業務フローを、どの利用者導線で検証するかを整理する資料です。

現状は静的モック開発フェーズのため、品質確認は手動テスト中心です。このカテゴリでは、将来のPlaywright/Cypress等による自動化を前提に、E2E化しやすい確認観点、前提データ、未確認事項を整理します。

- `index.html`: 画面別の細目E2Eケース一覧。`e2e_cases` タブからケースマスタを同期し、未接続時は埋め込みデータで閲覧します。
- `scenarios.html`: stg通し実行シナリオとSpreadsheet/GAS結果管理。シナリオは業務ライフサイクルのフェーズとロールで整理します。
- `gas/`: 本モックで使用する共有モックDB用のApps Script Web Appコード。E2Eケース、E2Eシナリオ管理、バグ報告DBを扱います。

## シナリオマスタ更新手順

`scenario-data.js` をシナリオマスタの正本として扱います。既存の `scenario_id` / `step_id` はPlaywrightの注釈や実行結果キーから参照されるため、削除や採番変更をせず、追加時は未使用のIDを採番します。`STG-SCN-032` はLv4候補として保留し、回答送信からデータ受け取りまでの追加シナリオは `STG-SCN-033` 以降を使います。

共有Spreadsheetへ反映する場合は、実行前に `scenarios` と `scenario_steps` をGETしてローカルへバックアップします。その後、Node VMなどで `scenario-data.js` を評価し、`{ action: "replaceScenarioMasters", payload: { scenarios, steps } }` をGAS Web AppへPOSTします。POST後はGETで再取得し、ローカル定義と件数、ID集合、代表タイトルが一致することを確認します。

ローカル確認では以下を実行します。

```powershell
node --test tests/e2e/scenario-data-integrity.test.mjs
git diff --check -- 99_backend-docs/08_e2e-testing tests/e2e/scenario-data-integrity.test.mjs
```

実stgで回答送信、CSVアップロード、メール送信など副作用を伴う操作は、このマスタ同期とは別作業として許可範囲を確認してから実行します。回答送信からデータ化データ受け取りまでの実stg通し確認は GitHub Issue #311 で扱います。
