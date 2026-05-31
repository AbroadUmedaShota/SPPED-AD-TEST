# バグ報告DB GAS

`reports.html` から Google Spreadsheet へ、代表不具合ケース、観測、証跡メタ情報、トリアージ履歴を保存するための Apps Script Web App です。

## 前提

- Spreadsheet: `SPEED AD バグ報告DB`
- 必須タブ: `defect_cases`, `defect_observations`, `defect_evidence`, `triage_events`
- Spreadsheet ID は Script Property `SPREADSHEET_ID` に設定します。未設定のまま初回実行した場合は、GASが `SPEED AD バグ報告DB` を自動作成して `SPREADSHEET_ID` に保存します。
- 画像、動画、ログなどのbinary添付はSpreadsheetに保存しません。Drive、Backlog、ローカル証跡へのURLまたはパスだけを `defect_evidence` に保存します。
- Web App は `executeAs: USER_DEPLOYING` / `access: ANYONE_ANONYMOUS` で配備します。URLを知っている利用者が書き込めるため、URLは内部運用向けとして扱います。

## clasp配備手順

```powershell
npx --yes @google/clasp login
npx --yes @google/clasp create --title "SPEED AD バグ報告DB" --type standalone
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy --description "bug reporting db web app"
```

Spreadsheet ID を設定します。

```powershell
npx --yes @google/clasp run setSpreadsheetId --params '["<spreadsheetId>"]'
```

`clasp run` で権限エラーになる場合は、Apps ScriptエディタのProject SettingsからScript Propertiesへ `SPREADSHEET_ID` を手動設定してください。

SpreadsheetをGAS側で自動作成する場合は、初回に次を実行します。

```powershell
npx --yes @google/clasp run initializeDefectDb
```

戻り値の `spreadsheetUrl` を控え、Web App URLは `reports.html` の「GAS Web App URL」に設定します。

## API

- `GET ?resource=defect_cases|defect_observations|defect_evidence|triage_events`
- `POST { action: "appendObservation", payload: { observation: {...}, evidence: [...] } }`
- `POST { action: "promoteObservationToCase", payload: { observation_id, case: {...}, actor_role } }`
- `POST { action: "linkBacklogIssue", payload: { case_id, backlog_key, actor_role } }`
- `POST { action: "mergeCases", payload: { source_case_id, target_case_id, note, actor_role } }`
- `POST { action: "appendTriageEvent", payload: { event: {...} } }`

GET は JSONP の `callback` パラメータに対応します。POST は GAS の CORS 制約を避けるため `text/plain` で送信し、フロント側では送信後に再読み込みして結果を確認します。

## AI観測の扱い

- `source_type=ai` の observation は `verification_status=unverified` に固定します。
- AI観測だけではBacklog本文生成対象にしません。
- 人間確認後は、別途人間の confirmed observation を追加するか、既存観測の確認状態を運用上更新してから代表ケースへ紐づけます。
