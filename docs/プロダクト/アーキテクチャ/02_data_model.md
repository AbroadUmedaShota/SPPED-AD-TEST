# データ構造定義書: SpeedAd - フロントエンドモックアップ

## 1. 概要

このドキュメントは、「SpeedAd - アンケート管理ダッシュボード」の**フロントエンドモックアップ開発**で使用される主要なデータオブジェクトの構造を定義します。

本文書で定義されるデータ構造は、`data/` ディレクトリに配置される静的JSONファイルのスキーマとなります。これらは、UI/UXのプロトタイピングを目的としたモックデータであり、将来的なバックエンドAPIのレスポンス形式を想定していますが、現時点でのバックエンドの実装を束縛するものではありません。

## 2. アンケートオブジェクト (`Survey`)

アンケート単体を表すオブジェクトです。主に `data/surveys/surveys.json` に格納されますが、アンケート作成ページでは `data/surveys/` 以下の個別 JSON や localStorage に保存した編集中データを読み込みます。

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | ✅ | アンケートの一意な識別子。フォーマットは `sv_ユーザーID4桁_年度2桁+連番3桁`（JST の作成年＋ゼロ埋め連番）で、システム全体でユニークである必要があります。 | `"sv_0001_24001"` |
| `createdAt` | String | ✅ | アンケートの作成日時。JST で `YYYY-MM-DDTHH:MM:SS+09:00` を使用します。 | `"2025-07-15T00:00:00+09:00"` |
| `groupId` | String | ✅ | アンケートを作成したグループの ID です。 | `"GROUP001"` |
| `name` | Object | ✅ | 社内管理用のアンケート名。言語ごとの名称を格納します。 | `{ "ja": "名称", "en": "Name" }` |
| `displayTitle` | Object | ✅ | アンケート回答画面で表示される正式なタイトル。言語ごとに格納します。 | `{ "ja": "タイトル", "en": "Title" }` |
| `description` | Object | ✅ | アンケートの説明文。言語ごとに格納します。 | `{ "ja": "説明", "en": "Description" }` |
| `status` | String | ✅ | アンケートの現在の状態を示します。 | `"配信中"` |
| `plan` | String | ⬜ | 契約されているプラン名。機能制限などに関わります。（例: `"Standard"`, `"Premium"`, `"Free"`） | `"Standard"` |
| `memo` | String | ⬜ | このアンケートに関する社内向けの自由記述メモです。 | `"〇〇社からの紹介案件。特別対応が必要。"` |
| `periodStart` | String | ✅ | 回答受付期間の開始日です。フォーマットは `YYYY-MM-DD` とします。 | `"2025-07-15"` |
| `periodEnd` | String | ✅ | 回答受付期間の終了日です。フォーマットは `YYYY-MM-DD` とします。 | `"2025-07-17"` |
| `answerCount` | Number | ✅ | 確定済みの総回答数です。 | `125` |
| `realtimeAnswers` | Number | ⬜ | 速報的な回答数です。確定前の集計に利用します。 | `12` |
| `dataCompletionDate` | String | ⬜ | 名刺データ化サービスを利用した場合の、データ化完了予定日または完了日です。 | `"2025-07-20"` |
| `deadline` | String | ⬜ | データダウンロードや各種操作が可能な期限日です。 | `"2025-08-31"` |
| `estimatedBillingAmount` | Number | ⬜ | このアンケートに関する概算の請求金額です。 | `50000` |
| `bizcardEnabled` | Boolean | ✅ | 名刺データ化サービスを利用するかどうかのフラグです。 | `true` |
| `bizcardRequest` | Number | ⬜ | 名刺データ化の依頼枚数です。`bizcardEnabled` が `true` の場合に意味を持ちます。 | `100` |
| `bizcardCompletionCount` | Number | ⬜ | データ化が完了した名刺の枚数です。 | `100` |
| `thankYouEmailSettings` | String | ⬜ | サンクスメールの設定状況を示します。（例: `"設定済み"`, `"未設定"`, `"送信完了"`） | `"設定済み"` |
| `activeLanguages` | Array<String> | ✅ | アンケート作成画面で有効化されている言語コード。`ja` を先頭に最大 3 件まで保持し、保存時にも配列を維持します。 | `["ja", "en"]` |
| `editorLanguage` | String | ✅ | 現在編集中の言語コード。`activeLanguages` のいずれかであり、UI のタブ状態を復元するために保持します。 | `"ja"` |
| `questionGroups` | Array<QuestionGroup> | ✅ | 設問グループの配列。空配列を許容します。詳細は後述。 | `[ ... ]` |

