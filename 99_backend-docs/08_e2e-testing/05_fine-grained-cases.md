---
owner: product
status: draft
source_status: 既存E2Eケース（index.html の TEST_CASES）から細粒度化
---

# E2E-005 細粒度テストケース（正常系深掘り）

## 基本情報

| 項目 | 内容 |
| --- | --- |
| 対象 | 既存の粗い正常系ケースを、フィールド単位・設問タイプ単位・操作単位に分解したもの |
| スコープ | Sランク2グループ（QR・回答 / アンケート作成・編集）を先行。型を確立して他グループへ横展開する |
| 方針 | 正常系のみ。異常系・エラー系・レスポンシブ/ブラウザ横断・データ状態バリエーションは今回スコープ外 |
| 親ケース | `index.html` の `TEST_CASES`（EDT-001〜004 / CRT-001 / QR-001 / ANS-001〜003） |
| 件数 | アンケート作成・編集 24件 ＋ QR・回答 21件 ＋ ユーザー観点追加 8件 = 53件 |

## 分解フレーム

- **主軸 = 設問タイプ軸**。実コード `02_dashboard/src/ui/surveyRenderer.js` の `QUESTION_TYPE_ORDER` は計10種:
  `free_answer / single_answer / multi_answer / dropdown / number_answer / matrix_sa / matrix_ma / date_time / handwriting / explanation_card`
  （正本指定は前半8種。`handwriting` / `explanation_card` の扱いは要判断）。
- **補助は1軸まで**（組合せ爆発を防ぐ）: フィールド軸（設問文/選択肢/必須トグル/補足）、操作ステップ軸（追加/入力/並び替え/複製/削除）、値バリエーション軸（単一=1つ選択 / 複数=2つ選択 / matrix=行×列 / number=正整数 / date=有効日付）。
- **IN/OUT 境界**: `expected` が「成功 / 表示される / 送信できる / 維持される」で書けるなら IN。「エラー / ブロック / 拒否 / 未入力で弾かれる」を含むなら OUT（異常系→別フェーズ）。迷ったら OUT。
- **上限**: 親1ケース → 最大5〜7サブケース。総数150件以内を運用ライン（手動テスト1ラン30〜45分）とする。
- **採番**: 既存連番を拡張（EDT-005〜 / QR-002〜 / ANS-004〜）。親子関係は `parentId` 列で表現。参照JSONは `dataSource` 列に明記。タイトルは「親タイトル - 分解軸の値」形式。
- **再現性**: `preconditions` に実ファイルパス＋検証に効く属性値を直書きし、`expected` は実DOMセレクタ・実JSON値まで落とす。

## A. アンケート作成・編集（EDT-005〜028 / 24件）

