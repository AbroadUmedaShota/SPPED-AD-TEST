---
owner: product
status: draft
last_reviewed: 2026-01-23
---

# プレミアムプラン 検討用：機能一覧（ドラフト）

## 目的
サービスとして提供する機能を棚卸しした上で、プレミアムプラン（月額契約）に「含める（標準）／オプション／対象外」を選別できる形に整理し、意思決定に必要な論点を明確化します。

## 参照（出典メモ）
- 既存ドラフトの比較表：`docs/references/resources/client-materials/service-plan-comparison.md`（最終更新日：2025-10-08 と記載あり）
- 会議メモ：`docs/notes/meetings/2025-07-16_meeting.txt` / `docs/notes/meetings/2025-10-17_meeting.txt`
- ステータスとDL可否の記述：`docs/changelog/status_draft.md`
- 仕様（利用者・管理者）：`docs/product/specs/`（特に `11_plan_feature_restrictions.md`）

## 前提（プラン構造の整理案）
- 本リポジトリは現状「フロントエンドのモック画面開発フェーズ」であり、実装済み機能と将来想定（仕様/構想）が混在する（`docs/product/overview/00_PROJECT_OVERVIEW.md`）。
- **データ化プラン（項目数）**：無料 / スタンダード / プレミアム（月額）
- **データ化スピード（納期オプション）**：通常 / 特急 / 超特急 / オンデマンド
  - オンデマンドは「プレミアム契約限定」の前提が既存資料にある
- **プレミアムの中身は 2 階建て**で整理する
  - (A) プレミアムに「含める（標準）」＝月額で提供する差別化要素
  - (B) プレミアム「オプション（従量/追加単価）」＝案件ごとの可変要素（例：多言語や項目追加）
- `docs/product/specs/11_plan_feature_restrictions.md` では `planTier: free/standard/premium/premiumPlus` という整理案も存在するため、本資料では将来の拡張余地として「プレミアム＋（Enterprise）」を参考枠として扱う（必要なら別紙で詳細化）。

## 選別のルール（この資料で使うラベル）
- **プレミアム標準（含める）**: 月額に含める。原則、追加課金なしで利用可能。
- **プレミアムオプション**: プレミアム契約を前提に、従量/追加単価/開発費などで提供。
- **対象外**: プレミアムの差別化には使わない（無料 or スタンダードの範囲、または将来別商品）。
- **要決定**: 情報不足（運用負荷、コスト、実装難易度、法務/セキュリティ要件など）で未確定。

## サービス機能一覧（全体棚卸し）
「サービスとして提供する機能」を、利用者（ダッシュボード/回答者）と管理者（管理画面）を含めて一覧化します。

記号（現状）：
- `実装` = 本リポジトリ上のモック画面で到達・動作する
- `仕様` = 要件/仕様に記載がある（実装は未完の可能性）
- `構想` = 仕様ドキュメント内の将来設計・提案（未実装）

