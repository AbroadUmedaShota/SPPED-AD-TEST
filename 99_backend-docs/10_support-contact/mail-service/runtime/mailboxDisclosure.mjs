import { createHash } from 'node:crypto';

export const MAILBOX = 'customer@speed-ad.com';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const MAILBOX_CONSENT_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const MAILBOX_DISCLOSURE_VERSION = '2026-11-11.11';
export const MAILBOX_SYNC_DISCLOSURE = '目的・取得範囲: 管理者が開始日を明示設定した対象期間の全送受信メールを列挙します。開始日は受付データの最古JST日の前日以前とし、過去の関連メールの調査結果に応じて前へ広げます。迷惑メール・ゴミ箱を含み、下書きは除きます。同期時に案件との関連が未確定のメールも本文を取得して照合し、判断できないメールは照合待ちとして表示します。後続同期では新着や変更も取得します。同期・再照合の対象判定では、対象期間外・下書きを含む候補メールのID・ラベル・内部日時だけを先に一時取得し、対象期間内かつ下書き以外と確認したメールに限り本文と同梱添付データを取得します。同期の未完了ページに含まれる候補メールの元IDは、再開用の同期位置としてFirestoreに保存します。中断・失敗中も再開用に残り、ページ完了の保存または新しい同期計画への明示的な切替で消去します。これとは別に、履歴同期で開始日前の下書きではないメールを見つけた場合は本文・添付を取得する前に同期を停止し、そのメールの元ID・内部日時・検出日時を未解消の観測記録としてFirestoreに保存します。この記録は新しい同期計画にも引き継ぎ、開始日を広げた全件同期でそのメールを実際に取得してアプリへ登録するまで保持します。原本が途中で消えた場合も取得不能の残件として保持し、管理者が期限や削除申請に基づく削除を実行するまで自動消去しません。';
export const MAILBOX_MARKER_DISCLOSURE = '再取込防止マーカーの整理: Gmail原本が存在する間はメールID由来の最小hashを保持します。通常メールの記録がない純粋な下書きも、削除履歴を未確認メールの削除と誤判定しないため、メールID由来の最小hashだけを保持します。下書きの元ID、ラベル、内部日時、件名、宛先、本文、添付はこの記録に保存しません。原本がなくなったか確かめる管理者の手動整理では、通常の同期対象期間外、下書き、迷惑メール、ゴミ箱も含めてGmail全体のメールIDを列挙します。重複検査用のhash集合をFirestoreに処理完了または取消しまで一時保存します。原本不在と削除履歴の処理済みを確認した後に最小hashを整理します。この整理で期間外メールの本文・添付は取得しません。';
export const MAILBOX_ACCEPTANCE_DISCLOSURE = '全件確認の受入照合: 同期の取りこぼしを独立して検査するため、管理者が通常の同期対象期間外、下書き、迷惑メール、ゴミ箱を含めたGmail全体のメールID・ラベル・内部日時を一時取得します。本文、件名、差出人・宛先、添付名、添付本体はこの検査で取得しません。メールIDを受入作業ごとの一時鍵でhash化し、hash・内部日時・下書きかどうかを管理者限定の端末ファイルへ一時保存します。正本の受付IDやアプリの案件照合・初回確認・関連メールなしの案件確認・添付取得状況も必要最小限のhashと検証情報へ変換して突き合わせます。期間外・下書きは件数と全件列挙の検査にだけ使い、対象メールの確認済み扱いにしません。一時鍵とsourceファイルは当該受入作業終了時に削除し、件数・一致判定など内容を含まない検証結果を運用記録へ残します。';

