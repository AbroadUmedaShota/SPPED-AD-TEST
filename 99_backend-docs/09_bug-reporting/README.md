# バグ報告DB

人間の報告とAIエージェントの調査結果を、Backlog起票前に同じ受付DBで整理するための資料です。

v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。Apps Script Web AppはE2Eシナリオ管理とバグ報告DBの両方を受け持ちます。Backlogは修正・調査を進める代表課題であり、受付・観測・重複整理の正本は共有モックDB側に置きます。

GASが未設定、またはGoogle Workspace側でOAuthがブロックされている場合でも、`reports.html` はブラウザ内DB（localStorage）でそのまま利用できます。ローカルDBで登録した内容はJSONコピーで退避し、必要に応じて共有モックDBへ移行します。

- `index.html`: 仕様・運用資料の閲覧ビュー。
- `reports.html`: 受付DBの一覧、観測登録、代表ケース化、Backlog本文コピー用の管理ページ。
- `gas/`: Spreadsheetを受付DBとして扱うApps Script Web Appコード。

## 現在の利用手順

1. `reports.html` を開く。
2. GAS URL欄には共有モックDBのWeb App URLが初期設定される。
3. Google Workspace/OAuthの影響でGASに接続できない場合、またはローカル検証だけにしたい場合は、URL欄を空にして保存する。
4. `observationを保存` で人間報告またはAI観測を登録する。
5. `代表ケースへ昇格` で1不具合1代表ケースにまとめる。
6. 代表ケースを選び、`Backlog本文をコピー` で起票文を作る。
7. `JSON` ボタンでローカルDB内容をクリップボードへ退避できる。

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
- AIエージェントの結果は初期状態で `unverified` とし、人間確認済みになるまでBacklog本文生成対象にしません。
- 共有リポジトリ、DB、Backlogテンプレートには、個人名、メールアドレス、実トークン、非共有の社内判断を書きません。