| 区分 | 機能 | 説明 | 現状 | プレミアム取扱い（案） | 根拠/参照 |
| --- | --- | --- | :--: | --- | --- |
| 認証/アカウント | ログイン/ログアウト導線 | 利用者画面への入口、ログアウト導線（現状はプレースホルダ含む） | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| 認証/アカウント | アカウント情報モーダル | ユーザー情報表示、コピー等 | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| 認証/アカウント | パスワード変更 | 3ステップUI、強度表示、確認 | 実装 | 対象外 | `docs/product/specs/09_password_change_screen.md` |
| 認証/アカウント | パスワードリセット | 強度メーター、バリデーション | 実装 | 対象外 | `docs/product/specs/10_password_reset_feature.md` |
| オンボーディング | 初回ログインチュートリアル | チュートリアル表示、再開バナー等 | 仕様/実装 | 対象外 | `docs/product/specs/00_first-login_tutorial_requirements.md` |
| 共通UI | 共通ヘッダー/サイドバー | 共通パーツ読み込み、ナビ、テーマ切替等 | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| グループ | グループ切替 | サイドバーでグループを切替、状態保持 | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| アンケート管理 | アンケート一覧 | 一覧、検索、ソート、フィルタ、ページング、ステータス表示 | 実装 | 対象外 | `docs/product/specs/00_screen_requirements.md` |
| アンケート管理 | アンケート詳細モーダル | メタ情報、リンク、DL可否表示など | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| アンケート管理 | 作成/編集 | 基本情報、期間、メモ、保存（現状localStorage中心） | 実装 | 対象外 | `docs/product/specs/02_survey_creation.md` |
| アンケート管理 | 設問ビルダー | グループ作成、並び替え、複製、削除、設問タイプ変更 | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| アンケート管理 | 設問タイプ（代表） | テキスト/単一/複数/ドロップダウン/数値/マトリクス/日時/説明カード/手書き | 実装/仕様 | 要決定（※一部プレミアム候補） | `docs/product/specs/02_survey_creation.md` |
| アンケート管理 | 離脱警告/未保存確認 | ページ遷移・戻る・閉じるで確認モーダル | 実装 | 対象外 | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| アンケート管理 | プレビュー/公開状態管理 | プレビュー言語切替、公開前チェックなど | 仕様 | 要決定 | `docs/product/specs/02_survey_creation.md` |
| アンケート配布 | URL/QRコード | URLコピー、QRモーダル、DL | 実装 | 対象外 | `docs/product/specs/01_screen_flow.md` |
| 回答者体験 | アンケート回答（動的描画） | surveyIdでJSONを読み込み、設問を描画 | 仕様 | 対象外 | `docs/product/specs/13_survey_answer_screen.md` |
| 回答者体験 | 回答ドラフト自動保存/復元 | 途中保存、復元確認、離脱警告 | 仕様 | 対象外 | `docs/product/specs/13_survey_answer_screen.md` |
| 回答者体験 | 回答送信 | 送信、保存（現状localStorage想定）、サンクス遷移 | 仕様 | 対象外 | `docs/product/specs/13_survey_answer_screen.md` |
| サンクス設定 | サンクス画面メッセージ設定 | 文言編集、500文字制限、保存 | 実装/仕様 | 対象外 | `docs/product/specs/08_thank_you_screen_settings.md` |
| サンクス設定 | 名刺撮影の有効/無効 | 名刺撮影を依頼する/しない、依存ボタン制御 | 実装/仕様 | 対象外 | `docs/product/specs/08_thank_you_screen_settings.md` |
| サンクス設定 | 連続回答の有効/無効 | 同一端末で連続回答を許可（設定画面側） | 実装/仕様 | プレミアム標準（含める） | `docs/product/specs/08_thank_you_screen_settings.md` |
| 回答者体験 | 連続回答ボタン | サンクス画面に「連続で回答する」表示 | 仕様 | プレミアム標準（含める） | `docs/product/specs/13_survey_answer_screen.md` |
| 名刺データ化 | 名刺データ化のON/OFF | 依頼の有効化、想定枚数入力 | 実装/仕様 | 対象外 | `docs/product/specs/02_survey_creation.md` |
| 名刺データ化 | データ化スピード | 通常/特急/超特急/オンデマンド選択、完了予定日計算 | 実装/仕様 | プレミアム標準（オンデマンド含む） | `docs/product/specs/02_survey_creation.md` |
| 名刺データ化 | データ化項目プラン | 無料/標準/プレミアム相当の項目数・テンプレ（サービス設計） | 仕様 | 要決定 | `docs/references/resources/client-materials/service-plan-comparison.md` |
| データ/保管 | データ保存期間 | 回答/名刺/画像/集計の保存期間（90日/無期限など） | 仕様 | プレミアム標準（含める） | `docs/references/resources/client-materials/service-plan-comparison.md` |
| 多言語 | 多言語アンケート（作成） | 作成画面で多言語入力タブ、言語の扱い | 実装/仕様 | プレミアムオプション（案） | `docs/product/specs/02_survey_creation.md` |
| 多言語 | 多言語アンケート（回答表示） | 英語/中国語（簡/繁）/ベトナム語等で表示 | 仕様 | プレミアムオプション（案） | `docs/product/specs/13_survey_answer_screen.md` |
| 設問タイプ | 手書きスペース設問（作成/回答） | 手書き入力キャンバス（プレミアム作成アンケートのみ有効） | 実装/仕様 | プレミアム標準（含める） | `docs/product/specs/13_survey_answer_screen.md` |
| 御礼メール | 御礼メール設定 | 自動/手動/なし、テンプレ、差出人 | 実装/仕様 | 要決定（※差別化軸） | `docs/product/specs/02_survey_creation.md` |
| 御礼メール | 自社ドメイン送信 | 自社ドメインでの送信（DNS認証など前提） | 仕様 | プレミアム標準（含める） | `docs/references/resources/client-materials/service-plan-comparison.md` |
| 御礼メール | 条件付き御礼メール | 回答内容に応じて文面切替 | 仕様 | プレミアム標準 or オプション（要決定） | `docs/notes/meetings/2025-07-16_meeting.txt` |
| レビュー/分析 | SPEEDレビュー | 回答+名刺の結合、検索、詳細、編集、ページング | 実装/仕様 | プレミアム標準（含める） | `docs/product/specs/06_speed_review.md` |
| レビュー/分析 | グラフ化ページ | 単一/複数回答の集計と可視化（棒/円、ソート等） | 仕様 | プレミアム標準（含める） | `docs/product/specs/07_graph_page_requirements.md` |
| ダウンロード | ダウンロードオプション | 回答/画像/名刺等の出力選択、期間制約 | 実装 | プレミアム標準（※拡張余地） | `docs/product/specs/12_dashboard_current_functional_requirements.md` |
| ライフサイクル | ステータス表示/DL可否 | 会期前/会期中/データ化中/完了/DL期限等、DL可否制御 | 実装/仕様 | 対象外 | `docs/changelog/status_draft.md` |
| 表示/ブランディング | ロゴ表示/非表示 | SPEED ADロゴの表示制御（準備中の扱い含む） | 仕様 | 要決定 | `docs/references/resources/client-materials/service-plan-comparison.md` |
| グループ管理 | グループ編集 | 請求先情報、メンバー管理、並び替え、確認モーダル | 実装/仕様 | 対象外 | `docs/product/specs/group_edit_requirements.md` |
| 請求 | 請求書一覧/詳細/印刷 | 月次サマリー、PDF出力、印刷ページ | 実装/仕様 | 対象外 | `docs/product/specs/04_invoice_screen.md` |
| 管理者 | 利用者アカウント管理 | 検索、一覧、詳細、設定 | 仕様 | 対象外 | `docs/product/specs/admin/user_management_requirements.md` |
| 管理者 | アンケート管理/詳細 | 稼働サマリ、検索、詳細、運用タスク | 仕様 | 対象外 | `docs/product/specs/admin/survey_management_requirements.md` |
| 管理者 | 照合管理/エスカレーション | キュー/優先度/履歴など | 仕様 | 対象外 | `docs/product/specs/admin/reconciliation_management_requirements.md` |
| 管理者 | オペレーター管理/招待 | 一覧、検索、招待 | 仕様 | 対象外 | `docs/product/specs/admin/operator_management_requirements.md` |
| 管理者 | 実績管理 | 集計条件、グラフ、オペレーター別実績 | 仕様 | 対象外 | `docs/product/specs/admin/performance_management_requirements.md` |
| プラン制御 | プラン別制限/アップセル | 能力定義、制限値、UI制御、監査ログ等 | 構想 | プレミアム標準（含める） | `docs/product/specs/11_plan_feature_restrictions.md` |
| プラン制御 | プラン別の上限（例） | 設問数上限、公開数上限、多言語数上限などの「制限値」提供 | 構想 | 要決定 | `docs/product/specs/11_plan_feature_restrictions.md` |
| 外部連携 | Slack通知/CRMエクスポート | 外部連携（連携可否をプランで制御） | 構想 | プレミアムオプション（案） | `docs/product/specs/11_plan_feature_restrictions.md` |
| 外部連携 | Webhook/SSO | Enterprise相当の連携機能 | 構想 | 対象外（別枠） | `docs/product/specs/11_plan_feature_restrictions.md` |

