---
owner: product
status: draft
last_reviewed: 2026-04-07
---

# SPEED AD 現行画面一覧・サービス設計整理

## 1. この資料の目的

本資料は、SPEED AD のサービス設計を画面単位で俯瞰するための一覧である。現行画面、関連仕様、実装HTMLを突き合わせ、画面構成・導線・責務分担の未整理点を洗い出すことを目的とする。

旧アーカイブ資料 `docs/アーカイブ/speedad-backlog-wiki-2026-03-24/pages/14_1095216_screen-list.md` は参考資料であり、現行運用の正本ではない。現行仕様の正本は `docs/画面設計/仕様/` および `docs/画面設計/仕様/admin/` に置く。

## 2. 凡例

| 項目 | 値 |
| :--- | :--- |
| 区分 | 公開/ログイン前 / 利用者向け / 管理者向け / 初回ログイン / モーダル / 法務・ヘルプ / 旧・サンプル |
| 仕様状態 | 正本あり / 補足仕様あり / 旧資料のみ / 未確認 |
| 実装状態 | HTMLあり / モックあり / Moved/旧導線 / 共通部品 / 未確認 |
| 設計確認 | 画面責務、導線、関連画面との境界、現行採用ページなど、サービス設計上の確認事項 |

## 3. 画面一覧