### 多言語フィールドのルール
- `name` / `displayTitle` / `description` / `memo` / 各設問や選択肢の `text` は、言語コードをキーにしたオブジェクトで保持します。
- `ja`（日本語）は常に存在させ、その他の言語は `activeLanguages` に応じて追加します。
- 編集中に未翻訳の場合は空文字列を保持し、UI では日本語値をプレースホルダーとして参照します。

### QuestionGroup オブジェクト

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `groupId` | String | ✅ | 設問グループの一意な識別子。`group_${timestamp}` 形式などを使用します。 | `"group_1720585320000"` |
| `title` | Object | ✅ | グループ見出しの多言語文言。 | `{ "ja": "基本情報", "en": "Basics" }` |
| `questions` | Array<Question> | ✅ | グループに所属する設問の配列。空配列を許容します。 | `[ ... ]` |

### Question オブジェクト

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `questionId` | String | ✅ | 設問の一意な ID。`q_${timestamp}` 形式を利用します。 | `"q_1720585400123"` |
| `type` | String | ✅ | 設問タイプ。`free_answer` / `single_answer` / `multi_answer` / `number_answer` / `matrix_sa` / `matrix_ma` / `date_time` / `handwriting` を利用します。 | `"single_answer"` |
| `text` | Object | ✅ | 設問本文の多言語文言。 | `{ "ja": "年齢を教えてください", "en": "What is your age?" }` |
| `required` | Boolean | ✅ | 必須設問かどうか。未指定時は `false`。 | `true` |
| `options` | Array<Option> | ⬜ | 単一・複数選択設問で使用する選択肢。その他のタイプでは省略します。 | `[ ... ]` |
| `matrix` | MatrixConfig | ⬜ | マトリクス設問で使用する行・列定義。その他のタイプでは省略します。 | `{ "rows": [ ... ], "cols": [ ... ] }` |
| `meta` | Object | ⬜ | タイプ専用の追加設定。詳細は後述。 | `{ "validation": { ... } }` |

### Option オブジェクト

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `optionId` | String | ⬜ | 選択肢の一意な ID。未設定時は UI 側で生成します。 | `"opt_q_1720585400123_1"` |
| `text` | Object | ✅ | 選択肢ラベルの多言語文言。 | `{ "ja": "満足", "en": "Satisfied" }` |

### MatrixConfig オブジェクト

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `rows` | Array<MatrixAxisItem> | ✅ | 行（質問文）の集合。 | `[ ... ]` |
| `cols` | Array<MatrixAxisItem> | ✅ | 列（選択肢）の集合。 | `[ ... ]` |

#### MatrixAxisItem

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `text` | Object | ✅ | 行または列で表示する文言。 | `{ "ja": "品質", "en": "Quality" }` |
| `itemId` | String | ⬜ | 行・列の一意な識別子。外部システムから取り込む場合に使用します。 | `"row_1"` |

### 設問メタデータ (`meta`)

設問タイプごとの追加設定は `question.meta` に格納します。タイプ変更時には不要なキーを削除し、整合性を保ちます。

#### 数値設問 (`meta.validation.numeric`)

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `mode` | String | ✅ | 入力モード。`integer` または `decimal`。 | `"integer"` |
| `min` | Number \| String | ⬜ | 最小値。未設定時は空文字列を保持します。 | `0` |
| `max` | Number \| String | ⬜ | 最大値。未設定時は空文字列を保持します。 | `120` |
| `precision` | Number \| String | ⬜ | 小数点以下桁数。`decimal` のときのみ有効。 | `1` |
| `step` | Number \| String | ⬜ | 入力ステップ値。空文字列で任意入力を許可します。 | `0.5` |
| `unitLabel` | String | ⬜ | 単位を表すラベル。 | `"歳"` |
| `unitSystem` | String | ⬜ | 単位系。`metric`（既定）または `imperial`。 | `"metric"` |

