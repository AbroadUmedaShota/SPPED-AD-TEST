# 00.画面一覧

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1095216`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-05-28T10:16:31Z`
- created: `2025-05-28T09:02:45Z`

## Original Content
## SPEED AD 画面一覧

### ユーザー向け画面

*   ログイン画面 (`/index`, `/`)
*   パスワード関連画面 (`/password`, `/password_create`, `/password_change`)
*   アカウント編集画面 (`/user/edit`)
*   トップ画面 (`/top`)
*   アンケート作成画面 (`/questionnaire`)
*   アンケート回答画面 (`/questionnaire_answer`)
*   サンクス画面 (`/thanks`)
*   アンケートプレビュー画面 (`/questionnaire_preview`)
*   アンケートコピー画面 (`/questionnaire_copy`)
*   名刺データ設定画面 (`/bizcard`)
*   お礼メール設定画面 (`/thanks_mail`)
*   グループ作成画面 (`/groupplan`)
*   グループ設定画面_申し込み完了画面 (`/groupplan2`)
*   グループ参加画面 (`/group_join`)
*   ユーザー管理画面 (`/user_admin`)
*   ユーザー追加画面 (`/user_admin_add`)
*   利用規約画面 (`/kiyaku`)
*   特定商取引法画面 (`/tokushou`)
*   ヘルプ画面 (`/help`)

### 管理者向け画面

*   管理者ログイン画面 (`/admin/index`, `/admin`)
*   管理者トップ画面 (`/admin/top`)
*   ユーザー一覧画面 (`/admin/user`)
*   アンケート一覧画面 (`/admin/questionnaire`)
*   請求管理画面 (`/admin/payment`)
*   請求書画面 (`/admin/invoice`)
*   クーポン管理画面 (`/admin/coupon`)
*   営業日カレンダー管理画面 (`/admin/calendar`)
*   データ入力一覧画面 (`/admin/data_input_list`)
*   データ入力画面 (`/admin/data_input_screen`)
*   照合一覧画面 (`/admin/matching_list`)
*   照合画面 (`/admin/matching_screen`)
*   オペレーター一覧画面 (`/admin/operator_list`)
*   実績画面 (`/admin/achievements`)

---

## ユーザー向け画面 機能詳細

-   **ログイン画面** (`/index`, `/`)
    *   ユーザーログイン
    *   パスワードリセット機能へのリンク

-   **パスワード関連画面** (`/password`, `/password_create`, `/password_change`)
    *   パスワードリセット
    *   新規パスワード作成
    *   パスワード変更

-   **アカウント編集画面** (`/user/edit`)
    *   ユーザー情報の編集
    *   会社情報の編集

-   **トップ画面** (`/top`)
    *   アンケート一覧表示
    *   アンケート作成へのリンク
    *   グループ管理へのリンク

-   **アンケート作成画面** (`/questionnaire`)
    *   アンケート新規作成 (`/questionnaire/create`)
    *   質問項目の設定（フリーアンサー, シングルアンサー, マルチアンサー, マトリックス, 日付/時間, 手書きスペースなど）
    *   必須項目設定
    *   アンケートプレビュー機能
    *   アンケート情報の保存

-   **アンケート回答画面** (`/questionnaire_answer`)
    *   アンケート回答
    *   名刺画像アップロード
    *   手書き入力
    *   必須項目チェック
    *   名刺手入力
    *   OCR処理 (`/questionnaire_answer/extract`)
    *   回答データの保存

-   **サンクス画面** (`/thanks`)
    *   アンケート回答完了表示
    *   連続回答機能（オプション）

-   **アンケートプレビュー画面** (`/questionnaire_preview`)
    *   作成中のアンケート表示確認

-   **アンケートコピー画面** (`/questionnaire_copy`)
    *   既存アンケートのコピー作成

-   **名刺データ設定画面** (`/bizcard`)
    *   名刺データ化設定
    *   データ化プラン選択
    *   クーポン適用
    *   ご請求見込み金額のリアルタイム表示