| No | 区分 | 画面名 | 現行HTML/導線 | 関連仕様 | 仕様状態 | 実装状態 | 設計確認 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| P-01 | 公開/ログイン前 | お客様のお声 一覧 | `customer-voices/index.html`, `index.html` から導線追加 | `19_customer_voice_public_pages.md` | 正本あり | HTMLあり | ログイン前トップからの信頼補強導線として、一覧から各詳細へ分岐する責務を整理する | `data/customer-voices.json` を参照 |
| P-02 | 公開/ログイン前 | お客様のお声 詳細（モニター企業） | `customer-voices/company-monitor.html`, `customer-voices/index.html` から遷移 | `19_customer_voice_public_pages.md` | 正本あり | HTMLあり | 先行利用モニター企業の利用価値を、課題・運用・変化の流れで伝える | 匿名化前提 |
| P-03 | 公開/ログイン前 | お客様のお声 詳細（大学） | `customer-voices/university-survey.html`, `customer-voices/index.html` から遷移 | `19_customer_voice_public_pages.md` | 正本あり | HTMLあり | アンケート単機能利用でも成立する導入イメージを伝える | 匿名化前提 |
| U-01 | 利用者向け | アンケート一覧 | `02_dashboard/index.html` | `00_screen_requirements.md`, `12_dashboard_current_functional_requirements.md` | 正本あり | HTMLあり | ダッシュボードの中心画面として、一覧・詳細モーダル・作成入口・ダウンロード導線の責務を整理する |  |
| U-02 | 利用者向け | アンケート作成・編集 | `02_dashboard/surveyCreation.html`, `02_dashboard/surveyCreation-v2.html` | `01_*`, `02_*` survey creation 系仕様 | 正本あり | HTMLあり | v1/v2の現行採用関係を明記する | 仕様ファイルが複数あるため参照先整理対象 |
| U-03 | 利用者向け | アンケート回答 | `02_dashboard/survey-answer.html` | `13_survey_answer_screen.md` | 正本あり | HTMLあり | 回答送信後の完了画面導線との接続を確認する | 旧一覧の `/questionnaire_answer` 相当 |
| U-04 | 利用者向け | アンケート回答完了 | `02_dashboard/thankYouScreen.html` | `08_thank_you_screen_settings.md` | 正本あり | HTMLあり | サンクス画面設定との責務分離を確認する | 旧一覧のサンクス画面相当 |
| U-05 | 利用者向け | SPEEDレビュー | `02_dashboard/speed-review.html` | `06_speed_review.md`, `speed_review_requirements_current.md`, `14_speed_review_sample_data_requirements.md` | 正本あり | HTMLあり | graph系仕様との境界と参照先を整理する | 詳細モーダルあり |
| U-06 | 利用者向け | グラフ分析 | `02_dashboard/graph-page.html`, `02_dashboard/matrix-comparison.html` | `07_graph_page_requirements.md`, `07_graph_analysis.md`, `design_memo_matrix_visualization.md` | 正本あり | HTMLあり | SPEEDレビューとの機能境界を確認する | マトリクス比較画面を含む |
| U-07 | 利用者向け | 名刺データ化設定 | `02_dashboard/bizcardSettings.html` | `16_bizcard_settings_requirements.md` | 正本あり | HTMLあり | プラン制限、請求、ダウンロード条件との関係を確認する |  |
| U-08 | 利用者向け | お礼メール設定 | `02_dashboard/thankYouEmailSettings.html` | `17_thank_you_email_settings_requirements.md` | 正本あり | HTMLあり | 送信対象・送信条件・名刺データ化完了後導線を整理する | 旧一覧の `/thanks_mail` 相当 |
| U-09 | 利用者向け | サンクス画面設定 | `02_dashboard/thankYouScreenSettings.html` | `08_thank_you_screen_settings.md` | 正本あり | HTMLあり | 回答完了画面との責務分離を確認する |  |
| U-10 | 利用者向け | グループ管理 | `02_dashboard/group-edit.html` | `group_edit_requirements.md`, `03_ux_group_creation_modal.md` | 正本あり | HTMLあり | グループ情報、請求先情報、メンバー管理、未保存変更確認のサービス設計を整理する |  |
| U-11 | 利用者向け | 請求書一覧 | `02_dashboard/invoiceList.html` | `04_invoice_screen.md`, `請求書関連ページ_仕様共有資料.md` | 正本あり | HTMLあり | 請求書詳細・印刷との導線を確認する |  |
| U-12 | 利用者向け | 請求書詳細 | `02_dashboard/invoice-detail.html` | `04_invoice_detail_requirements.md`, `請求書関連ページ_仕様共有資料.md` | 正本あり | HTMLあり | 表示項目と印刷用画面の差分を確認する |  |
| U-13 | 利用者向け | 請求書印刷 | `02_dashboard/invoice-print.html`, `02_dashboard/seikyuusyo_sample.html` | `05_invoice_document.md`, `請求書関連ページ_仕様共有資料.md` | 正本あり | HTMLあり | `seikyuusyo_sample.html` の現行扱いを確認する | サンプルHTMLを含む |
| U-14 | 利用者向け | パスワード再設定 | `02_dashboard/forgot-password.html`, `02_dashboard/reset-password.html`, `02_dashboard/reset-password-complete.html` | `10_password_reset_feature.md` | 正本あり | HTMLあり | ログイン画面との導線を確認する |  |
| U-15 | 利用者向け | パスワード変更 | `02_dashboard/password_change.html` | `09_password_change_screen.md` | 正本あり | HTMLあり | 完了画面との遷移を確認する |  |
| U-16 | 利用者向け | パスワード変更完了 | `02_dashboard/password-change-complete.html` | `09_password_change_screen.md` | 正本あり | HTMLあり | 完了後のログイン画面復帰導線を確認する |  |
| U-17 | 利用者向け | プレミアム関連 | `02_dashboard/premium_signup.html`, `premium_signup_new.html`, `premium_registration_spa.html`, `premium_registration_complete.html`, `premium_cancel.html`, `premium_cancel_complete.html` | `premium/` 配下仕様, `11_plan_feature_restrictions.md` | 正本あり | HTMLあり | 旧・新signupの採用関係、登録・完了・解約導線を確認する | プラン制限と連動 |
| U-18 | 法務・ヘルプ | ヘルプセンター / FAQ | `02_dashboard/help.html`, `help-content.html`, `faq.html` | `15_help_center_requirements.md` | 正本あり | HTMLあり | ヘルプセンターと個別コンテンツの管理方法を確認する |  |
| U-19 | 法務・ヘルプ | 法務ページ | `02_dashboard/terms-of-service.html`, `specified-commercial-transactions.html`, `personal-data-protection-policy.html` | 旧画面一覧 / 未確認 | 未確認 | HTMLあり | 正本仕様の要否を確認する | 利用規約、特商法、個人情報保護方針 |
| U-20 | 利用者向け | 更新履歴 | `02_dashboard/changelog.html` | 未確認 | 未確認 | HTMLあり | 画面仕様として管理するか、運用補助扱いにするか確認する |  |
| U-21 | 利用者向け | 不具合報告 | `02_dashboard/bug-report.html`, `02_dashboard/speed-ad-不具合報告-form/index.html` | `test_requirements.md` / 未確認 | 未確認 | HTMLあり | 通常画面とフォームディレクトリの使い分け、送信先責務を確認する |  |
| F-01 | 初回ログイン | 初回ログインチュートリアル | `04_first-login/index.html` | `00_first-login_tutorial_requirements.md` | 正本あり | HTMLあり | ダッシュボード再開バナーとの関係を確認する |  |
| A-01 | 管理者向け | 管理者ダッシュボード | `03_admin/index.html` | `admin/dashboard_requirements.md`, `admin/00_admin_requirements_design.md` | 正本あり | HTMLあり | 権限別表示と各管理画面への入口を整理する |  |
| A-02 | 管理者向け | 利用者管理 | `03_admin/user-management.html` | `admin/user_management_requirements.md` | 正本あり | HTMLあり | 詳細画面との導線を確認する |  |
| A-03 | 管理者向け | 利用者詳細 | `03_admin/user-detail.html` | `admin/user_detail_requirements.md` | 正本あり | HTMLあり | 編集可能項目と閲覧項目の境界を確認する |  |
| A-04 | 管理者向け | アンケート管理 | `03_admin/survey-management.html` | `admin/survey_management_requirements.md` | 正本あり | HTMLあり | 利用者側アンケート一覧との操作差分を確認する |  |
| A-05 | 管理者向け | アンケート詳細 | `03_admin/survey-detail.html` | `admin/survey_detail_requirements.md` | 正本あり | HTMLあり | 更新系操作ルールと閲覧情報の範囲を確認する |  |
| A-06 | 管理者向け | 請求管理 | `03_admin/billing-management.html` | `admin/billing_management_requirements.md` | 正本あり | HTMLあり | 請求書関連画面との接続を確認する |  |
| A-07 | 管理者向け | クーポン管理 | `03_admin/coupon-management.html` | `admin/coupon_management_requirements.md` | 正本あり | HTMLあり | クーポン系モーダルとの接続を確認する |  |
| A-08 | 管理者向け | 営業日カレンダー管理 | `03_admin/calendar-management.html` | `admin/calendar-management_requirements.md` | 正本あり | HTMLあり | 休業日計算への反映範囲を確認する |  |
| A-09 | 管理者向け | データ入力状況 | `03_admin/data-entry/index.html` | `admin/data_entry_requirements.md` | 正本あり | HTMLあり | `data-entry-management.html` / `data_entry.html` はMoved扱いでよいか確認する |  |
| A-10 | 管理者向け | データ入力フォーム | `03_admin/data-entry/form.html` | `admin/data_entry_requirements.md` | 正本あり | HTMLあり | BY系旧画面との対応を確認する |  |
| A-11 | 管理者向け | 照合管理 | `03_admin/reconciliation/index.html` | `admin/reconciliation_management_requirements.md` | 正本あり | HTMLあり | 一覧・詳細との役割分担を確認する |  |
| A-12 | 管理者向け | 照合一覧 | `03_admin/reconciliation/list.html` | `admin/reconciliation_management_requirements.md` | 正本あり | HTMLあり | BY系旧画面との対応を確認する |  |
| A-13 | 管理者向け | 照合詳細 | `03_admin/reconciliation/detail.html` | `admin/reconciliation_management_requirements.md` | 正本あり | HTMLあり | 照合保存・エスカレーション処理の画面責務を確認する |  |
| A-14 | 管理者向け | オペレーター管理 | `03_admin/operator-management.html` | `admin/operator_management_requirements.md` | 正本あり | HTMLあり | BY系旧画面との対応を確認する |  |
| A-15 | 管理者向け | 実績管理 | `03_admin/performance-management.html` | `admin/performance_management_requirements.md` | 正本あり | HTMLあり | オペレーター権限別表示を確認する |  |
| A-16 | 管理者向け | エスカレーション対応 | `03_admin/escalations.html` | `admin/escalation_management_requirements.md` | 正本あり | HTMLあり | 照合詳細からの連携を確認する |  |