| case_id | parentId | screen | route | title | preconditions | steps | expected | priority | sideEffect | evidence | dataSource |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EDT-005 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - free_answer | surveyCreation.html を開く。free_answer設問ゼロの状態 | 設問追加ボタン押下 / メニューから「自由記述」選択 / 追加確認 | `[data-question-type="free_answer"]` の `.question-item` がDOMに存在 | P0 | none | surveyRenderer.js:599 dataset.questionType | ※enquete配下に実例なし（全JSONはsingle_choice×3） |
| EDT-006 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - single_answer | 同上 | 追加 / 「単一選択」選択 / 追加確認 | `[data-config-section="choice_options"]` がvisible | P0 | none | surveyRenderer.js:477 applyChoiceOptions | data/surveys/enquete/sv_0001_25022.json（キー差異 ※要確認） |
| EDT-007 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - multi_answer | 同上 | 追加 / 「複数選択」選択 / 追加確認 | choice_options と `[data-config-section="multi_answer"]`（最大選択数）が表示 | P0 | none | surveyRenderer.js:387-400 | ※実例なし |
| EDT-008 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - dropdown | 同上 | 追加 / 「ドロップダウン」選択 / 追加確認 | choice_options がvisible | P0 | none | surveyRenderer.js:477 | ※実例なし |
| EDT-009 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - number_answer | 同上 | 追加 / 「数値入力」選択 / 追加確認 | `[data-config-section="number"]` がvisible、min/max/step/unitLabel欄表示 | P0 | none | surveyRenderer.js:402-418 | ※実例なし（sv_0001_25056.json に number あり） |
| EDT-010 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - matrix_sa | 同上 | 追加 / 「マトリクス（単一）」選択 / 追加確認 | `.matrix-editor` visible、`.matrix-rows-list`/`.matrix-cols-list` 存在 | P0 | none | surveyRenderer.js:502-523 | ※実例なし（sv_0001_26001.json に matrix あり） |
| EDT-011 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - matrix_ma | 同上 | 追加 / 「マトリクス（複数）」選択 / 追加確認 | `.matrix-editor` visible | P1 | none | surveyRenderer.js:505 | ※実例なし |
| EDT-012 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問追加 - date_time | 同上 | 追加 / 「日付/時刻」選択 / 追加確認 | `[data-config-section="date_time"]` visible、showDate/showTime表示 | P0 | none | surveyRenderer.js:420-433 | ※実例なし（sv_0001_25056.json に date あり） |
| EDT-013 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問文入力 - single_answer | single_answer設問1件以上（EDT-006後 or sv_0001_25022読込後） | アコーディオン展開 / 設問文欄クリック / 「テスト設問」入力 | 入力値が設問文に表示、サマリプレビュー反映 | P0 | none | surveyRenderer.js:596 | data/surveys/enquete/sv_0001_25022.json |
| EDT-014 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 選択肢追加 - single_answer | single_answer設問あり、choice_options visible | 「選択肢を追加」クリック / 追加確認 | `.option-item` 数が1増える | P0 | none | surveyRenderer.js:297-316 | sv_0001_25022.json（options=["男性","女性","その他"]） |
| EDT-015 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 選択肢追加 - multi_answer | EDT-007後、multi_answer選択肢エリアvisible | 「選択肢を追加」クリック / maxSelectionsのmax増加確認 | 選択肢1件追加、maxSelectionsのmaxがoptionCountと同期 | P1 | none | surveyRenderer.js:394-399 | ※実例なし |
| EDT-016 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 選択肢追加 - dropdown | EDT-008後、dropdown選択肢エリアvisible | 「選択肢を追加」クリック / 追加確認 | `.option-item` 数が1増える | P1 | none | surveyRenderer.js:474-499 | ※実例なし |
| EDT-017 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 必須トグル - single_answer | EDT-006後、設問カード展開 | `.required-checkbox` をオン / checked確認 | requiredCheckboxがchecked、requiredフラグ反映 | P0 | none | surveyRenderer.js:591 | ※JSONにrequiredキーなし ※要確認 |
| EDT-018 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 必須トグル - free_answer | EDT-005後、設問カード展開 | `.required-checkbox` をオン | requiredCheckboxがchecked | P1 | none | surveyRenderer.js:591 | ※同上 |
| EDT-019 | EDT-002 | surveyCreation.html | /survey/{surveyId} | 設問並び替え - 2設問間ドラッグ | 設問2件以上、SortableJS初期化済み | 1番目ハンドルを掴む / 2番目の下にドロップ | `.dragging-item` 付与→ドロップ後にDOM順入替 | P0 | none | surveyCreation.html:42,109-117 | 動的生成のためJSON非依存 |
| EDT-020 | EDT-002 | surveyCreation.html | /survey/{surveyId} | matrix_sa 行追加 | EDT-010後、`.matrix-editor` visible | 「行を追加」クリック / `.matrix-row-item` 追加確認 | 行が1増、placeholderが「行N」形式 | P1 | none | surveyRenderer.js:318-363 | ※実例なし |
| EDT-021 | EDT-002 | surveyCreation.html | /survey/{surveyId} | matrix_sa 列追加 | EDT-010後、`.matrix-editor` visible | 「列を追加」クリック / `.matrix-col-item` 追加確認 | 列が1増、placeholderが「列N」形式 | P1 | none | surveyRenderer.js:369 | ※実例なし |
| EDT-022 | EDT-001 | surveyCreation.html | /survey/{surveyId} | 基本情報保存 - アンケート名入力 | `[data-field-key="surveyName"]` 入力欄あり | `#surveyName_ja` に「テストアンケート」入力 / フォーカス外す | 値が保持、floating labelが上端へ遷移 | P0 | none | surveyCreation.html:146-152 | ※JSONにnameキーなし ※要確認 |
| EDT-023 | EDT-001 | surveyCreation.html | /survey/{surveyId} | 基本情報保存 - 期間入力(flatpickr) | `#periodRange` がflatpickr初期化済み | クリック / 開始2025-04-01選択 / 終了2025-05-31選択 | カレンダー表示→選択後に閉じ、値反映 | P0 | none | surveyRenderer.js:219-224 | populateBasicInfo periodStart/periodEnd |
| EDT-024 | EDT-003 | surveyCreation.html | /survey/{surveyId} | 多言語設定 - 言語タブ切替 | 多言語モード（ja+追加言語）、`.lang-tab` 2つ以上 | enタブをクリック | `.active` 付与、data-lang="en"表示・"ja"非表示 | P0 | none | surveyCreation.html:232-268 | ※多言語起動条件のキー ※要確認 |
| EDT-025 | EDT-003 | surveyCreation.html | /survey/{surveyId} | 多言語設定 - 翻訳参照ヒント表示 | enタブアクティブ、ja欄「性別」入力済、en欄空 | en設問文欄をフォーカス | `.translation-reference-hint`「日本語: 性別」表示、入力で非表示 | P1 | none | surveyRenderer.js:116-132 | ※要確認 |
| EDT-026 | EDT-003 | surveyCreation.html | /survey/{surveyId} | 多言語設定 - 翻訳未完バッジ表示 | en翻訳未入力の設問が1件 | 設問リスト表示 | `.translation-progress-badge` 表示、数値=未翻訳数 | P1 | none | surveyRenderer.js:240-248,270 | ※要確認 |
| EDT-027 | CRT-001 | surveyCreation.html | /survey/create | 新規作成 - 画面初期表示 | createルート相当で開く | ページを開く | 設問リスト空、基本情報フィールド空値 | P0 | none | surveyRenderer.js:35-36 | ※createモード初期化は v2.js ※要確認 |
| EDT-028 | CRT-001 | surveyCreation.html | /survey/create | 新規作成 - タイプ選択メニュー全種表示 | createモードで開く | 設問追加→タイプ選択メニューを開く | `QUESTION_TYPE_ORDER` の10タイプが全件表示、日本語ラベル付き | P0 | none | surveyRenderer.js:48-59,279-295 | I18N.questionTypes.ja で検証 |