export function validRetentionNotice(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 500 &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

export function validDeletionContact(value) {
  return typeof value === 'string' && value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
}

export function mailboxDisclosure(options) {
  return `SPEED AD お問い合わせ確認アプリ：Gmailデータの利用について
説明version: ${MAILBOX_DISCLOSURE_VERSION}
運営主体: アブロードアウトソーシング株式会社
対象アカウント: ${MAILBOX}
要求権限: ${GMAIL_READONLY_SCOPE}（メールと添付の読取り。送信・変更・削除の権限は要求しません。）
${MAILBOX_SYNC_DISCLOSURE}
${MAILBOX_MARKER_DISCLOSURE}
${MAILBOX_ACCEPTANCE_DISCLOSURE}
共有: アプリの認証を通った abroad-o.com の社員全員と公式窓口の利用者が、対象メールの本文・添付、照合待ち、確認記録を閲覧できます。問い合わせ対応のため、この範囲の人による閲覧に同意する場合だけ続行してください。Google Cloud上で処理・保存します。
保存: 件名、差出人・宛先、日時、メール/スレッドID、添付名などの添付情報、案件との照合、メールごとの確認者・日時、関連メールなしの案件確認者・日時・対象期間、同期位置、開始日前に検出したメールの元ID・内部日時・検出日時、監査記録をFirestoreへ保存します。関連メールなしの確認は同期範囲や照合結果が変わると再確認が必要です。本文は同期時の照合と閲覧時に取得します。添付本体は主に閲覧時に取得しますが、Gmailのメール応答に本文と一緒に含まれる添付データは同期時にも一時的に受信します。本文・添付本体はサーバーの一時メモリと利用者画面で処理し、Firestoreへ保存しません。継続読取りの資格情報と、この説明全文・説明version・hash・同意日時・確認済み窓口の同意記録を同じSecret Manager versionへ保存します。
保存方針: Gmail由来の照合・確認記録と関連メールなしの案件確認記録は案件終了後3年間、除外したメールの記録は除外確定後3年間保存します。照合待ちの記録は案件への照合または除外を確定するまで3年間の起算日が決まらないため保持します。期限削除は管理者が手動で実行します。操作要求は発行から7日以内だけ再実行でき、期限後は保存状態を照合してから新しい操作を判断します。記録削除後の二重実行を防ぐ操作要求ID由来hashは、その要求の発行から7日の期限まで保持し、期限後に管理者が手動で整理します。実施方法: ${options.retentionNotice.trim()}
下書きとの矛盾: 既存の通常メールが現在の下書きと判定された場合は、既存の監査・確認記録を保持し、案件との紐付けを外した取得不能の照合待ちとして人の判断を待ちます。新しい下書き本文を取得・保存しません。
停止・削除: Googleアカウントの接続管理から本アプリのアクセスを取り消せます。取消し後も保存済みデータは残るため、削除申請は ${options.deletionContact} へ対象の案件ID/メールIDを連絡してください。取消しやアプリ側データ削除でGmailの元メールは削除しません。
詳細: mail-service READMEの「データの管理・削除」を確認してください。
Google Workspaceから得た情報はGoogle User Data PolicyのLimited Use要件に従って扱います。`;
}

/** Rebuild the entire accepted notice; matching selected clauses is insufficient. */
export function validMailboxConsentReceipt(receipt, now = Date.now()) {
  const parameters = receipt?.disclosureParameters;
  const acceptedAt = typeof receipt?.acceptedAt === 'string' ? Date.parse(receipt.acceptedAt) : NaN;
  if (receipt?.disclosureVersion !== MAILBOX_DISCLOSURE_VERSION || receipt.verifiedMailbox !== MAILBOX ||
    !validRetentionNotice(parameters?.retentionNotice) || parameters.retentionNotice !== parameters.retentionNotice.trim() ||
    !validDeletionContact(parameters?.deletionContact) || !Number.isFinite(now) || !Number.isFinite(acceptedAt) ||
    new Date(acceptedAt).toISOString() !== receipt.acceptedAt || acceptedAt > now + MAILBOX_CONSENT_CLOCK_SKEW_MS ||
    typeof receipt.disclosure !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.disclosureSha256 || '')) return false;
  const expected = mailboxDisclosure(parameters);
  return receipt.disclosure === expected &&
    createHash('sha256').update(expected, 'utf8').digest('hex') === receipt.disclosureSha256;
}
