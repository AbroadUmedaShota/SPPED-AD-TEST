# メール全件照合用の正本Sheet取得

第2段階の本番受入で、独立照合器へ渡すSheet manifestを取得するための読取り専用手順です。GASの `exportContactMailSheetAcceptance(options, authProof)` は既存の利用者認証を通し、`abroad-o.com` のdomain経路に限って実行します。新しいOAuth scopeや公開URL、画面の操作は追加しません。実行には同関数を含むGAS版の配備と、認証済みHTML Serviceからの関数呼出しが必要です。現在の配備で呼べると推定しないでください。

## 入力と結果

`options` は次の4項目だけを持ちます。

| 項目 | 内容 |
| --- | --- |
| `runId` | 全取得で共通の1～80文字の英数字・`.`・`_`・`-`。 |
| `startAt` | 正本の最古受付から既存同期と同じ規則で決めた開始日時。正規UTC ISO文字列。 |
| `cutoffAt` | 今回の同期・照合に固定した基準日時。現在以前の正規UTC ISO文字列。 |
| `hashKeyBase64` | 今回だけ使うランダム32byteの共通キーを標準base64にした値。Gmail/App取得と同じキーを使い、manifestやログには保存しない。 |

認証済みクライアントから既存の `google.script.run` で同関数を呼び、成功応答の `manifest` をprivateな受入記録へ保存します。通常のクライアントと同じ `authProof` 引数を渡します。関数は認証、入力検査の順に処理し、Cloud Run/Gmail/Driveを呼びません。新しいApps Script Execution APIの公開設定はこの手順に含みません。

結果は `{ok:true, manifest, receipt}` です。`manifest` はschemaVersion、source、runId、hashKeyId、startAt、cutoffAt、capturedAt、sourceComplete、errors、pages、rowsを持ちます。各行は `{caseHash, submittedAt, handledStatus, closedAt}` です。caseHashはHMAC-SHA256の `case + NUL + 受付ID`、hashKeyIdはキー自体のSHA-256です。`receipt` は既存カタログと同じ `catalogDigest`、件数 `total`、読取り回数 `readCount:2` を持ちます。

受付ID、名前、メールアドレス、件名、受付本文、内部メモ、添付情報、キーは結果へ含めません。hashも照合可能な管理情報なので、共有リポジトリや公開ログへ置かないでください。

## 採取順と変更検出

1. 同期とhistory追随が完了した対象期間・基準日時、採用版、runId、共通キーを固定する。
2. この関数でSheet-beforeを取得する。
3. 独立したGmail manifestを取得する。
4. 読取り専用のApp manifestを取得する。
5. 同じ入力でこの関数を再度呼び、Sheet-afterを取得する。
6. Sheet-beforeとSheet-afterの全行・catalogDigestが一致し、Sheet-afterのcapturedAtがGmail/App取得後であることを照合器で確認する。

各呼出しでも正本を2回読み、受付ID・受付日時・状態・終了日時が一致した場合だけ完了結果を返します。200件の上限は設けず、保存先の全データ行を確認します。空の保存先、受付IDを欠く非空行、不正・重複ID、不正日時、状態と終了日時の不整合、基準日時より後の受付、読取り間の変更は固定エラーで停止します。行の不備を黙って省略せず、基準日時より後の受付があれば新しい基準で同期と採取をやり直します。

これは固定した観測期間の照合です。Sheet、Gmail、Firestoreをまたぐ原子的なsnapshotではありません。採取中の変更・取得失敗・未完了があれば合格へ進めません。manifest同士の一致だけで本文・添付の実確認、別利用者による確認記録の読戻しが完了したとは判定しません。

## 合成検証

リポジトリ直下で `node --test tests/support-contact-sheet-acceptance.test.mjs`。401件、HMAC互換、全件数、カタログdigest、認証・入力検査、空・欠損・重複・不正行、header/受付日時/状態の変更、基準日時違反、秘密を含む例外の固定化を合成データで確認します。実Sheetと配備画面での取得は別の受入です。