## B. QR・回答（QR-002〜004 / ANS-004〜024 / 21件・ANS-008〜010欠番）

| case_id | parentId | screen | route | title | preconditions | steps | expected | priority | sideEffect | evidence | dataSource |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QR-002 | QR-001 | QRモーダル | survey-creation-v2.html | URL表示 | sv_0001_25022読込のアンケート詳細を開く / QRモーダルを開く | QRアイコン押下→モーダル / `#surveyUrlInput` 確認 | `survey-answer.html?surveyId=sv_0001_25022` が表示 | P0 | none | #surveyUrlInput textContent | data/surveys/sv_0001_25022.json |
| QR-003 | QR-001 | QRモーダル | survey-creation-v2.html | URLコピーボタン操作 | QR-002前提、URL表示済 | `#copyUrlBtn` disabled確認 / クリック / トースト確認 | enabled状態、クリック後トースト表示 | P0 | none | トーストDOM / aria-disabled | data/surveys/sv_0001_25022.json |
| QR-004 | QR-001 | QRモーダル | survey-creation-v2.html | QR画像なし時プレースホルダー | qrImageSrc未指定で開く（モック常に画像なし） | モーダルを開く / `#qrCodeImage`/Placeholder/Hint/downloadBtn確認 | image=hidden、placeholder表示、hint="…未設定です…"、downloadはdisabled | P1 | none | classList / aria-disabled | data/surveys/sv_0001_25022.json |
| ANS-004 | ANS-001 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | タイトル・説明文表示 | sv_0001_25022（displayTitle/description.ja設定済） | 開く / `#survey-title-container` 確認 | displayTitleとdescriptionが表示 | P0 | none | #survey-title-container innerHTML | data/surveys/sv_0001_25022.json |
| ANS-005 | ANS-001 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | 設問カード数の一致 | sv_0001_25022（details 10件） | ロード後 `.survey-question-card` を数える | カードが10個レンダリング | P0 | none | querySelectorAll length | data/surveys/sv_0001_25022.json |
| ANS-006 | ANS-001 | 回答画面 | survey-answer.html?surveyId=sv_0001_25056 | 必須バッジ表示 | sv_0001_25056（Q20/Q21/Q22 required:true） | `fieldset[data-question-id="Q20"]` 確認 / `.is-required` と赤spanを確認 | is-required付与、赤い必須スパン表示 | P0 | none | classList / 必須span textContent | data/surveys/sv_0001_25056.json |
| ANS-007 | ANS-001 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | 送信ボタンの存在 | sv_0001_25022 | ロード後 `#submit-survey-button` 確認 | 存在しdisabledでない | P0 | none | #submit-survey-button.disabled | data/surveys/sv_0001_25022.json |
| ANS-011 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | free_answer入力→保持 | sv_0001_25022 / Q2(text→free_answer) | `textarea[name="Q2"]` に"テスト入力です"入力 / value読む | value一致、送信せず値維持 | P0 | none | textarea.value | data/surveys/sv_0001_25022.json |
| ANS-012 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | single_answer 1つ選択→保持 | sv_0001_25022 / Q1(single, 5択) | `radio[name="Q1"][value="満足"]` クリック / checked確認 | 当該radioのみchecked | P0 | none | input.checked | data/surveys/sv_0001_25022.json |
| ANS-013 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | multi_answer 2つ選択→保持 | sv_0001_25022 / Q6(multi, 5択) | `checkbox[name="Q6"][value="SNS"]` と "広告" をクリック / checked確認 | 両方checked | P0 | none | checkbox.checked | data/surveys/sv_0001_25022.json |
| ANS-014 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25056 | dropdown 1つ選択→保持 | sv_0001_25056 / Q22(dropdown) | `select[name="Q22"]` で"主任"(senior_staff)選択 / value確認 | select.value==="senior_staff" | P0 | none | select.value | data/surveys/sv_0001_25056.json |
| ANS-015 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25056 | number_answer 正整数入力→保持 | sv_0001_25056 / Q20(number, min0 max100) | `input[type=number][name="Q20"]` に"42"入力 / value確認 | input.value==="42" | P0 | none | input.value | data/surveys/sv_0001_25056.json |
| ANS-016 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25056 | date_time 有効日付入力→保持 | sv_0001_25056 / Q21(date, inputMode=date) | `input[type=date][name="Q21_date"]` に"2026-03-01"入力 / value確認 | input.value==="2026-03-01" | P0 | none | input.value | data/surveys/sv_0001_25056.json |
| ANS-017 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_26001 | matrix_sa 行×列選択→保持 | sv_0001_26001 / Q8(matrix_sa, 4行×5列) | `radio[name="Q8-r1"][value="5"]` と `[name="Q8-r2"][value="3"]` クリック / checked確認 | 各行で1つずつchecked、同行他はunchecked | P0 | none | input.checked（行単位） | data/surveys/sv_0001_26001.json |
| ANS-018 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_26001 | matrix_ma 行×複数列選択→保持 | sv_0001_26001 / Q11(matrix_ma) | `checkbox[name="Q11-r1-a"]` と `[name="Q11-r1-b"]` クリック / checked確認 | a,b両方checked、他列unchecked | P0 | none | checkbox.checked | data/surveys/sv_0001_26001.json |
| ANS-019 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | 送信→送信モーダル表示 | sv_0001_25022 / 必須なし or 全必須入力済 | `#submit-survey-button` クリック / `#submitting-modal` 確認 | modalがdisplay:flex、`#submitting-text`="送信中..." | P0 | low | #submitting-modal style | data/surveys/sv_0001_25022.json |
| ANS-020 | ANS-002 | 回答画面 | survey-answer.html?surveyId=sv_0001_25022 | プログレスバー 0%→100% | ANS-019成功（モーダル表示中） | `#submitting-progress-bar` のwidthを開始時/完了時に確認 | 0%→100%に達する | P1 | low | progress-bar style.width | data/surveys/sv_0001_25022.json |
| ANS-021 | ANS-003 | 完了画面 | thankYouScreen.html?surveyId=sv_0001_25022 | サンクスメッセージ表示 | thankYouScreen.htmlに直接遷移 | ロード後にメッセージ要素のテキスト確認 | サンクスメッセージ表示（※デフォルト文言は実装確認） | P0 | none | メッセージ textContent | data/surveys/sv_0001_25022.json |
| ANS-022 | ANS-003 | 完了画面 | thankYouScreen.html?surveyId=sv_0001_25022 | 完了アイコン表示 | ANS-021同前提 | 完了アイコン要素の存在確認 | チェックマーク系アイコンが存在 | P1 | none | アイコン要素の存在 | data/surveys/sv_0001_25022.json |
| ANS-023 | ANS-003 | 完了画面(プレビュー) | survey-answer.html?surveyId=sv_0001_25022&preview=1 | プレビューのインライン完了 | preview=1で開く / 必須なしで送信 | `#submit-survey-button` クリック / h2・注記確認 | h2="回答完了"、"プレビューモードのため…送信されていません"注記 | P0 | none | body innerHTML該当箇所 | data/surveys/sv_0001_25022.json |
| ANS-024 | ANS-003 | 完了画面 | thankYouScreen.html | 戻り導線の有無 | thankYouScreen.html実装を確認 | 「戻る」「新しい回答」等の存在確認 | ※要確認: 実装を読みボタンID/テキスト確定後にexpected確定 | P2 | none | ボタン/リンクの存在 | ※要確認 |