#### 日時設問 (`meta.dateTimeConfig`)

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `inputMode` | String | ✅ | 入力方式。`date` / `datetime` / `time`。 | `"date"` |
| `timezone` | String | ✅ | タイムゾーン ID。既定は `Asia/Tokyo`。 | `"Asia/Tokyo"` |
| `minDateTime` | String | ⬜ | 選択可能な最小日時（ISO 8601 形式）。 | `"2025-07-01T00:00"` |
| `maxDateTime` | String | ⬜ | 選択可能な最大日時（ISO 8601 形式）。 | `"2025-07-31T23:59"` |
| `allowPast` | Boolean | ✅ | 過去日時を許可するか。既定は `true`。 | `true` |
| `allowFuture` | Boolean | ✅ | 未来日時を許可するか。既定は `true`。 | `true` |

#### 手書き設問 (`meta.handwritingConfig`)

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `canvasWidth` | Number \| String | ✅ | キャンバス幅（px）。未入力時は 600。 | `600` |
| `canvasHeight` | Number \| String | ✅ | キャンバス高（px）。未入力時は 200。 | `200` |
| `penColor` | String | ✅ | ペン色。HEX カラーコードを想定。 | `"#000000"` |
| `penWidth` | Number \| String | ✅ | ペン太さ。未入力時は 2。 | `2` |
| `backgroundPattern` | String | ✅ | 背景パターン。`plain` / `grid` など UI で許容する値。 | `"plain"` |

## 3. ユーザーオブジェクト (`User`)

ログインしているユーザーの情報を表すオブジェクトです。`accountInfoModal` などで利用されます。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `email` | String | ✅ | ログインIDとなるメールアドレスです。 |
| `companyName` | String | ⬜️ | ユーザーが所属する会社名です。 |
| `departmentName` | String | ⬜️ | 部署名です。 |
| `positionName` | String | ⬜️ | 役職名です。 |
| `lastName` | String | ✅ | 姓。 |
| `firstName` | String | ✅ | 名。 |
| `phoneNumber` | String | ✅ | 連絡先電話番号です。 |
| `postalCode` | String | ✅ | 郵便番号です（ハイフン含む・含まないは別途規定）。 |
| `address` | String | ✅ | 住所（都道府県、市区町村、番地）。 |
| `buildingFloor` | String | ⬜️ | 建物名、部屋番号など。 |
| `billingAddressType`| String | ✅ | 請求先情報の種類。`"same"`（上記と同じ）または `"different"`（異なる）のいずれか。 |
| `billingCompanyName`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先会社名。 |
| `billingDepartmentName`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先部署名。 |
| `billingLastName` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先担当者（姓）。 |
| `billingFirstName` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先担当者（名）。 |
| `billingPhoneNumber`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先電話番号。 |
| `billingPostalCode` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先郵便番号。 |
| `billingAddress` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先住所。 |
| `billingBuildingFloor`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先建物名など。 |

---

## 4. グループオブジェクト (`Group`)

ユーザーが所属するグループの情報を表すオブジェクトです。`newGroupModal` などで利用されます。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | String | ✅ | グループの一意な識別子。 |
| `name` | String | ✅ | グループ名。 |
| `description` | String | ⬜️ | グループの目的などを示す説明文。 |
| `members` | Array<Member> | ✅ | このグループに所属するメンバーのリスト。下記 `Member` オブジェクトの配列です。 |

### 4.1. メンバーオブジェクト (`Member`)

`Group` オブジェクトの `members` プロパティに含まれる、個々のメンバーを表すオブジェクトです。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `email` | String | ✅ | メンバーのメールアドレス。 |
| `role` | String | ✅ | メンバーの役割（権限）。`"admin"`（管理者）または `"member"`（一般メンバー）のいずれか。 |

---

### 5.1. テーブル一覧

