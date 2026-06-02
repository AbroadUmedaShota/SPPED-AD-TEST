# バグ報告DB GAS

`reports.html` から Google Spreadsheet へ、代表不具合ケース、観測、証跡メタ情報、トリアージ履歴を保存するための Apps Script Web App です。

## 前提

- Spreadsheet: `SPEED AD E2Eシナリオ実行管理`（本モックで使用する共有モックDB）
- 共有モックDB Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`
- 必須タブ: `defect_cases`, `defect_observations`, `defect_evidence`, `triage_events`
- 既定のSpreadsheet IDは `Code.gs` の `DEFAULT_SPREADSHEET_ID` に定義します。
- 別のSpreadsheetへ向ける場合は Script Property `SPREADSHEET_ID` に設定します。
- 画像、動画、ログなどのbinary添付はSpreadsheetに保存しません。Drive、Backlog、ローカル証跡へのURLまたはパスだけを `defect_evidence` に保存します。
- Web App は `executeAs: USER_DEPLOYING` / `access: ANYONE_ANONYMOUS` で配備します。URLを知っている利用者が書き込めるため、URLは内部運用向けとして扱います。

## clasp配備手順

通常運用では既存E2E GASの共用Web Appを使います。共用側のコードは `99_backend-docs/08_e2e-testing/gas/Code.gs` にあり、既存E2E APIに `defect_*` リソースを追加しています。

このディレクトリは、将来バグ報告DBを専用GASへ分離する場合のコード置き場です。専用GASを作る場合は次の手順です。

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

タブ初期化を行う場合は、初回に次を実行します。

```powershell
npx --yes @google/clasp run initializeDefectDb
```

戻り値の `spreadsheetUrl` を控え、Web App URLは `reports.html` の「GAS Web App URL」に設定します。

## API

- `GET ?resource=defect_cases|defect_observations|defect_evidence|triage_events`
- `POST { action: "appendObservation", payload: { observation: {...}, evidence: [...] } }`
- `POST { action: "promoteObservationToCase", payload: { observation_id, case: {...}, actor_role } }`
- `POST { action: "linkObservationToCase", payload: { observation_id, case_id, verification_status, actor_role } }`
- `POST { action: "linkBacklogIssue", payload: { case_id, backlog_key, actor_role } }`
- `POST { action: "mergeCases", payload: { source_case_id, target_case_id, note, actor_role } }`
- `POST { action: "appendTriageEvent", payload: { event: {...} } }`

GET は JSONP の `callback` パラメータに対応します。POST は GAS の CORS 制約を避けるため `text/plain` で送信し、フロント側では送信後に再読み込みして結果を確認します。

## 投稿フォーム由来 observation

`02_dashboard/bug-report.html` からの投稿は `appendObservation` で `defect_observations` に保存します。共有DBに入れるのは重複判定に必要な匿名化情報のみです。

- 追加列: `report_type`, `category`, `environment`, `screen`, `questionnaire_ref`, `summary`, `reproduction_steps`, `expected`, `actual`, `affected_module`, `severity`, `dedupe_key`, `source_ref`
- `source_type=human`, `source_role=user_submission`, `verification_status=unverified` で受け付けます。
- 氏名、メールアドレス、会社名、社内メモ、担当者候補、スクリーンショットData URIは保存しません。
- `linkObservationToCase` は管理者が未紐づけ投稿を既存代表ケースへ紐づけるための操作です。自動重複確定には使いません。

## AI観測の扱い

- `source_type=ai` の observation は `verification_status=unverified` に固定します。
- AI観測だけではBacklog本文生成対象にしません。
- 人間確認後は、別途人間の confirmed observation を追加するか、既存観測の確認状態を運用上更新してから代表ケースへ紐づけます。
