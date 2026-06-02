# バグ報告DB

人間の報告とAIエージェントの調査結果を、Backlog起票前に同じ受付DBで整理するための資料です。

v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。Apps Script Web AppはE2Eシナリオ管理とバグ報告DBの両方を受け持ちます。Backlogは修正・調査を進める代表課題であり、受付・観測・重複整理の正本は共有モックDB側に置きます。

GASが未設定、またはGoogle Workspace側でOAuthがブロックされている場合でも、`reports.html` はブラウザ内DB（localStorage）でそのまま利用できます。ローカルDBで登録した内容はJSONコピーで退避し、必要に応じて共有モックDBへ移行します。

- `index.html`: 仕様・運用資料の閲覧ビュー。
- `reports.html`: 受付DBの一覧、未紐づけ投稿キュー、観測登録、代表ケース化、Backlog本文コピー用の管理ページ。
- `gas/`: Spreadsheetを受付DBとして扱うApps Script Web Appコード。

## 現在の利用手順

1. `reports.html` を開く。
2. GAS URL欄には共有モックDBのWeb App URLが初期設定される。
3. Google Workspace/OAuthの影響でGASに接続できない場合、またはローカル検証だけにしたい場合は、URL欄を空にして保存する。
4. 投稿フォームから送られた匿名化投稿は `未紐づけ投稿` に表示される。
5. 未紐づけ投稿を選び、候補代表ケースを確認する。
6. 同一不具合なら `既存ケースへ紐づけ`、新規なら `代表ケースへ昇格`、判断済みだが保留なら `確認済みにする` を押す。
7. 手動登録が必要な場合は `observationを保存` で人間報告またはAI観測を登録する。
8. 代表ケースを選び、`Backlog本文をコピー` で起票文を作る。
9. `JSON` ボタンでローカルDB内容をクリップボードへ退避できる。

## 投稿フォーム連携

- `02_dashboard/bug-report.html` はGoogle Formsではなく、共有GAS受付DBの `appendObservation` へ送信する。
- クライアントで `observation_id` を生成し、POST後にJSONP GETで同じIDの保存を確認する。
- 共有DBへ保存するのは重複判定に必要な匿名化情報だけとする。
- 氏名、メールアドレス、会社名、社内メモ、担当者候補、スクリーンショットData URIは `defect_observations` に入れない。
- スクリーンショット本体の保管は今回対象外。必要時はDrive/S3等の非公開ストレージを別途設計する。

## Google Forms CSV一回取込

既存Google Forms回答分は自動同期しない。CSVを一回だけ取り込み、匿名化後の `appendObservation` ペイロードとして投入する。

```powershell
node scripts/import-bug-report-form-csv.mjs --csv .\forms.csv --dry-run
node scripts/import-bug-report-form-csv.mjs --csv .\forms.csv --gas-url "https://script.google.com/macros/s/.../exec"
```

- `--dry-run` で件数、欠落列、破棄されるPII列、サンプルペイロードを確認する。
- 実投入時は `--gas-url` が必須。
- CSVパースは `csv-parse` を使用し、quoted/multilineセルに対応する。

## GAS作成状況

- Apps Script project: `SPEED AD バグ報告DB`
- Script ID: `1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb`
- 専用Web App deployment候補: `AKfycbwn_0ROYUKCZ5ptrvSsGSIEcNRnShbGaZiINRJbb0c487G005vLlGkpA2TKP0FeHFEC5Q`
- 現状: 専用GASはGoogle Workspace/OAuth側のアクセスブロックにより疎通未完了。
- 本モックDB: `SPEED AD E2Eシナリオ実行管理` Spreadsheet
- Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`
- 運用: 既存E2E GASへ `defect_*` リソースを追加し、E2Eシナリオ管理とバグ報告受付DBを同じ共有モックDBで扱う。

## 扱い

- 1不具合1代表ケースを基本とし、複数人の報告やAI観測は `defect_observations` に蓄積します。
- 投稿フォーム由来の未紐づけ observation は、自動で既存ケースへ確定しません。管理者が候補を見て手動で紐づけます。
- AIエージェントの結果は初期状態で `unverified` とし、人間確認済みになるまでBacklog本文生成対象にしません。
- 共有リポジトリ、DB、Backlogテンプレートには、個人名、メールアドレス、実トークン、非共有の社内判断を書きません。