| No | 物理テーブル名 | 備考 |
| :--- | :--- | :--- |
| 1 | `speedad.admin_user` |  |
| 2 | `speedad.answer` | アンケート回答 |
| 3 | `speedad.answer_detail` |  |
| 4 | `speedad.corporate` | 企業(有料機能利用時に登録) |
| 5 | `speedad.corporate_assign` |  |
| 6 | `speedad.coupon` |  |
| 7 | `speedad.coupon_detail` |  |
| 8 | `speedad.groups` | オペレーターが所属するグループ情報管理 |
| 9 | `speedad.input_business_cards` | OCR, オペレーターなど、アンケート回答者以外が入力した名刺情報を管理するテーブル。 |
| 10 | `speedad.invoice` |  |
| 11 | `speedad.m_business_card_groups` | 名刺入力のグループ管理マスターテーブル |
| 12 | `speedad.m_business_day` |  |
| 13 | `speedad.m_business_day2` |  |
| 14 | `speedad.m_reward_rates` | 報酬レートマスターテーブル |
| 15 | `speedad.m_templates` |  |
| 16 | `speedad.mail_templates` |  |
| 17 | `speedad.reward_histories` | 報酬履歴 |
| 18 | `speedad.survey` |  |
| 19 | `speedad.survey_detail` |  |
| 20 | `speedad.token_password_reset` |  |
| 21 | `speedad.token_tmp_register` |  |
| 22 | `speedad.users` |  |

### 5.2. テーブル詳細

#### `speedad.admin_user`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | `int auto_increment` | Yes (PK) | `` |  |
| 2 | `login_id` | `text` | Yes | `` |  |
| 3 | `password` | `text` | Yes | `` |  |
| 4 | `authority` | `int` | Yes | `` | 管理画面権限(MasterAdmin:1, Admin:2, Operator:3, Operator_Admin:4) |
| 5 | `company_name` | `text` | Yes | `` |  |
| 6 | `group_id` | `int` |  | `` | 所属グループID (operetor, operetor_adminがどのグループに所属しているかを判定するためのID) |
| 7 | `user_post` | `text` | Yes | `` |  |
| 8 | `user_name` | `text` | Yes | `` |  |
| 9 | `status` | `int` | Yes | `` | 0:稼働 1:停止 |
| 10 | `create_date` | `text` | Yes | `` |  |
| 11 | `last_login_at` | `datetime` |  | `` | 最終ログイン日時 |
| 12 | `created_at` | `datetime` |  | `CURRENT_TIMESTAMP` |  |
| 13 | `updated_at` | `datetime` |  | `CURRENT_TIMESTAMP` |  |

**インデックス情報**

| No | インデックス名 | カラム | 主キー | ユニーク |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `PRIMARY` | `id` | Yes | Yes |

---
#### `speedad.answer`

アンケート回答

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | `int auto_increment` | Yes (PK) | `` | 回答アンケートID |
| 2 | `survey_id` | `int` | Yes | `` |  |
| 3 | `photo_1` | `text` |  | `` | 名刺画像表面パス |
| 4 | `photo_2` | `text` |  | `` | 名刺画像裏面パス |
| 5 | `company_name` | `text` |  | `` | 名刺情報(会社名)※手入力用 |
| 6 | `busyo_name` | `text` |  | `` | 名刺情報(部署名)※手入力用 |
| 7 | `yakusyoku_name` | `text` |  | `` | 名刺情報(役職名)※手入力用 |
| 8 | `name` | `text` |  | `` | 名刺情報(氏名)※手入力用 |
| 9 | `email` | `text` |  | `` | 名刺情報(メールアドレス)※手入力用 |
| 10 | `tel` | `text` |  | `` | 名刺情報(電話番号)※手入力用 |
| 11 | `zip_code` | `text` |  | `` | 名刺情報(郵便番号)※手入力用 |
| 12 | `address` | `text` |  | `` | 名刺情報(住所)※手入力用 |
| 13 | `test_flag` | `int` |  | `` | テスト回答フラグ(1:テスト回答) |
| 14 | `mail_flag` | `int` | Yes | `1` | 0:送信しない 1:送信する |
| 15 | `corrected_first_name` | `varchar(255)` |  | `` |  |
| 30 | `created_at` | `datetime` |  | `CURRENT_TIMESTAMP` |  |
| 31 | `updated_at` | `datetime` |  | `CURRENT_TIMESTAMP` |  |

**インデックス情報**

| No | インデックス名 | カラム | 主キー | ユニーク |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `PRIMARY` | `id` | Yes | Yes |