## 4. モーダル一覧

| No | 利用画面 | モーダル名 | HTML | 目的 | 仕様状態 | 実装状態 | 設計確認 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| M-01 | 共通 / アンケート一覧 | アカウント情報 | `02_dashboard/modals/accountInfoModal.html` | アカウント情報の表示・編集 | 補足仕様あり | HTMLあり | 保存責務と独立画面からの統合有無を確認する |
| M-02 | アンケート一覧 | アンケート詳細 | `02_dashboard/modals/surveyDetailsModal.html` | アンケート詳細確認、導線集約 | 補足仕様あり | HTMLあり | 一覧行操作、詳細確認、関連画面導線の責務を整理する |
| M-03 | アンケート一覧 | アンケート複製 | `02_dashboard/modals/duplicateSurveyModal.html` | 既存アンケートの複製 | 補足仕様あり | HTMLあり | 採番・引き継ぎ項目を確認する |
| M-04 | アンケート一覧 | 新規アンケート | `02_dashboard/modals/newSurveyModal.html` | 新規アンケート作成の入口 | 補足仕様あり | HTMLあり | 作成画面へのパラメータ引き渡しを確認する |
| M-05 | アンケート一覧 / 作成 | QRコード | `02_dashboard/modals/qrCodeModal.html` | 回答URL・QRコード表示 | 補足仕様あり | HTMLあり | URLコピーとQR画像ダウンロードの責務を確認する |
| M-06 | アンケート一覧 | ダウンロードオプション | `02_dashboard/modals/downloadOptionsModal.html`, `exportOptionsModal.html`, `downloadExpiredModal.html`, `cardImagesModal.html` | 回答・名刺・画像データの出力 | 補足仕様あり | HTMLあり | 一覧・詳細モーダル・期限切れ・画像表示の役割分担を整理する |
| M-07 | アンケート作成 | アンケートプレビュー | `02_dashboard/modals/surveyPreviewModal.html`, `surveyPreviewModalV2.html` | 作成中アンケートのプレビュー | 補足仕様あり | HTMLあり | v1/v2の採用関係を確認する |
| M-08 | SPEEDレビュー | レビュー詳細 | `02_dashboard/modals/reviewDetailModal.html` | 回答詳細の閲覧・編集 | 補足仕様あり | HTMLあり | 編集の永続化範囲を確認する |
| M-09 | アンケート作成 | 設問選択 | `02_dashboard/modals/questionSelectModal.html` | 設問タイプの追加選択 | 補足仕様あり | HTMLあり | 対応設問タイプを確認する |
| M-10 | 共通 | 問い合わせ | `02_dashboard/modals/contactModal.html` | 問い合わせ送信 | 未確認 | HTMLあり | 送信先・保存先のサービス責務を確認する |
| M-11 | グループ管理 | グループ作成 | `02_dashboard/modals/newGroupModal.html` | 新規グループ作成 | 正本あり | HTMLあり | グループ管理本体との責務を確認する |
| M-12 | グループ管理 | メンバー詳細 | `02_dashboard/modals/memberDetailModal.html` | メンバー詳細確認 | 正本あり | HTMLあり | 招待中・参加後状態の表示責務を確認する |
| M-13 | プレミアム関連 | プレミアム機能案内 | `02_dashboard/modals/premiumFeatureModal.html` | 有料機能への誘導 | 正本あり | HTMLあり | プラン制限仕様との整合を確認する |
| M-14 | 共通 | 確認 / キャンセル確認 | `02_dashboard/modals/confirmationModal.html`, `cancelConfirmationModal.html` | 汎用確認 | 補足仕様あり | HTMLあり | 未保存変更確認などの共通利用範囲を確認する |
| M-15 | 管理者 / クーポン | クーポン作成・編集・詳細 | `03_admin/modals/newCouponModal.html`, `editCouponModal.html`, `couponDetailModal.html`, `bulkCreateCouponModal.html` | クーポン管理のCRUD補助 | 正本あり | HTMLあり | 本体画面との操作差分を確認する |
| M-16 | 管理者 / 共通 | 確認 | `03_admin/modals/confirmationModal.html` | 管理者側汎用確認 | 補足仕様あり | HTMLあり | 各画面での利用範囲を確認する |
| M-17 | 管理者 / ユーザー・アンケート | メール送信 | `03_admin/modals/sendEmailModal.html` | 利用者向けメール送信 | 未確認 | HTMLあり | 送信条件・権限を確認する |
| M-18 | 管理者 / グループ | グループ管理 | `03_admin/modals/groupManagementModal.html` | 管理者側グループ操作 | 未確認 | HTMLあり | 利用者側グループ管理との責務を確認する |