## プレミアムに含める候補（推奨）
差別化の軸が明確で、販売・運用説明がしやすいものを「標準」に寄せます。

- **データ保存期間：無期限**
- **御礼メール：上限なし + 自社ドメイン送信対応（ドメイン認証完了を条件）**
- **クロス集計（アンケート分析画面）**
- **オンデマンド納期オプションの選択権**
- **（準備中/開発中の扱いを明記した上で）ロゴ非表示、カスタマイズプラン**
- **名刺以外の画像添付 + 添付画像内文字のデータ化（実装・運用影響が大きいため提供条件を明確化）**
- **条件付き御礼メール（回答内容に応じて文面切替）**
- **手書きスペース設問（作成/回答）**
- **連続回答（サンクス画面設定 + 回答画面の連続回答ボタン）**

## プレミアム「オプション」候補（従量/追加単価の箱）
個別企業要件の差が大きく、見積・運用設計が必要なものは「オプション」として管理します。

- **多言語対応（アンケート単位の優先順位設定など）**
- **データ化項目の追加（例：電話番号2つ目、住所2つ目、手書きメモ 等）**
- **業種別テンプレート拡張 / テンプレート外項目（開発費別途）**

## プレミアム選別結果（暫定の置き場）
上の「全体棚卸し」のうち、プレミアムとしての扱いを決めたものだけを要約します（会議でここを更新していく想定）。

