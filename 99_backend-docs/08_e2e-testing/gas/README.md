# SPEED AD共有モックDB GAS

`scenarios.html` と `../09_bug-reporting/reports.html` からGoogle Spreadsheetへ読み書きするためのApps Script Web Appです。v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。

## 前提

- Spreadsheet: `SPEED AD E2Eシナリオ実行管理`
- E2E必須タブ: `scenarios`, `scenario_steps`, `scenario_runs`, `scenario_step_results`
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

4. Web App URLを `scenarios.html` または `../09_bug-reporting/reports.html` の「GAS Web App URL」に入力する。

## API

- `GET ?resource=scenarios|scenario_steps|scenario_runs|scenario_step_results`
- `GET ?resource=defect_cases|defect_observations|defect_evidence|triage_events`
- `POST { action: "createScenarioRun", payload: {...} }`
- `POST { action: "upsertScenarioStepResult", payload: { results: [...] } }`
- `POST { action: "replaceScenarioMasters", payload: { scenarios: [...], steps: [...] } }`
- `POST { action: "appendObservation", payload: { observation: {...}, evidence: [...] } }`
- `POST { action: "promoteObservationToCase", payload: { observation_id, case: {...}, actor_role } }`
- `POST { action: "linkBacklogIssue", payload: { case_id, backlog_key, actor_role } }`
- `POST { action: "mergeCases", payload: { source_case_id, target_case_id, note, actor_role } }`
- `POST { action: "appendTriageEvent", payload: { event: {...} } }`

GETはJSONPの `callback` パラメータに対応します。POSTはGASのCORS制約を避けるため `text/plain` で送信します。