## 5. 差分・未整理リスト

### 5.1. 旧画面一覧にはあるが現行HTML/仕様との対応が未確認

| 旧画面 | 旧導線 | 現行候補 | 確認事項 |
| :--- | :--- | :--- | :--- |
| ログイン画面 | `/index`, `/` | ルート `index.html` など | 現行ログイン導線の配置確認 |
| アカウント編集画面 | `/user/edit` | `accountInfoModal.html` | 画面からモーダルへ統合されたか確認 |
| アンケートプレビュー画面 | `/questionnaire_preview` | `surveyPreviewModal*.html` | 独立画面からモーダルへ統合されたか確認 |
| アンケートコピー画面 | `/questionnaire_copy` | `duplicateSurveyModal.html` | 独立画面からモーダルへ統合されたか確認 |
| グループ作成画面 | `/groupplan` | `group-edit.html`, `newGroupModal.html` | 現行導線の確定 |
| グループ設定画面_申し込み完了画面 | `/groupplan2` | 未確認 | 現行で廃止済みか確認 |
| グループ参加画面 | `/group_join` | 未確認 | 招待参加フローの現行導線確認 |
| ユーザー管理画面 / ユーザー追加画面 | `/user_admin`, `/user_admin_add` | `group-edit.html` 周辺 | 利用者側のメンバー管理へ統合されたか確認 |
| 請求書画面 | `/admin/invoice` | `03_admin/billing-management.html` / 利用者側請求書画面 | 管理者側請求書画面の有無確認 |

### 5.2. 現行HTMLはあるが仕様書の対応が未確認

| HTML | 確認事項 |
| :--- | :--- |
| `02_dashboard/changelog.html` | 画面仕様として管理するか、運用補助扱いにするか |
| `02_dashboard/bug-report.html` | `speed-ad-不具合報告-form/index.html` との使い分け |
| `02_dashboard/help-content.html` | `help.html` 配下コンテンツとして扱うか |
| `02_dashboard/premium_signup.html`, `premium_signup_new.html` | 現行採用ページの確定 |
| `02_dashboard/seikyuusyo_sample.html` | サンプルか現行印刷導線か |
| `03_admin/data_entry.html`, `03_admin/data-entry-management.html` | `Moved` タイトルのため旧導線扱いでよいか |
| `03_admin/BY-*`, `03_admin/sample/*` | 旧・サンプル画面として別枠管理でよいか |

## 6. 別枠管理

`02_dashboard/common/`, `02_dashboard/components/`, `03_admin/common/` は共通部品として扱い、画面一覧には含めない。`03_admin/BY-*`, `03_admin/sample/*`, `old/`, `Moved` タイトルのHTMLは旧・サンプル・移行導線として別枠管理し、現行画面の正本には含めない。
