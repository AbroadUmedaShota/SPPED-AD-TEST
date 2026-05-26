# アンケートの表示権限

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1165892`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2026-01-15T05:44:14Z`
- created: `2026-01-15T05:44:14Z`

## Original Content
| 変数 | 名称（役割） | 取得元 | 取得方法/場所 |
|---|---|---|---|
| `session_corporate_ids` | 現在選択中の企業/グループID | セッション | `session()->get('corporate_ids')`（`SurveyController@index` 冒頭で `null` の場合 `Auth::id()` をセット） |
| `Auth::id()` | ログインユーザーID | 認証 | `Illuminate\Support\Facades\Auth` |
| `Auth::user()->corporate_ids` | ユーザーに紐づく企業ID | DB（users） | `users.corporate_ids` |
| `group_flag` | 個人アカウントと紐づく企業レコード | DB（corporate） | `Corporate::where('group_flag', 0)->where('id', Auth::user()->corporate_ids)->first()` |
| `group_flag.id` | 個人アカウントの企業ID | `group_flag` | `group_flag->id` |
| `survey.user_id` | アンケートの所有者ユーザーID | DB（surveys） | `surveys.user_id` |
| `survey.create_group_id` | アンケートの作成グループID | DB（surveys） | `surveys.create_group_id` |

# 判定ルール（一覧表示）

前提: `session('corporate_ids')` が `null` の場合は `Auth::id()` をセット。

## A. ユーザーに会社情報がない場合（`Auth::user()->corporate_ids` が未設定）
- **A1: 選択中グループが個人（`session_corporate_ids == Auth::id()`）**
  - 表示条件: 「ログインユーザー本人が所有するアンケート」
- **A2: 選択中グループが特定グループ（`session_corporate_ids != Auth::id()`）**
  - 表示条件: 「選択中グループで作成されたアンケート」

## B. ユーザーに会社情報がある場合（`Auth::user()->corporate_ids` が設定済み）
- **B1: 選択中グループが個人（`session_corporate_ids == Auth::id()`）**
  - 表示条件:
    - 「個人所属の企業（`group_flag`）で作成されたアンケート」
    - もしくは「`create_group_id` が `NULL` で、ログインユーザー本人が所有するアンケート」
- **B2: 選択中グループが個人所属の企業（`session_corporate_ids == group_flag.id`）**
  - 表示条件:
    - 「個人所属の企業（`group_flag`）で作成されたアンケート」
    - もしくは「`create_group_id` が `NULL` で、ログインユーザー本人が所有するアンケート」
- **B3: 選択中グループが特定グループ（`session_corporate_ids` が `group_flag.id` 以外）**
  - 表示条件: 「選択中グループで作成されたアンケート」


# 判定ルール（アクセス許可）

## A. ユーザーに会社情報がない場合（`Auth::user()->corporate_ids` が未設定）
- 許可条件:
  - 「ログインユーザー本人が所有するアンケート」
  - もしくは「ユーザーが所属するグループで作成されたアンケート」

## B. ユーザーに会社情報がある場合（`Auth::user()->corporate_ids` が設定済み）
- 許可条件:
  - 「ログインユーザー本人が所有するアンケート」
  - もしくは「ユーザーの `corporate_ids` と一致するグループで作成されたアンケート」
  - もしくは「ユーザーが所属するグループで作成されたアンケート」

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