## C. ユーザー観点 追加候補（IN-scope 8件）

複数設問をまたぐ操作・順序・継続利用で起きる正常系。設問タイプ単体テストでは抜け落ちやすいもの。

| case_id | parentId | screen | title | steps（要旨） | expected（要旨） | priority | 備考 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ANS-025 | ANS-002 | 回答画面 | free_answer 改行入り長文送信 | textareaに3〜4行・150字超を入力→送信 | 改行が保持され送信、textareaが折返し/リサイズ | P1 | 改行コードのデータ格納 |
| ANS-026 | ANS-002 | 回答画面 | single_answer 値変更後に送信 | Aを選択→Bに変更→送信 | 送信データが最後に選んだ値のみ | P1 | イベント重複登録の検知価値 |
| EDT-029 | EDT-002 | surveyCreation.html | 並び替え後に保存→再読込で順序一致 | 設問5件→3番目と1番目を入替→保存→再読込 | アウトライン順・プレビュー順・保存後順が一致 | P0 | EDT-019の保存往復版 |
| EDT-030 | EDT-002 | surveyCreation.html | 選択肢を後から1つ追加→保存 | 3択を保存→編集に戻り4択目追加→保存 | 回答画面で4択表示、indexずれなし | P1 | 編集操作の独立軸 |
| EDT-031 | EDT-002 | surveyCreation.html | 設問複製→複製側のみ編集→元が不変 | 単一選択を複製→複製側の選択肢編集→元を確認 | 複製元と複製先の選択肢が独立 | P1 | duplicateSurveyModal ※要確認 |
| EDT-032 | CRT-001 | surveyCreation.html | 下書き復元→再開→正式保存 | 作成途中→下書き保存→再アクセス→復元→保存 | 設問数/テキスト/選択肢/タイプが元通り復元 | P1 | draft-restore-modal ※要確認 |
| EDT-033 | EDT-001 | surveyCreation.html | アウトラインジャンプ→該当設問のみ編集→保存 | 20問超→アウトラインで10問目へジャンプ→編集→保存 | スクロール位置と編集対象が一致、他設問不変 | P2 | 非線形ナビゲーション |
| EDT-034 | EDT-002 | surveyCreation.html | matrix行を後から追加→保存 | 3×3保存→編集で4行目追加→保存 | 回答画面で4行表示、列との組合せ全選択可 | P1 | EDT-020の保存往復版 |