---
#### `speedad.answer_detail`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | `int auto_increment` | Yes (PK) | `` | アンケート詳細ID |
| 2 | `survey_detail_id` | `int` | Yes | `` |  |
| 3 | `answer` | `text` |  | `` | 回答内容 |
| 4 | `answer_free_text` | `longtext` |  | `` | その他回答時のフリーテキスト |
| 5 | `test_flag` | `tinyint` |  | `` | テスト回答フラグ (1:テスト回答) |
| 6 | `created_at` | `datetime` |  | `` |  |
| 7 | `updated_at` | `datetime` |  | `` |  |

**インデックス情報**

| No | インデックス名 | カラム | 主キー | ユニーク |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `PRIMARY` | `id` | Yes | Yes |

---
#### `speedad.corporate`

企業(有料機能利用時に登録)

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | `int auto_increment` | Yes (PK) | `` |  |
| 2 | `corporate_name` | `text` |  | `` | 会社名 |
| 11 | `group_flag` | `int` | Yes | `0` | 0:個人,1:グループ |
| 12 | `seikyu_flag` | `tinyint` |  | `` | 請求フラグ(0:上記と同じ, 1:上記と異なる) |

**インデックス情報**

| No | インデックス名 | カラム | 主キー | ユニーク |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `PRIMARY` | `id` | Yes | Yes |

---
#### `speedad.corporate_assign`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `user_id` | `int` | Yes | `` |  |
| 3 | `authority` | `int` | Yes | `` | 1:管理,2:ユーザー |
| 4 | `status` | `int` | Yes | `` | 0:所属,99:脱退済 |

---
#### `speedad.coupon`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `name` | `varchar(128)` | Yes | `` | クーポン名 |
| 4 | `expire_date` | `date` |  | `` | 使用可能期限 |
| 5 | `discount_rate` | `float` | Yes | `` | 割引率(%) |

---
#### `speedad.coupon_detail`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `coupon_id` | `text` | Yes | `` | 親クーポンID |
| 3 | `code` | `text` | Yes | `` | クーポンコード |
| 4 | `used_date` | `date` |  | `` | 使用日(使用日が入力されている=使用済み) |

---
#### `speedad.groups`

オペレーターが所属するグループ情報管理

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `name` | `varchar(255)` | Yes | `` | グループ名称 |

**インデックス情報**

| No | インデックス名 | カラム | 主キー | ユニーク |
| :--- | :--- | :--- | :--- | :--- |
| 2 | `id_UNIQUE` | `id` |  | Yes |
| 3 | `name_UNIQUE` | `name` |  |  |

---
#### `speedad.input_business_cards`

OCR, オペレーターなど、アンケート回答者以外が入力した名刺情報を管理するテーブル。

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `answer_id` | `int` | Yes | `` | どの名刺データに対してのデータ入力かを示すアンケート回答ID |
| 6 | `is_skipped` | `tinyint` |  | `0` | スキップしたかどうか。(TRUE:スキップした) |
| 9 | `is_corrected` | `tinyint` |  | `0` | 運営者確認結果と一致しているか(TRUE:正解) |
| 11 | `created_by` | `int` |  | `` | 作成者ID (ID=0をOCR入力とみなす) |

---
#### `speedad.invoice`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `corporate_id` | `int` | Yes | `` |  |
| 11 | `all_fee` | `int` | Yes | `` |  |

---
#### `speedad.m_business_card_groups`

名刺入力のグループ管理マスターテーブル

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | `int auto_increment` | Yes (PK) | `` |  |
| 2 | `name` | `varchar(255)` |  | `` | 名刺データ入力グループ名 |

---
#### `speedad.m_business_day`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4 | `holiday` | `int` | Yes | `` | 祝日 |

---
#### `speedad.m_business_day2`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `holiday_date` | `date` | Yes | `` |  |

---
#### `speedad.m_reward_rates`

報酬レートマスターテーブル

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `rate` | `float` | Yes | `` | 1件当たりの報酬額(単位:円) |
| 3 | `description` | `varchar(45)` |  | `` | 説明文 |

---
#### `speedad.m_templates`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `template_subject` | `text` | Yes | `` |  |

---
#### `speedad.mail_templates`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `corporate_id` | `int` | Yes | `` |  |

