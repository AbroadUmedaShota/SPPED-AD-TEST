# ダッシュボード機能ベースライン（現行実装）

## 対象範囲
- 本資料は、2025-10-20 時点の `02_dashboard` 配下に実装済みの挙動を整理したものです。
- 対象は `index.html`、`surveyCreation.html`、`speed-review.html` と、静的データセットを利用する関連ダッシュボード機能です。
- ログイン画面、管理画面、その他の入口は、ダッシュボード共通シェルを再利用する場合を除き対象外です。

## データソースとパス解決
- `02_dashboard/src/utils.js` の `resolveDashboardDataPath` / `resolveDemoDataPath` は、相対リクエストを `./data/...` および `./docs/examples/demo_...` へ変換します（必要に応じて `../` を積み上げ）。返却値は常に `.` 始まりで、配信元 HTML の階層に依存せず解決可能です。
- 主要データセットは `data/core/surveys.json`（一覧、詳細モーダル、作成画面の初期化の単一ソース）、`data/core/invoices.json`（請求）、`data/core/groups.json`（サイドバー文脈）です。デモデータは `docs/examples/demo_*` に配置し、ページによって `data/responses/*` / `data/surveys/enquete/*` フォールバックを併用します。
- 回答・名刺データは `docs/examples/demo_answers`、`docs/examples/demo_business-cards`、`data/responses` に配置されています。CSV パスは `speedReviewService` でも対応します。
- 書き込み系はメモリ配列または `localStorage` のみを更新し、サーバー永続化は未接続です。

## シェル遷移と共通UI
- `02_dashboard/src/main.js` は `document.body.dataset.pageId` でページ判定し、ページ別初期化、index 復帰時の一覧再読込、`localStorage` のチュートリアル再開バナー表示を行います。
- `02_dashboard/common/` の共通断片は `loadCommonHtml` で取得され、相対アセットパスも同時に補正されます。
- サイドバー、テーマ切替、パンくず、QR モーダル等のグローバルウィジェットは中央初期化されます。`showToast` とクリップボード補助は `utils.js` に共通化されています。
- `sidebarHandler.js` はグループ取得、選択グループ永続化（`dashboard.selectedGroupId`）、モバイルドロワー制御、メニュー遷移（アカウントモーダル、ログアウトプレースホルダー含む）を担当します。

## アンケート一覧（`index.html`, `tableManager.js`）
- `data/core/surveys.json` から取得（`bizcardSettings` の `dataConversionPlan` / `bizcardRequest` などをトップレベル補完）し、`USER_STATUSES.DELETED` 相当を除外してキャッシュします。
- キーワード検索、ステータス絞り込み（`statusService.js` 由来）、日付レンジ（flatpickr）、表示件数、サイドバー連動グループ絞り込みに対応し、言語切替時は再評価されます。
- テーブルヘッダーは昇降順ソートとアイコンフィードバックに対応し、ページネーションは省略記号付きで境界を保持します。
- 行アクションは複製（ユーザーID＋年度採番）、SPEEDレビュー遷移、条件付きダウンロード、編集画面起動、URLコピー、詳細モーダル起動を提供します。
- `surveyDetailsModal.js` はライフサイクルメタデータ、Bizcard/サンクス/SPEEDレビュー導線、`deriveSurveyLifecycleMeta` に基づくダウンロード可否を表示します。
- `downloadOptionsModal.js` は出力種別（回答・画像・名刺）選択と、必要時のカスタム期間設定に対応します。

## アンケート作成（`surveyCreation.html`, `surveyCreation.js`, `ui/surveyRenderer.js`）
- `fetchSurveyData` と任意の `loadSurveyDataFromLocalStorage` で初期化し、未保存変更時はページ内リンク・履歴遷移・ブラウザ離脱で確認を出します。
- 作成UIは日本語表示を基本としつつ、日本語・英語・中国語（繁体/簡体）・ベトナム語を扱う多言語作成に対応します。最大3言語を有効化可能です。
- 設問グループは作成・複製・並べ替え（Sortable）・削除に対応し、各設問タイプは複製・削除・型変更をサポートします。
- 対応設問は自由記述、単一選択、複数選択、ドロップダウン、数値、マトリクス（単一/複数）、日時、手書き、説明です。メタデータ編集で選択肢、行列、数値範囲、日時制約、手書きサイズ、表示制御を扱います。
- アウトラインサイドバーはジャンプリンク、QRモーダル、チュートリアル導線（`tutorial.js`, `surveyCreationTutorial.js`）を提供します。
- Bizcard、サンクスメール、サンクス画面設定へのリンクは `surveyId` を引き継ぎ、保存は現状 `localStorage` のみです。

## 分析・レビュー機能
### SPEEDレビュー（`speed-review.html`, `speed-review.js`）
- `speedReviewService` は CSV を解析し、回答行と名刺データを結合し、アンケート定義で補完します。
- UI は検索、表示設問選択、設問依存フィルター、日付フィルター、ページネーション（初期 25 件）を提供します。
- 詳細モーダルは閲覧/編集モードを持ち、単一選択・複数選択・自由記述に応じた入力UIを出し分けます。編集はメモリ上のみ反映され、セッション内に限定されます。