-   **お礼メール設定画面** (`/thanks_mail`)
    *   お礼メールテンプレート選択
    *   お礼メール送信機能
    *   メール内容編集

-   **グループ作成画面** (`/groupplan`)
    *   グループ作成

-   **グループ設定画面_申し込み完了画面** (`/groupplan2`)
    *   グループ設定申し込み完了表示

-   **グループ参加画面** (`/group_join`)
    *   グループ招待承認

-   **ユーザー管理画面** (`/user_admin`)
    *   グループメンバー一覧表示
    *   メンバー追加
    *   メンバー削除

-   **ユーザー追加画面** (`/user_admin_add`)
    *   グループへのユーザー招待
    *   招待メール送信

-   **利用規約画面** (`/kiyaku`)
    *   利用規約表示

-   **特定商取引法画面** (`/tokushou`)
    *   特定商取引法に基づく表示

-   **ヘルプ画面** (`/help`)
    *   ヘルプ情報表示

## 管理者向け画面 機能詳細

-   **管理者ログイン画面** (`/admin/index`, `/admin`)
    *   管理者ログイン

-   **管理者トップ画面** (`/admin/top`)
    *   管理ダッシュボード表示
    *   権限に応じたメニュー表示制御

-   **ユーザー一覧画面** (`/admin/user`)
    *   ユーザー検索
    *   ユーザー一覧表示
    *   ユーザー編集機能へのリンク

-   **アンケート一覧画面** (`/admin/questionnaire`)
    *   アンケート検索
    *   アンケート情報表示
    *   アンケート編集
    *   アンケート削除 (`/admin/questionnaire_delete`)
    *   名刺画像ダウンロード
    *   完了データアップロード (`/admin/questionnaire`)

-   **請求管理画面** (`/admin/payment`)
    *   請求情報検索
    *   請求情報表示
    *   請求情報編集 (`/admin/payment_edit`)

-   **請求書画面** (`/admin/invoice`)
    *   請求書検索
    *   請求書表示
    *   請求書ダウンロード

-   **クーポン管理画面** (`/admin/coupon`)
    *   クーポン検索
    *   クーポン情報表示
    *   クーポン作成 (`/admin/coupon_create`)
    *   クーポン編集 (`/admin/coupon_editupdate`)
    *   クーポン利用履歴表示 (`/admin/coupon_history`)

-   **営業日カレンダー管理画面** (`/admin/calendar`)
    *   営業日設定
    *   休日設定 (`/admin/calendar_create`)

-   **データ入力一覧画面** (`/admin/data_input_list`)
    *   入力対象グループ選択
    *   入力状況表示

-   **データ入力画面** (`/admin/data_input_screen`)
    *   名刺データ入力
    *   OCR結果確認
    *   データ保存 (`/admin/data_input_create`)
    *   入力終了 (`/admin/data_input_exit`)

-   **照合一覧画面** (`/admin/matching_list`)
    *   照合対象アンケート検索
    *   照合状況表示
    *   照合画面へのリンク

-   **照合画面** (`/admin/matching_screen`)
    *   名刺データの照合
    *   データ修正 (`/admin/matching_screen_update`)
    *   エスカレーション (`/admin/matching_screen_escale`)
    *   照合完了 (`/admin/matching_screen_update_end`)

-   **オペレーター一覧画面** (`/admin/operator_list`)
    *   オペレーター検索
    *   オペレーター情報表示
    *   オペレーター作成 (`/admin/operator_create`)
    *   オペレーター編集 (`/admin/operator_update`)
        *   **所属**
        *   **権限レベル**
        *   **メールアドレス**
        *   **パスワード**
        *   **オペレーター名**
        *   **有効・無効**
    *   オペレーター削除 (`/admin/operator_delete`)

-   **実績画面** (`/admin/achievements`)
    *   グループ別実績表示
    *   オペレーター別実績表示

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
