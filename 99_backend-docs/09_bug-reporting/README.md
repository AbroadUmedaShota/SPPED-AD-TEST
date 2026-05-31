# バグ報告DB

人間の報告とAIエージェントの調査結果を、Backlog起票前に同じ受付DBで整理するための資料です。

v1では既存のE2Eシナリオ実行管理と同じく、Google Spreadsheet + Apps Script Web Appを軽量DBとして扱います。Backlogは修正・調査を進める代表課題であり、受付・観測・重複整理の正本はこのDB側に置きます。

GASが未設定、またはGoogle Workspace側でOAuthがブロックされている場合でも、`reports.html` はブラウザ内DB（localStorage）でそのまま利用できます。ローカルDBで登録した内容はJSONコピーで退避し、GAS復旧後にSpreadsheetへ移行します。

- `index.html`: 仕様・運用資料の閲覧ビュー。
- `reports.html`: 受付DBの一覧、観測登録、代表ケース化、Backlog本文コピー用の管理ページ。
- `gas/`: Spreadsheetを受付DBとして扱うApps Script Web Appコード。

## 現在の利用手順

1. `reports.html` を開く。
2. GASを使う場合は、GAS URL欄に `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec` を設定する。
3. Google Workspace/OAuthの影響でGASに接続できない場合は、URL欄を空にしてブラウザ内DBで使う。
4. `observationを保存` で人間報告またはAI観測を登録する。
5. `代表ケースへ昇格` で1不具合1代表ケースにまとめる。
6. 代表ケースを選び、`Backlog本文をコピー` で起票文を作る。
7. `JSON` ボタンでローカルDB内容をクリップボードへ退避できる。

## GAS作成状況

- Apps Script project: `SPEED AD バグ報告DB`
- Script ID: `1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb`
- 専用Web App deployment候補: `AKfycbwn_0ROYUKCZ5ptrvSsGSIEcNRnShbGaZiINRJbb0c487G005vLlGkpA2TKP0FeHFEC5Q`
- 現状: 専用GASはGoogle Workspace/OAuth側のアクセスブロックにより疎通未完了。
- 当面の利用先: 既存E2E GASへ `defect_*` リソースを追加した共用Web Appを使用する。
- 共用Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`

## 扱い

- 1不具合1代表ケースを基本とし、複数人の報告やAI観測は `defect_observations` に蓄積します。
- AIエージェントの結果は初期状態で `unverified` とし、人間確認済みになるまでBacklog本文生成対象にしません。
- 共有リポジトリ、DB、Backlogテンプレートには、個人名、メールアドレス、実トークン、非共有の社内判断を書きません。
