# 名刺多言語ルーティング要約（OCR優先案）

## 目的
- 名刺画像の自動言語判定（OCR）を主ロジックにし、回答画面の言語選択は補助的なヒントとして扱う。
- `supportedLocales` 内で自動判定したロケール別にオペレーターへ割当し、未対応・低信頼は隔離キューで再確認する。

## 主要入力
- `detectedLocale` / `confidence`: 名刺画像のOCR結果。
- `answerLanguageHint`: 回答画面で選択された言語（任意・補助）。
- `supportedLocales`, `defaultLocale` (`ja` 想定), `planLimits.multilingual.maxLocales`.

## フロー概要
1. 名刺アップロード → OCRで `detectedLocale` と `confidence` を取得（主判定）。
2. `detectedLocale` が `supportedLocales` に含まれ、`confidence` ≥ 閾値（例: 0.80）なら、そのロケールのオペレーターキューへ自動割当。
3. 閾値未満 / 非対応ロケールの場合は「言語不一致キュー」に隔離し、初期言語(`defaultLocale`)で暫定割当＋整合性アラートを送信。
4. 管理者は不一致キューで `detectedLocale`・`answerLanguageHint` を確認し、`finalLocale` を補正 → 再割当。
5. `answerLanguageHint` は `confidence` が閾値未満のときの補助優先順位として利用（例: ヒントが対応言語ならそれを採用、非対応ならフォールバック）。
6. すべての判定経路で `detectedLocale`・`answerLanguageHint`・`finalLocale`・`routingReason` をログに残し、再学習や調査に備える。

## ビジュアルフロー（非エンジニア向け）
```mermaid
flowchart TD
  U[名刺アップロード<br/>＋回答の言語ヒント] --> O[OCRで言語判定<br/>detectedLocale＋信頼度]
  O --> C{対応言語に含まれる？<br/>信頼度は閾値以上？}
  C -- はい --> Q[言語別オペレーターキューへ<br/>自動割当]
  C -- いいえ --> M[言語不一致キューへ隔離<br/>初期言語(ja)で暫定割当＋アラート]
  M --> A[管理者が確認<br/>OCR結果と回答ヒントを比較]
  A --> F[最終言語を補正<br/>再割当]
  Q --> L[記録: detected / hint / final<br/>routing理由を保存]
  F --> L
```

## ルーティングルール（簡易表）
- `detectedLocale ∈ supportedLocales` かつ `confidence ≥ 閾値`: `finalLocale = detectedLocale` → ロケール別キュー。
- `detectedLocale ∈ supportedLocales` かつ `confidence < 閾値`: `answerLanguageHint` が対応言語なら採用、それ以外は不一致キュー。
- `detectedLocale ∉ supportedLocales`: 不一致キューへ送付、`defaultLocale` で暫定割当。
- OCRとヒントが一致しても必ず両方を保持（将来の品質分析用）。

## データ保持（例）
- `input_business_cards`: `detected_locale`, `detected_confidence`, `answer_language_hint`, `final_locale`, `routing_reason`, `source_answer_id`, `photo_1/2`.
- `survey.settings`: `supportedLocales`, `defaultAnswerLocale`, `bizcard.supportedLocales`, `defaultBizcardLocale`.
- エクスポート列: 回答CSV/名刺CSVともに「アンケートの回答言語」「名刺の入力言語」を持ち、`answer_language_hint` は後者の初期値（優先回答言語）として扱う。
- 監査ログ: 誰がいつ `finalLocale` を補正したか（管理画面の再割当時に記録）。

## 運用・画面
- 管理画面で言語別キューを表示し、不一致キューからの再割当と差戻しをサポート。
- タイムアウト・スキップ時は自動でキューに戻し、別オペレーターへ再割当。
- アラートは「OCR低信頼」「未対応言語」「回答ヒント不一致」などの理由を明示。

## 参照ドキュメント
- `docs/product/processes/multilingualBizcardFlow.md`（既存フロー全体と不一致ハンドリング）
- `docs/product/specs/02_survey_creation.md:211-227`（多言語回答フローの不一致・再割当分岐）
- `docs/product/architecture/02_data_model.md:238-361`（`input_business_cards` の `language_code` 整合性チェック）
- `docs/product/specs/admin/00_admin_requirements_design.md:36-106`（言語別キュー管理と再割当要件）
