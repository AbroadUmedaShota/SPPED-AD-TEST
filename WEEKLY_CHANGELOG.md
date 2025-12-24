# 月次変更履歴 (2025-07-22 〜 2025-12-23)

## 2025-12-24 (水)

- `02_dashboard/src/ui/speedReviewRenderer.js` / `02_dashboard/src/speed-review.js` / `02_dashboard/modals/cardImagesModal.html` / `02_dashboard/speed-review.html`
    - **SPEEDレビュー画面の機能強化とUI改善 (Issue #186)**:
        - **名刺画像確認モーダルの追加**: 詳細モーダルのフッターに「名刺画像」ボタンを新設し、名刺の表・裏を並べて確認できる専用モーダルを実装しました。
        - **インライン展開機能の実装**: 一覧テーブルの各行に展開ボタンを追加し、モーダルを開かずに名刺画像と主要情報を確認できるようにしました。「表面」「裏面」をタブで切り替える大きな画像表示エリアと、見やすく整理された情報エリアを備えています。
        - **画像回転・ズーム機能の強化**: 名刺画像に対し、90度ごとの回転ボタンとマウスホイールによる拡大縮小（ズーム）機能を実装しました。回転状態を維持したままのズームや、クリックによる全画面表示もサポートしています。これらの機能はモーダル・インライン表示・全画面表示のすべてで一貫して動作します。
        - **サイドバーのスクロール追従改善**: 画面左側のツール/設問リスト（サイドバー）が、スクロール時に画面下端まで追従するようにレイアウトと高さを調整しました。
        - **イベント処理の最適化**: フッターボタンや画像操作にイベント委譲（Event Delegation）を採用し、メモリリーク防止と動的なUI更新への対応を行いました。
    - **SPEEDレビュー画面のフリーズ修正 (Issue #186)**:
        - 名刺画像クリック時にアプリケーションがフリーズする問題を修正しました。

- `docs/examples/demo_answers/sv_0001_25057.json` / `docs/examples/demo_business-cards/sv_0001_25057.json`
    - **デモデータの拡充**: SPEEDレビュー画面の検証用に、アンケートID `sv_0001_25057` の回答データを25件まで増量しました。

## 2025-12-23 (火)

- `02_dashboard/src/surveyCreation.js`
    - **アンケートデータ読み込みパスの修正**: アンケート作成画面において、データが `demo_surveys` ディレクトリから読み込まれていた問題を修正し、正しい `surveys` ディレクトリを参照するように変更しました。
- `data/surveys/`
    - **アンケートデータファイルの追加**: 不足していたアンケートデータ（`sv_0001_25001.json` など）を多数追加しました。
- `02_dashboard/surveyCreation.html` / `02_dashboard/src/surveyCreation.js`
    - **QRコードボタンの機能修正とUI調整**:
        - アンケート作成画面の「QRコード」ボタンが反応しない不具合を修正し、いつでもモーダルが開くように変更しました。
        - ボタンのデザインを「キャンセル」ボタンと同様のスタイルに変更しました。
        - ID未発行時に表示されていた不要なトースト通知（「アンケートを保存した後に～」）を削除し、プレビュー目的で即座にQRを表示できるようにしました。

## 2025-12-18 (木)

- `surveyCreation.html` / `thankYouScreenSettings.html`
    - **画面推移アラートの誤検知修正**: アンケート作成画面の目次（TOC）をクリックした際、同一ページ内の移動であるにも関わらず「保存されていない変更があります」というアラートが表示される問題を修正しました。ハッシュ変更イベントの監視ロジックを見直し、内部リンク移動を除外するように変更しました。
    - **サンクス画面設定の保存ロジック**: 新規アンケート作成フローにおいて、サンクス画面の設定値が正しく初期化・保存されないケースがあったため、デフォルト値の適用と保存処理の順序を修正しました。
    - **数値表示の統一**: 入力フォームにおける数値（金額等）の表示形式を、開発環境の基準に合わせて小数点以下の桁数処理やカンマ区切りの仕様を統一しました。
- `index.html` (ダッシュボード)
    - **検索機能の不具合修正**: ダッシュボードの検索バーに「アンケートID」を入力しても該当するアンケートがヒットしないバグを修正しました。検索対象のフィールド定義を見直し、ID部分一致でも検索可能にしました。
- `02_dashboard/src/surveyDetailsModal.js` / `surveyDetailsModal.html`
    - **名刺データ化プラン表示の改修**: 詳細モーダル内の「名刺データ化」というラベルを、より具体的な「データ化項目プラン」に変更しました。また、内部値（`full`, `light`等）をそのまま表示するのではなく、設定ファイルに基づいて「フルデータ化」「ライトプラン」といった日本語の正式名称で表示するロジックを実装しました。
- `02_dashboard/src/tableManager.js`
    - **データ保存フローの改善**: アンケート一覧でデータを編集・保存する際、確認モーダルで「はい」を選択しても保存処理が中断される場合がある問題を修正しました。非同期処理の待機（await）漏れを解消し、確実に保存が完了してからUIが更新されるようにしました。
    - `GEMINI.md`
        - **ルール更新**: 変更を加えた際は必ず `WEEKLY_CHANGELOG.md` を更新することをルールとして明文化しました。
    - **アンケート作成・設定フローの改善**:
        - ID未発行のアンケートデータを`localStorage`に一時保存し、設定画面間で状態を引き継ぐように変更。
        - アンケート作成画面の「追加設定」および「QRコード」ボタンを常に操作可能に変更。
            - IDがない状態でQRコードボタンを押した場合は、Toastで通知するように挙動を改善。
        - 各種設定画面（名刺データ化、お礼メール、サンクス画面）を、IDがない場合は`localStorage`の一時データを読み書きするように修正。
        - サンクス画面の「回答後の文言設定」を再度プレミアム機能として無効化し、プラン案内のメッセージを表示するように修正。
## 2025-12-17 (水)

- `02_dashboard/src/invoiceDetail.js` / `invoice-detail.html`
    - **PDF白紙問題の解決**: 請求書PDFダウンロード時、2ページ目以降が白紙になる、または全体が白紙になるというクリティカルな問題を修正しました。
        - **修正内容**: `html2canvas` が画面外（`left: -10000px`など）の要素を正しくレンダリングできない仕様制限を回避するため、印刷用クローン要素を画面内（`top: 0, left: 0`）に配置しつつ `z-index` で最背面に隠す手法に変更しました。
    - **フッター位置の調整**: ページ番号（フッター）がコンテンツ（明細行）と重なる問題を解消するため、2ページ目以降のフッター位置を紙面下端から3mmの位置まで下げ、十分な余白を確保しました。
- `02_dashboard/modals/downloadOptionsModal.html` / `downloadOptionsModal.js`
    - **ダウンロード不可理由の可視化**: ダウンロードボタンがグレーアウト（非活性）されている際、ユーザーがその理由（期限切れ、未払い等）を把握できるように、ボタンホバー時にツールチップで具体的な理由を表示する機能を追加しました。
- `02_dashboard/src/tableManager.js` / `pager.js`
    - **スライディングウィンドウ式ページネーション**: アンケート一覧のページネーションを改善しました。
        - **変更前**: 固定のページ数表示、または全ページ表示。
        - **変更後**: 現在のページを中心に前後2ページ（計5ページ）を表示するスライディングウィンドウ方式を採用し、ページ数が多い場合でもレイアウトが崩れず、かつナビゲーションしやすいUIに変更しました。

## 2025-12-15 (月)

- `02_dashboard/modals/downloadExpiredModal.html` / `statusService.js`
    - **ダウンロード期限切れ対応**: ダウンロード有効期限（7日間など）を過ぎたアンケートをダウンロードしようとした際に、エラーではなく専用の「期限切れ通知モーダル」を表示するように実装しました。
    - **デモデータの拡充**: 開発およびテスト効率化のため、期限切れ状態や特殊なステータスを持つデモ用アンケートデータ（`sv_0001_99099.json`）を追加しました。

## 2025-12-14 (土)

- `docs/product/overview/00_PROJECT_OVERVIEW.md` / `specs/04_invoice_screen.md`
    - **要件定義書の更新**: 未定義のお礼メール設定を持つアンケートデータの取り扱いについて、仕様を明確化しドキュメントに追記しました。

## 2025-12-12 (木)

- `02_dashboard/src/invoiceList.js` / `invoiceDetail.js`
    - **請求書機能の安定性向上**: 請求書一覧および詳細機能において、APIサーバーがダウンしている場合でも閲覧ができるよう、ローカルのJSONファイルをフォールバックとして使用する機能を実装しました。
- `02_dashboard/invoice-detail.html`
    - **UI整理**: ブラウザ標準の印刷機能とPDFダウンロード機能の混同を避けるため、請求書詳細画面からブラウザ印刷ボタンを削除しました。
- `02_dashboard/modals/newSurveyModal.html`
    - **一貫性の向上**: 新規アンケート作成モーダルのフォントサイズやボタン配置などのスタイルを修正し、既存のアンケート詳細モーダルとのデザイン統一を行いました。

## 2025-12-08 (日)

- `02_dashboard/src/sidebar.js`
    - **サイドバーのアクティブ表示**: 管理画面において、現在表示しているページに対応するサイドバーのメニュー項目がハイライト（アクティブ表示）されない問題を修正しました。URLパス判定ロジックを修正し、現在のページが正しく強調表示されるようにしました。

## 2025-12-06 (金)

- `02_dashboard/src/main.js`
    - **コンソールエラー修正**: 存在しないDOM要素に対してイベントリスナーを付与しようとして発生していたJavaScriptエラーを修正しました。要素の存在チェックを追加することで、不要なエラーログの出力を抑制しました。

## 2025-12-05 (木)

- `03_admin/src/data_entry.js`
    - **データ参照パスの修正**: 管理画面のデータ入力機能において、参照するJSONデータのパス設定が誤っておりデータが読み込めない問題を修正しました。
- `docs/product/specs/admin/00_admin_requirements_design.md`
    - **管理者権限仕様の更新**: 管理者ロール（Super Admin / Operator）ごとのアクセス権限マトリクスを更新し、ドキュメントに反映しました。
    - **ドキュメント整理**: 検討資料として`data_management_review.md`を追加しました。

## 2025-11-23 (土)

- `docs/product/overview/action_tasks_2025-10.md`
    - **タスクリストの整理**: 10月〜11月のアクションプランと残タスクを整理し、ドキュメント化しました。
## 2025-11-14 (金)

- `02_dashboard/index.html` / `02_dashboard/src/first-login-tutorial.js` / `02_dashboard/src/surveyCreationTutorial.js`
    - **初回ログイン/作成チュートリアルの整備**: チュートリアル画面の導線と表示を追加・調整しました。

## 2025-11-12 (水)

- `02_dashboard/surveyCreation.html` / `02_dashboard/survey-answer.html` / `02_dashboard/src/ui/surveyRenderer.js`
    - **設問作成・回答UIの強化**: 日付/時間、数値入力、マルチアンサー上限、フリーアンサー検証、ツールボックス/手書きスペースなどを追加しました。
- `02_dashboard/bug-report.html`
    - **不具合報告画面の調整**: 入力フォームの表示を改善しました。

## 2025-11-10 (月)

- `02_dashboard/help-center.html` / `02_dashboard/help-content.html`
    - **ヘルプセンターの新設**: ヘルプセンター画面を追加し、カテゴリ表示を整理しました。
- `02_dashboard/bug-report.html`
    - **不具合報告ページの追加**: フォーム画面と導線を追加しました。
- `02_dashboard/service-top-style.css`
    - **ダークモード調整**: ヘルプ/報告ページの配色を調整しました。

## 2025-11-07 (金)

- `02_dashboard/faq.html` / `02_dashboard/src/faq.js`
    - **FAQ画面の追加**: FAQページを追加しました。
- `02_dashboard/common/footer.html` / `02_dashboard/terms-of-service.html`
    - **フッターリンク拡充**: 規約/特商法ページへの導線を追加しました。
- `02_dashboard/modals/newSurveyModal.html` / `02_dashboard/modals/duplicateSurveyModal.html`
    - **モーダルテンプレートの統一**: 画面間でモーダルの表示体裁を揃えました。

## 2025-11-06 (木)

- `02_dashboard/src/surveyCreationTutorial.js` / `02_dashboard/src/tutorial.js`
    - **初回ログインチュートリアルの実装**: 画面内ガイドを追加しました。
- `02_dashboard/survey-answer.html` / `02_dashboard/src/survey-answer.js`
    - **回答画面の調整**: 表示や挙動を修正しました。
- `03_admin/operator-management.html` / `03_admin/coupon-management.html`
    - **管理画面UIの調整**: オペレーター/クーポン管理画面のレイアウトを修正しました。

## 2025-11-05 (水)

- `02_dashboard/thankYouScreen.html`
    - **サンクス画面の新規作成**: 回答後画面を追加しました。
- `02_dashboard/survey-answer.html`
    - **回答画面のUI調整**: 表示調整とダミーデータ対応を進めました。
- `03_admin/coupon-management.html`
    - **クーポン管理画面の改修**: モーダルやレイアウトを調整しました。

## 2025-11-04 (火)

- `03_admin/coupon-management.html`
    - **クーポン管理画面の拡充**: 詳細/編集/一括作成モーダルなどを追加しました。
- `03_admin/operator-management.html`
    - **ユーザー/オペレーター管理画面の調整**: 表示と操作性を改善しました。

## 2025-10-31 (金)

- `03_admin/operator-management.html`
    - **オペレーター管理画面の調整**: レイアウトとフィルターを改善しました。

## 2025-10-30 (木)

- `03_admin/operator-management.html`
    - **オペレーター管理画面の作成**: 管理画面にオペレーター管理UIを追加しました。
- `03_admin/calendar-management.html`
    - **営業日カレンダーの拡張**: 年間/縦ビューと更新ログ表示を追加しました。

## 2025-10-24 (金)

- `03_admin/calendar-management.html`
    - **営業日カレンダーのUI改善**: 色分け、表示対象、操作感を調整しました。

## 2025-10-22 (水)

- `03_admin/data_entry.html` / `03_admin/src/data_entry.js`
    - **データ入力画面の調整**: レイアウト修正とナイトモード対応を行いました。
- `02_dashboard/service-top-style.css`
    - **ダークモードの配色調整**: 管理画面とダッシュボードの色味を揃えました。

## 2025-10-20 (月)

- `02_dashboard/bizcardSettings.html` / `02_dashboard/src/bizcardSettings.js`
    - **名刺データ化設定のUI改善**: 見積もりサイドバーの固定表示やプラン表示を整理しました。
- `02_dashboard/src/surveyCreation.js` / `02_dashboard/modals/qrCodeModal.html`
    - **アンケート作成の離脱警告/QR表示調整**: 意図しない離脱防止とQRモーダルの表示を改善しました。
- `03_admin/data-entry-management.html`
    - **オペレーター入力関連UIの改善**: 入力画面や照合画面の表示を調整しました。

## 2025-10-17 (金)

- `02_dashboard/surveyCreation.html`
    - **アンケート作成画面のUI強化**: 目次/ドロップダウン回答などの表示を調整しました。
- `02_dashboard/password_change.html` / `02_dashboard/reset-password.html`
    - **パスワード変更フローの整備**: 変更完了画面と遷移を追加しました。
- `02_dashboard/graph-page.html` / `02_dashboard/speed-review.html`
    - **グラフ/レビュー画面の改善**: 編集制御と表示を調整しました。

## 2025-10-14 (火)

- `02_dashboard/invoiceList.html`
    - **請求書一覧のレイアウト整理**: 一覧UIを簡素化し、バッジ色を調整しました。
- `02_dashboard/survey-answer.html`
    - **回答画面の安定化**: 表示フローとエラーハンドリングを改善しました。
- `02_dashboard/surveyCreation.html` / `02_dashboard/thankYouScreenSettings.html`
    - **添付/サンクス設定の調整**: 添付UIとサンクス画面設定を修正しました。

## 2025-10-08 (水)

- `02_dashboard/common/sidebar.html` / `02_dashboard/src/sidebarHandler.js`
    - **サイドバーUIのリファクタリング**: 構造と動作を整理しました。
- `02_dashboard/bizcardSettings.html`
    - **名刺データ化設定の構成整理**: 画面構成とデフォルト値を見直しました。
- `02_dashboard/surveyCreation.html` / `02_dashboard/thankYouEmailSettings.html`
    - **コンテンツ幅の最適化**: 画面幅と余白を調整しました。

## 2025-10-06 (月)

- `03_admin/data_entry.html` / `03_admin/data-entry-management.html`
    - **照合管理/データ入力画面の追加**: 管理画面の入力関連UIを追加しました。
- `02_dashboard/modals/downloadOptionsModal.html` / `02_dashboard/modals/duplicateSurveyModal.html`
    - **モーダルUI調整**: ダウンロード/複製モーダルの表示を改善しました。
- `02_dashboard/modals/surveyPreviewModal.html`
    - **プレビュー表示の調整**: ビューポートの見た目を改善しました。

## 2025-10-04 (土)

- `02_dashboard/index.html` / `02_dashboard/modals/surveyDetailsModal.html`
    - **ダッシュボード仕様変更**: 一覧表示と詳細モーダルのUIを更新しました。

## 2025-10-01 (水)

- `03_admin/user-management.html` / `03_admin/calendar-management.html`
    - **管理画面の主要ページを追加**: ユーザー/カレンダーなどの画面を追加しました。

## 2025-09-12 (金)

- `02_dashboard/speed-review.html` / `02_dashboard/src/ui/speedReviewRenderer.js`
    - **SPEEDレビューのグラフ強化**: 新しいデータ形式に対応し、グラフ表示を追加しました。

## 2025-09-11 (木)

- `02_dashboard/speed-review.html`
    - **レビュー画面のレイアウト改善**: ツールボックスの配置を整理しました。
- `02_dashboard/modals/reviewDetailModal.html`
    - **CSV取り込み/回答表示の拡充**: 詳細モーダルの表示を拡張しました。

## 2025-09-10 (水)

- `02_dashboard/surveyCreation.html`
    - **アンケート作成UI改善/国際化対応**: 作成画面のUIを整理し、多言語対応を追加しました。

## 2025-09-09 (火)

- `02_dashboard/index.html` / `02_dashboard/service-top-style.css`
    - **デザインガイドライン準拠**: ダッシュボードの見た目を調整しました。

## 2025-09-04 (木)

- `02_dashboard/surveyCreation.html`
    - **アンケート作成画面の機能強化**: UI構成と設定項目を整理しました。

## 2025-08-18 (月)

- `02_dashboard/survey-answer.html`
    - **アンケート回答画面の実装**: 新規回答UIを追加しました。
- `02_dashboard/src/main.js` / `02_dashboard/src/modalHandler.js`
    - **作成導線の改善**: 新規作成モーダルから作成画面への引き継ぎを追加しました。

## 2025-08-05 (火)

- `02_dashboard/common/header.html` / `02_dashboard/src/indexPage.js`
    - **多言語対応の追加**: アンケート一覧/作成画面で言語切り替えを追加しました。

## 2025-07-30 (水)

- `02_dashboard/invoice-detail.html` / `02_dashboard/invoice-print.html`
    - **請求書詳細/印刷画面のリニューアル**: PDF表示とレイアウトを改善しました。
- `02_dashboard/components/fab.html`
    - **アンケート作成のFAB追加**: 画面内の追加アクションを追加しました。

## 2025-07-29 (火)

- `02_dashboard/surveyCreation.html` / `02_dashboard/src/ui/accordion.js`
    - **アンケート作成UIのモジュール化**: UI部品の分離と整理を行いました。
- `02_dashboard/src/invoiceList.js`
    - **請求書一覧のリファクタリング**: 表示ロジックを整理しました。
- `02_dashboard/index.html`
    - **アンケートステータス表記の改善**: 一覧表示の文言を調整しました。
- `02_dashboard/src/qrCodeModal.js`
    - **QRコードモーダル修正**: 表示の不具合を修正しました。

## 2025-07-28 (月)

- `02_dashboard/common/header.html` / `02_dashboard/common/footer.html`
    - **共通ヘッダー/フッターの動的読み込み導入**: 共通パーツを動的読み込みに変更しました。
- `02_dashboard/invoiceList.html` / `02_dashboard/invoice-detail.html`
    - **請求書一覧/詳細ページの追加**: 請求書画面を追加しました。

## 2025-07-27 (日)

- `02_dashboard/common/sidebar.html` / `02_dashboard/index.html`
    - **共通コンポーネントの動的読み込み**: サイドバー/ヘッダー/フッターの共通化を行いました。
- `02_dashboard/src/surveyCreation.js`
    - **作成データの一時保存**: ローカル保存の導線を追加しました。

## 2025-07-25 (金)

- `02_dashboard/src/invoiceList.js`
    - **請求書一覧画面のUI改善**: 一覧表示のレイアウトを調整しました。

## 2025-07-24 (木)

- `02_dashboard/invoice-detail.html` / `02_dashboard/service-top-style.css`
    - **請求書画面ドラフト/レイアウト調整**: 請求書画面の初期デザインを整えました。

## 2025-07-23 (水)

- `02_dashboard/surveyCreation.html`
    - **アンケート作成のアウトラインUI追加**: 目次/アウトラインの導線を追加しました。

## 2025-07-22 (火)

- `02_dashboard/bizcardSettings.html` / `02_dashboard/thankYouEmailSettings.html`
    - **名刺データ化/お礼メール設定画面のUI改善**: 設定画面の構成を整えました。
- `01_login/login-top.html`
    - **ログイン画面の初期UI同期**: ログイン画面の初期UIを整えました。