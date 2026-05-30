# E2Eシナリオ実行管理 GAS

`scenarios.html` からGoogle Spreadsheetへシナリオ実行回とステップ結果を保存するためのApps Script Web Appです。

## 前提

- Spreadsheet: `SPEED AD E2Eシナリオ実行管理`
- 必須タブ: `scenarios`, `scenario_steps`, `scenario_runs`, `scenario_step_results`
- 既定のSpreadsheet IDは `Code.gs` の `DEFAULT_SPREADSHEET_ID` に定義する。
- 別のSpreadsheetへ向ける場合はScript Property `SPREADSHEET_ID` を設定する。

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

4. Web App URLを `scenarios.html` の「GAS Web App URL」に入力する。

## API

- `GET ?resource=scenarios|scenario_steps|scenario_runs|scenario_step_results`
- `POST { action: "createScenarioRun", payload: {...} }`
- `POST { action: "upsertScenarioStepResult", payload: { results: [...] } }`
- `POST { action: "replaceScenarioMasters", payload: { scenarios: [...], steps: [...] } }`

GETはJSONPの `callback` パラメータに対応します。POSTはGASのCORS制約を避けるため `text/plain` で送信します。