---
#### `speedad.reward_histories`

報酬履歴

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `user_id` | `int` | Yes | `` | オペレーターID |
| 4 | `rate_id` | `float` | Yes | `` | 該当年月の報酬額計算時に利用された報酬レート(単位:件) |

---
#### `speedad.survey`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `create_group_id` | `int` |  | `` | 作成グループID |
| 4 | `status` | `tinyint` | Yes | `` | 作業ステータス (1:会期前, 2:会期中, 3:データ化中, 4:アップ待ち, 5:アップ完了, 6:データ化なし) |
| 16 | `data_flag` | `tinyint` | Yes | `1` |  |
| 19 | `data_count` | `int` | Yes | `100` | データ化想定件数 |
| 21 | `seikyu_status` | `tinyint` |  | `` | 請求ステータス (0:請求対象外, 1:0円請求, 2:請求前, 3:請求後, 4:入金完了, 5:未納) |
| 27 | `exceeded` | `int` | Yes | `0` | 超過メールフラグ 0:未 1:80%送信済 99:100%送信済 |
| 31 | `survey_mail_flag` | `int` | Yes | `0` | 0:未送信 1:送信済 |

---
#### `speedad.survey_detail`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `survey_id` | `int` | Yes | `` | アンケートID |
| 4 | `type` | `int` | Yes | `` | アンケート種別 (1:シングルアンサー, 2:マルチアンサー, 3:フリーアンサー, 4:年月, 5:時間, 6:年月と時間, 7:マトリックス(シングルアンサー), 8:マトリックス(マルチアンサー)) |
| 9 | `answer_max_count` | `int` |  | `999` | 複数選択可能な項目の際の回答上限。999(=いくつでも) |

---
#### `speedad.token_password_reset`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `login_id` | `text` | Yes | `` |  |

---
#### `speedad.token_tmp_register`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4 | `corporate_id` | `int` | Yes | `0` | ループから招待した時用 |

---
#### `speedad.users`

**カラム情報**

| No | 物理名 | データ型 | Not Null | デフォルト | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 | `email` | `text` | Yes | `` |  |
| 4 | `corporate_ids` | `text` |  | `` | 所属企業ID。複数所属を許容するため、カンマ区切りのテキストで保持。※1stリリース時は複数所属なし |
| 6 | `manage_flag` | `tinyint` | Yes | `` | 管理フラグ (0:フラグ無, 1:重要, 2:要注意, 99:関係者) |

## 6. 名刺オブジェクト (`BusinessCard`)

`speed-review`画面などで利用される名刺情報を表すオブジェクトです。主に `data/responses/business-cards.json` に格納されます。

| プロパティ名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `answerId` | String | 対応するアンケート回答のID。 |
| `imageUrl` | Object | 名刺画像のURL。`{ "front": "...", "back": "..." }` の形式。 |
| `group1` - `group8` | Object | 名刺の項目グループ。各グループが特定の情報（メール、氏名、会社情報など）を持つ。 |

---

## 7. 請求書オブジェクト (`Invoice`)

請求情報の一覧や詳細画面で利用されるオブジェクトです。主に `data/core/invoices.json` に格納されます。

| プロパティ名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `invoiceId` | String | 請求書の一意なID。 |
| `accountId` | String | 請求先アカウントのID。 |
| `issueDate` | String | 発行日 (`YYYY-MM-DD`)。 |
| `dueDate` | String | 支払期日 (`YYYY-MM-DD`)。 |
| `corporateName` | String | 請求先企業名。 |
| `totalAmount` | Number | 合計請求額。 |
| `items` | Array<Object> | 請求項目の配列。 |

---

## 8. アンケート回答オブジェクト (`SurveyAnswer`)

アンケートの個別の回答データを表すオブジェクトです。主に `data/responses/survey-answers.json` に格納されます。

| プロパティ名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `answerId` | String | 回答の一意なID。 |
| `surveyId` | String | 対応するアンケートのID。 |
| `answeredAt` | String | 回答日時。 |
| `isTest` | Boolean | テスト回答かどうかのフラグ。 |
| `details` | Array<Object> | 質問と回答のペアの配列。`{ "question": "...", "answer": "..." }` の形式。 |