## 横断の確認事項・リスク

- **設問タイプのキー表記揺れ**: JSON は `single_choice / text / multi_choice / number / date`、コード（編集側 surveyRenderer.js）は `single_answer` 系。回答側は `normalizeQuestionType()`（survey-answer.js:257）が吸収するが、編集側の差異は未解消。テストずれの火種のため開発確認推奨。
- **正本8種 vs 実コード10種**: `handwriting` / `explanation_card` がコードに存在。テスト対象に含めるか要判断（EDT-028 の期待値は実コードの10種で記述）。
- **fixture寄せで全タイプ網羅**: EDT側「※実例なし」は作成テスト（UIで生成）のため影響小。読込前提のケースは number/date/dropdown=`sv_0001_25056.json`、matrix=`sv_0001_26001.json` に寄せれば全タイプ網羅可能。

## 未確認事項

- `required` / `surveyName` / `displayTitle` 等の JSON キー有無（EDT-013 / 017 / 022）。
- 多言語モードの起動条件キー（EDT-024〜026）。
- create モードの初期化処理（surveyCreation-v2.js / EDT-027）。
- `thankYouScreen.html` のデフォルト文言と戻り導線（ANS-021 / 024）。
- 設問複製・下書き復元の実装有無と挙動（EDT-031 / 032）。
- ANS-008〜010 は欠番（QR・回答グループの連番に空きあり）。
