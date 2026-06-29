# 問い合わせDB整理レポート 2026-06-22

## 対象

- Spreadsheet: `1tv6xEckXPd8bIwbGfE-aJ-XxkIUDreglmcioCpkH-98`
- Sheet: `contact_submissions`
- Drive添付フォルダ: `1rcFGJh9l3NwUeYt2MIR8p2A-DVYxxEwY`
- 実行GAS: 確認者GAS `1tG0AXoDPAG86OurWepwGnZRoZNbplnq_VsiYUINIrv_NbVnMl1Mj7NwW`

## 判定ルール

自動削除対象は以下に限定する。

- 既知テスト受付ID: `3d6bd3bc-a065-4908-9f73-b0b048ad0b06`、`70a13837-4725-4b56-ab5f-22a5135ea3ca`、`93f9c46a-b306-4238-b14b-5169811b58f4`、`51cbb89e-b7e8-42ea-8890-0b4ce7645474`
- 既知ID以外は、メールが `s-umeda@abroad-o.com` / `customer@speed-ad.com` / `t-hayashi@abroad-o.com` のいずれかで、件名・本文・名前・User-Agent・投稿元URLのいずれかに `テスト`、`test`、`Codex`、`テストモード`、`production-check`、`contactTestMode` を含む行

外部メールアドレスの行は、既知テスト受付IDに一致しない限り自動削除しない。添付ファイルは `attachment_refs` から fileId を抽出し、Drive上のファイル名が削除対象 `submission_id` で始まる場合のみゴミ箱へ移動する。

## 事前確認

- 仕様書 `docs/画面設計/仕様/23_support_contact_form_requirements.md` を `status: confirmed`、`last_reviewed: 2026-06-22` に更新。
- 確認者GASに `previewContactDbCleanup` / `executeContactDbCleanup` を追加。
- 削除前に同一Spreadsheetへ `contact_submissions_backup_YYYYMMDD_HHMMSS` 形式のバックアップシートを作成する実装にした。

## プレビュー結果

- Status: completed
- Preview time: 2026-06-22 06:05 JST
- Total rows before cleanup: 15
- Candidate count: 12
- Candidate IDs:
  - `fb3f84e8-948a-477f-9490-570999818b2f`
  - `e81219ca-3e1c-4f74-b203-816307cbd4b5`
  - `fd6e784a-c634-418a-9862-0c2b0363446c`
  - `7fe3ea83-0308-4182-80a2-4d6067fe3bf0`
  - `bc19d151-46a3-4a05-9efe-64706809bdfb`
  - `3d80c1a4-b505-4ce2-b4be-58f8c92b2e86`
  - `566d3240-c29e-45ca-bc09-38da5cabbbbf`
  - `7258c7a5-7bc1-42aa-b9a5-d461808ffe7f`
  - `3d6bd3bc-a065-4908-9f73-b0b048ad0b06`
  - `70a13837-4725-4b56-ab5f-22a5135ea3ca`
  - `93f9c46a-b306-4238-b14b-5169811b58f4`
  - `51cbb89e-b7e8-42ea-8890-0b4ce7645474`
- Attachment file IDs:
  - `1pJpzNYUd6JN-Q9IkUWgDs1SKwMIgIbGs`
  - `1eMhiGKnbzYCqwSwl8vVo91aOSmT2dtbL`
  - `15eel6WUJZ_p1ESKBRPYskeZOSmVY58ev`
  - `1tAxw8xgyF5mvt762VMd3fHcpYTBnAUjh`

## 実行結果

- Status: partially completed
- Execute time: 2026-06-22 06:05 JST
- Backup sheet: `contact_submissions_backup_20260622_060551`
- Deleted row count: 12
- Deleted row numbers: 16, 15, 14, 13, 12, 11, 10, 6, 5, 4, 3, 2
- Total rows after cleanup: 3
- Post-cleanup preview: candidate count 0
- Trashed attachment count: 0
- Skipped attachment count: 0
- Attachment error count: 4