### グラフ分析（`graph-page.html`, `graph-page.js`）
- アンケート定義と回答を `resolveDemoDataPath` 経由で読み込みます（例: `./docs/examples/demo_surveys`, `./docs/examples/demo_answers`）。
- 日付範囲フィルターで集計対象を絞り込めます。
- 単一選択/複数選択をグラフ用データへ変換し、回答ゼロの既定選択肢も表示対象に含めます。
- Excel 出力は設問ごとに `Q1`, `Q2`, ...（除外系は `Ex_番号`）のシートを生成し、`html2canvas`（`scale: 2`）でグラフを埋め込みます。進捗は非ブロッキングのフローティング表示で示し、実行中は `beforeunload` ガードを有効化します。

### アンケート詳細とダウンロード
- `surveyDetailsModal.js` は `statusService` のライフサイクル情報（ダウンロード期限、データ化完了、名刺要件）を集約し、関連画面への導線を提供します。
- `statusService.js` は生ステータスを `PRE_PERIOD`, `IN_PERIOD`, `POST_PERIOD`, `DATA_PROCESSING`, `DATA_READY`, `DOWNLOAD_CLOSED` へ正規化し、バッジ表示と一覧向けソート/フィルター補助を提供します。

## 名刺データ化設定（`bizcardSettings.html`, `bizcardSettings.js`）
- `data/core/surveys.json` から対象アンケート文脈と保存設定を読み込み、初期値はデータ化ON・100枚要求です。
- プラン/オプション定義は `services/bizcardPlans.js` 由来で、UIは依存項目とメモ表示を連動更新します。
- クーポン検証はモック辞書方式で、適用結果が見積・完了予定日に反映されます。
- `calculateEstimate` は金額、オプション、最低料金、完了日（会期終了＋納期補正/クーポン短縮）を返し、サマリーカードへ反映します。
- 保存はモック `saveBizcardSettings` Promise のみで、API 呼び出しはありません。

## サンクスメッセージ
### メール（`thankYouEmailSettings.html`, `thankYouEmailSettings.js`）
- `getInitialData` は `data/core/surveys.json` からアンケート情報と既存設定を読み込み、モックテンプレートと差し込み変数を補います。
- 新規設定は自動送信ONを初期値とし、UIは有効/無効切替、プレビュー更新、`insertTextAtCursor` による変数挿入に対応します。
- 保存/送信はローディング状態を持ち、`saveThankYouEmailSettings` / `sendThankYouEmails`（モック）を呼びます。

### 画面（`thankYouScreenSettings.html`, `thankYouScreenSettings.js`）
- アンケートタイトルとサンクスメッセージを初期表示し、500文字制限と連続回答許可トグルを提供します。
- 設定は `localStorage`（`thankYouScreenSettings_{id}`）へ保存し、基準値との差分で保存可否/確認挙動を制御します。
- 破壊的操作は `showConfirmationModal` を利用し、見出し等はアクティブ言語に追随します。

## グループ管理（`group-edit.html`, `groupEdit.js`）
- `groupService.js`（静的JSON）からグループ情報を取得し、作成者請求/グループ請求の表示切替に対応します。
- 請求情報は閲覧/編集モードとインラインバリデーションを備え、フォーム全体とは別に変更追跡します。
- メンバー一覧はアバター、ロール選択、ステータスバッジ、削除、ドラッグハンドル（Sortable）を表示し、クイックソートで並び替え可能です。
- 未保存時の遷移/削除は確認モーダルで保護し、CRUDはメモリ上の `groups` キャッシュ更新に留まります。

## 請求（`invoiceList.html`, `invoiceDetail.html`）
- 一覧は `data/core/invoices.json` を取得し、ステータス絞り込みとカード表示（プランバッジ、請求期間、要約情報）を行います。空状態には再読込導線を表示します。
- 詳細は請求メタ情報、金額内訳、振込先、ステータスを表示し、XLSX（サンプル）ダウンロードと印刷導線を提供します。
- ステータスに応じて印刷/ダウンロード可否を制御し、金額表示は `Intl.NumberFormat` を利用します。

## アカウント・セキュリティ
- アカウント情報モーダルは `modalHandler.js` により遅延読込し、`accountInfoModal.js` で描画、コピー操作は共通クリップボード補助を再利用します。
- パスワード変更（`password_change.js`）は3ステップ（現パス検証モック、強度評価、完了表示）で、表示切替とキャンセル確認を備えます。
- パスワードリセット（`reset-password.js`）は `zxcvbn` による強度メーター、表示切替、クライアント側バリデーション後の完了表示に対応します。

## 共通ユーティリティ・基盤
- `modalHandler.js` はモーダルHTML遅延読込、スクロールロック、クローズ挙動、機能別コールバック（アカウント/詳細/グループ/QR/レビュー詳細）を統合管理します。
- `utils.js` はスクロールロック、トースト、クリップボードコピー（フォールバック含む）、静的ファイルDL、共通HTML読込、ローディング/メッセージ表示、`debounce` を提供します。
- `sidebarHandler.js` は `tableManager.setGroupFilter` 連携、レスポンシブ制御、オーバーレイ表示中の背景スクロール抑止を担当します。
- 日付ピッカー、FAB、テーマ切替、チュートリアル補助等のUI部品は `02_dashboard/src/lib` と `02_dashboard/src/ui` に集約されています。

## モック実装・未連携項目
- アンケート複製、サンクスメール保存/送信、名刺設定保存、クーポン検証、グループCRUD、パスワード検証、SPEEDレビュー編集はクライアント側モック実装です。
- ページ再読込で `localStorage` 以外の変更は失われます。
- CSV解析は静的アセット前提で、ファイルアップロードや承認ワークフローは未実装です。
- メール送信、サンプル以外のダウンロード生成、ライフサイクル更新はトースト/ログによる疑似挙動です。
