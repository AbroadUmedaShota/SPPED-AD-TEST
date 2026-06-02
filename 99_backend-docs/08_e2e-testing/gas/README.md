# SPEED AD共有モックDB GAS

`index.html`、`scenarios.html`、`../09_bug-reporting/reports.html` からGoogle Spreadsheetへ読み書きするためのApps Script Web Appです。v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。

## 前提

- Spreadsheet: `SPEED AD E2Eシナリオ実行管理`
- E2E必須タブ: `e2e_cases`, `scenarios`, `scenario_steps`, `scenario_runs`, `scenario_step_results`
- バグ報告必須タブ: `defect_cases`, `defect_observations`, `defect_evidence`, `triage_events`
- 既定のSpreadsheet IDは `Code.gs` の `DEFAULT_SPREADSHEET_ID` に定義する。
- 別のSpreadsheetへ向ける場合はScript Property `SPREADSHEET_ID` を設定する。
- Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`

## clasp配備手順

1. Apps Script APIを有効化する。
   - https://script.google.com/home/usersettings
2. このディレクトリで `clasp` を実行する。

```powershell
npx --yes @google/clasp login
npx --yes @google/clasp create --title "SPEED AD E2Eシナリオ実行管理" --type standalone
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy --description "scenario e2e web app"
```

3. 別のSpreadsheetへ向ける場合は、`SPREADSHEET_ID` をScript Propertiesに設定する。

```powershell
npx --yes @google/clasp run setSpreadsheetId --params '["<spreadsheetId>"]'
```

`clasp run` で権限エラーになる場合は、プロジェクトスコープを含めて再ログインするか、Apps ScriptエディタのProject SettingsでScript Propertiesを手動設定する。

```powershell
npx --yes @google/clasp login --use-project-scopes --include-clasp-scopes
```

4. Web App URLを `index.html`、`scenarios.html`、または `../09_bug-reporting/reports.html` の「GAS Web App URL」に入力する。

## API

- `GET ?resource=e2e_cases|scenarios|scenario_steps|scenario_runs|scenario_step_results`
- `GET ?resource=defect_cases|defect_observations|defect_evidence|triage_events`
- `POST { action: "replaceE2eCaseMasters", payload: { cases: [...] } }`
- `POST { action: "createScenarioRun", payload: {...} }`
- `POST { action: "upsertScenarioStepResult", payload: { results: [...] } }`
- `POST { action: "replaceScenarioMasters", payload: { scenarios: [...], steps: [...] } }`
- `POST { action: "appendObservation", payload: { observation: {...}, evidence: [...] } }`
- `POST { action: "promoteObservationToCase", payload: { observation_id, case: {...}, actor_role } }`
- `POST { action: "linkObservationToCase", payload: { observation_id, case_id, verification_status, actor_role } }`
- `POST { action: "linkBacklogIssue", payload: { case_id, backlog_key, actor_role } }`
- `POST { action: "mergeCases", payload: { source_case_id, target_case_id, note, actor_role } }`
- `POST { action: "appendTriageEvent", payload: { event: {...} } }`

GETはJSONPの `callback` パラメータに対応します。POSTはGASのCORS制約を避けるため `text/plain` で送信します。

## e2e_cases タブ

`index.html` の画面別E2Eケース一覧は、接続時に `e2e_cases` からケースマスタを取得します。未接続または取得失敗時はページ内の埋め込みケースを表示します。

主な列:

- `case_id`
- `group`
- `screen`
- `route`
- `title`
- `preconditions`
- `steps`
- `expected`
- `priority`
- `side_effect`
- `evidence`
- `parent_case_id`
- `data_source`
- `note`
- `active`

## defect_observations の匿名化投稿列

投稿フォーム由来の observation は、既存の基本列に加えて以下を使用します。

- `report_type`
- `category`
- `environment`
- `screen`
- `questionnaire_ref`
- `summary`
- `reproduction_steps`
- `expected`
- `actual`
- `affected_module`
- `severity`
- `dedupe_key`
- `source_ref`

氏名、メールアドレス、会社名、社内メモ、担当者候補、スクリーンショットData URIはこの共有DBへ保存しません。