添付4件はGAS実行時に `DriveApp.File.setTrashed` のDrive書き込み承認が不足し、Drive APIでの個別ゴミ箱移動も `The user has not granted the app ... write access to the file` で拒否された。2026-06-29 に確認者GASへ残添付専用の再実行関数を追加してファイル名安全確認までは再確認したが、`DriveApp.File.setTrashed` は引き続き `https://www.googleapis.com/auth/drive` の承認不足で失敗した。シート行は削除済みで、削除前データはバックアップシートに保持されている。

残添付ファイル:

| submission_id | fileId | ファイル名 | 状態 |
| --- | --- | --- | --- |
| `7fe3ea83-0308-4182-80a2-4d6067fe3bf0` | `1pJpzNYUd6JN-Q9IkUWgDs1SKwMIgIbGs` | `7fe3ea83-0308-4182-80a2-4d6067fe3bf0-1-codex-test.png` | ファイル名確認済み。Drive書き込み承認不足で未削除 |
| `bc19d151-46a3-4a05-9efe-64706809bdfb` | `1eMhiGKnbzYCqwSwl8vVo91aOSmT2dtbL` | `bc19d151-46a3-4a05-9efe-64706809bdfb-1-fabicon.png` | ファイル名確認済み。Drive書き込み承認不足で未削除 |
| `3d6bd3bc-a065-4908-9f73-b0b048ad0b06` | `15eel6WUJZ_p1ESKBRPYskeZOSmVY58ev` | `3d6bd3bc-a065-4908-9f73-b0b048ad0b06-1-codex-permission-check.png` | ファイル名確認済み。Drive書き込み承認不足で未削除 |
| `70a13837-4725-4b56-ab5f-22a5135ea3ca` | `1tAxw8xgyF5mvt762VMd3fHcpYTBnAUjh` | `70a13837-4725-4b56-ab5f-22a5135ea3ca-1-codex-production-check.webp` | ファイル名確認済み。Drive書き込み承認不足で未削除 |

再実行方法:

1. `customer@speed-ad.com` で確認者GASを開き、Driveフル権限を含む承認を完了する。
2. Apps Scriptエディタから `previewResidualAttachmentCleanup()` を実行し、上記4件が `ready` または `already_trashed` であることを確認する。
3. `executeResidualAttachmentCleanup('DELETE_TEST_CONTACT_ROWS_20260622')` を実行する。
4. `previewResidualAttachmentCleanup()` を再実行し、4件が `already_trashed` になったことを確認する。

## 検証結果

- ローカル契約テスト: `node --test tests/support-contact-contract.test.mjs` passed
- GAS構文チェック: `Code.gs` parse passed
- 差分チェック: `git diff --check` passed
- GAS反映: 確認者GASをバージョン `17` (`support contact viewer apps script hash token`) へ反映済み
- 一時実行入口: バージョン `11` で使用後、バージョン `12` から削除済み。公開HTMLに `cleanupAction` と一時トークンが含まれないことを確認済み
- 追加ハードニング: `customer@speed-ad.com` の `clasp` profile を再認証し、確認用トークン経由のDB整理補助関数を含まないローカル最新コードを既存デプロイへ反映済み
- 公開HTML確認: `cleanupAction`、一時トークン、`previewContactDbCleanupWithToken` / `executeContactDbCleanupWithToken` が含まれないことを確認済み
- 確認アプリ表示確認: トークンなしURLは 200 でアプリ内の無効URL表示になることを確認済み
- 実トークン付き確認: 通知メールの確認アプリURLから、一覧、該当詳細、可視URL上のトークン除去を確認済み
- 添付プレビュー確認: 残添付 `1pJpzNYUd6JN-Q9IkUWgDs1SKwMIgIbGs` を確認アプリ経由で読み込み、画像データURLとDriveリンクを取得できることを確認済み
- 更新確認: 既存の検証行 `87cba07a-a8f6-42da-885d-781821adf768` でステータスと内部メモを一時更新し、取得確認後に表示値を元へ戻した
- DB整理関数のWeb経路確認: 確認画面の通常経路から `previewResidualAttachmentCleanup` を呼び出しても、Apps Script実行ユーザー確認で拒否されることを確認済み
- 新規テスト投稿: 未実施。ローカル環境に `CONTACT_TEST_MODE_TOKEN` の実値がなく、公開投稿GASのScript Property変更は今回の対象外のため、既存の検証行で更新系の実動作確認を代替した