### プレミアム標準（含める）
- データ保存期間：無期限
- 自社ドメイン送信（ドメイン認証完了を条件）
- クロス集計/分析（グラフ化・分析画面）
- SPEEDレビュー
- 連続回答（サンクス設定 + 回答画面の連続回答ボタン）
- 手書きスペース設問
- オンデマンド納期オプションの選択権

### プレミアムオプション
- 多言語対応（作成/回答表示、優先順位など）
- 追加項目（電話番号/住所の追加、手書きメモ等）
- 条件付き御礼メール（標準に含めるかは要決定）
- 外部連携（Slack/CRMなど：提供方式は要決定）

### 対象外（プレミアムの差別化に使わない）
- 認証/アカウント系（ログイン、PW変更/リセット）
- 請求書表示（INV-001〜003）
- 管理者画面一式（別商品/別契約での整理が必要なら別紙化）

### 要決定
- ロゴ非表示（準備中の扱い含む）
- 御礼メールの送信上限/課金体系（無制限を標準にするか、従量課金を残すか）
- 名刺以外画像/OCR（提供条件・運用・免責）

## 機能の抜け・要追記（棚卸し観点）
「全機能」観点で追加棚卸しが必要になりやすい論点です（次回更新候補）。

- **データエクスポートの“何を”出せるか**（回答/名刺/画像/CSV等の粒度、無料・有料での差分）
- **クーポン/割引/請求下限**などの販売設計（`calculateEstimate` などの実装言及あり）
- **権限体系**（MasterAdmin/Admin/Operator/User 等）と、画面単位の権限差分表（会議メモの宿題）
- **自社ドメイン送信の運用要件**（DNS認証、審査、送信制限、ログ、問い合わせ導線）
- **名刺以外画像/OCR**の提供条件（容量、枚数、個人情報、保管、誤認識時の免責、オペレーション）

## 決めたいこと（論点）
- **プレミアム＝月額の“標準”に含める範囲**（差別化要素と運用負荷のバランス）
- **プレミアムオプションの課金単位**（アンケート単位 / 件数単位 / 月額加算 など）
- **「準備中/開発中」機能の扱い**（販売資料に載せる条件、ロードマップ表現）
- **権限差分の表現**（無料/有料/プレミアムの境界を画面単位でどう見せるか）

## 次アクション（この資料を更新するために必要な情報）
- 画面一覧と権限（無料・プレミアム）の棚卸し（会議メモにある粒度で表化）
- 実装済み/未実装の現況整理（「準備中」の定義を揃える）
- オプション候補の料金案（多言語、項目追加、画像添付OCR 等）
