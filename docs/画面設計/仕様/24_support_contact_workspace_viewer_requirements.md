---
owner: shared-docs
status: implementation-local-verified
last_reviewed: 2026-11-10
---

# 社内向けお問い合わせ確認アプリ

## 目的と配置

`abroad-o.com` の利用者が通常のブックマークから問い合わせ一覧・詳細・添付画像を確認し、対応ステータスと内部メモを更新できるようにする。

実装は `99_backend-docs/10_support-contact/viewer-workspace-gas/`。旧 `viewer-gas` の `Code.gs` と `Index.html` を複製し、認証と添付境界を変更する。旧viewerと既存送信GASはこの実装の変更対象に含めない。

## 認証と権限

- Web Appは会社アカウント `s-umeda@abroad-o.com` から別プロジェクトへ配備する。manifestは `executeAs: USER_DEPLOYING` / `access: DOMAIN`。
- `doGet` と全公開RPCで `Session.getActiveUser().getEmail()` を取得し、前後空白を除去・小文字化する。ローカル部が空でなく、ドメインが厳密に `abroad-o.com` と一致する場合のみ許可する。
- メール空欄、取得失敗、匿名、外部ドメイン、サブドメインはサーバーで拒否し、データアクセスに進まない。`getEffectiveUser`、引数やUIのメール、トークンを本人確認の代替にしない。
- 全社内利用者に同じ閲覧・ステータス/メモ更新権限を与える。`handled_by` にはサーバーで取得した実利用者メール、`handled_at` には更新日時を記録する。
- トークン認証、トークン検証API、トークンのsessionStorage保存は持たない。社内アカウントで通常URLを開き直せる。

## 保存先とRPC

既存の保存先だけを Script Properties `SPREADSHEET_ID` / `DRIVE_FOLDER_ID` から参照する。`CONTACT_SHEET_NAME` は省略時 `contact_submissions`。ID実値や認証情報をソースへ埋め込まない。設定はApps Script設定画面で行い、公開installerやProperties変更RPCは設けない。既存リソースの共有変更や新しい直接共有を要求しない。

| 公開入口 | 引数 / 用途 |
| --- | --- |
| `doGet(e)` | 通常URL / 初期 `?id=` |
| `getViewerContext()` | 認証済み利用者情報 |
| `listContactSubmissions(options)` | 検索・ステータス絞込み・件数・一覧（最大200件） |
| `getContactSubmission(submissionId)` | 本文・対応状態・添付メタ情報 |
| `getAttachmentPreview(submissionId, fileId)` | 対象行に紐づく添付画像のbase64プレビュー |
| `updateContactSubmissionStatus(submissionId, status, note)` | ステータス・メモ・更新者・更新日時の保存 |

内部関数は末尾 `_` とし、削除・テスト・整理・セットアップの公開入口を設けない。必須列がないシートはエラーとし、閲覧時に列を作成しない。

添付は対象行の `attachment_refs` に含まれ、送信GASの命名規則どおりファイル名が `<submission_id>-` で始まり、設定済み保存フォルダーの直接配下にある、ゴミ箱以外のファイルだけを許可する。他行のファイル、未参照ファイル、保存フォルダー外のファイルは拒否する。拒否した添付について代替URLからの参照を許可しない。

## 画面・更新

- 既存の一覧、検索、状態別件数、詳細、添付拡大/前後移動、内部メモ、クイック操作、未保存変更確認を維持する。
- 初期 `?id=` の詳細は初期一覧の絞込みや件数上限にかかわらず開く。ID省略時は通常の一覧を表示する。
- `未対応` / `対応中` / `対応済み` / `保留` のみ保存可能。存在しないIDや不正ステータスでは書き込まない。
- 保存対象は対応状態、内部メモ、実更新者、更新日時だけ。メモは前後空白を除去し、数式として評価されない文字列で保存する。同時編集は従来どおり後から保存した値が残る。
- 投稿内容・メモ・添付名をHTMLとして実行せずエスケープする。テンプレート内JSONは `<` をUnicodeエスケープし、投稿元/添付リンクはHTTP(S)のみに制限する。
- 外部OCRや外部解析を追加しない。manifestスコープは `spreadsheets`、`drive.readonly`、`userinfo.email` のみ。

## 検証と配備後受入

ローカル検証: `node --test tests/support-contact-workspace-viewer.test.mjs`。実際のCode.gsをVMで実行し、Sheet/Drive/Session境界だけを代替する。

配備後に別途確認する事項（本変更では実施しない）:

1. 配備者、実行者、組織内アクセス設定が上記と一致する。
2. 異なる社内利用者2名で通常ブックマークから一覧/詳細/添付/更新を利用でき、`handled_by` が各本人になる。
3. 初期一覧対象外の受付IDも `?id=` から開け、再読込でも利用できる。
4. 空メール・外部利用者・匿名アクセスが拒否される。社内でもSessionメールが取得できない場合は拒否を維持して設定を確認する。
5. 対象Sheet/Driveへの配備者の既存権限を確認し、新しい共有なしで操作できる。旧viewerの利用経路を維持する。
6. Chrome / Firefox / Edgeで一覧・編集・保存・添付拡大・未保存確認と表示崩れ/consoleエラーを確認する。

配備手順は [新viewer README](../../../99_backend-docs/10_support-contact/viewer-workspace-gas/README.md) を参照。ローカル検証の合格は実配備・実アカウントでの受入完了を意味しない。
