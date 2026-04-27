---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# グループ編集画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/group-edit.html`（241 行）と `02_dashboard/src/groupEdit.js`（559 行、`initGroupEditPage()` を `export`）、関連サービス `02_dashboard/src/groupService.js`（90 行、`data/core/groups.json` を fetch するが本画面では **未使用**）、関連モーダル `02_dashboard/modals/newGroupModal.html` / `02_dashboard/src/groupManagementModal.js` / `02_dashboard/modals/memberDetailModal.html`。本書はこれら現行実装を根拠にする「実装トレースドキュメント」である。
> - 旧 v1.x までは「本書が正、モックは参考」の抽象記述であり、`URL ?groupId` による初期選択・ドラッグハンドルによる手動並べ替え・データ読み込みエラー処理・サーバ保存・アカウントに紐づく請求先取得など、**現行実装に一切存在しない機能を要件化していた**。これらは §11 将来計画として切り出し、本版は画面実装を正本にする方針へ刷新した。
> - グループデータは `initGroupEditPage()` 内で `GROUP001`/`GROUP002`/`GROUP003` の 3 件を **ハードコード**し、各 20 名のダミーメンバーを `generateDummyMembers()` で毎回生成する。`groupService.js` が存在するが `group-edit.html` 画面側からは **一切呼ばれていない**（§11 最重要）。
> - `groups.json` の `personal`/`group_sales`/`group_marketing`/`group_bpo` と、本画面のハードコード ID `GROUP001`/`GROUP002`/`GROUP003` は **ID 体系が一致しない**。`groupSelector` の初期オプションは HTML 直書き（[group-edit.html:62-66](../../../02_dashboard/group-edit.html#L62)）。
> - Sortable.js を CDN 経由で読み込み、`.sortable-ghost` / `.drag-handle` の CSS も定義しているが、JS 側で `new Sortable()` を呼ばずクラスも付与されていない。完全な **デッドコード**（§11-3）。
> - 保存は `console.log('Saving data:', dataToSave)` + `setDirty(false)` のみのモック。`groupService.updateGroup()` も呼び出されない（§11-2）。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§9 / §11 に集約。 |

### 1.2 目的・想定利用者

自分が所属または管理する「グループ」単位で、以下を一画面で確定させる。

- グループの基本情報（名称・説明文）の編集
- グループ単位の請求先切替（アカウント作成者既定 / グループ専用）
- グループに所属するメンバーの招待・権限変更・削除・表示並び替え

想定利用者:

- グループ管理者: サイドバー / ユーザーメニューから本画面に遷移し、自分が管理するグループのメンバー構成と請求情報を管理する。
- 一般メンバーは本画面へのアクセス権を持たない想定だが、URL 直打ちによる閲覧制御は未実装（§11-9）。

### 1.3 グループとは（実装観点の定義）

`tooltipContent.groupOverview`（[tooltipContent.js:85-94](../../../02_dashboard/src/services/tooltipContent.js#L85)）に定義されたグループ概念の要約:

- アンケートを複数名で編集できる共同作業単位。作成者がグループ管理者になる。
- 管理者を含め 2 名までは無料、3 人目以降は 1 名あたり月額 100 円（＋税）。
- グループ内で作成したアンケートに関わる費用（名刺データ化費・アカウント料）は **グループ管理者宛** に一括請求される。
- 個人ページとグループページはサイドバーから切替える。

本画面は上記のうち「グループのメタ情報・メンバー・請求先」を編集する窓口。アンケート本体の作成・編集は `surveyCreation.html` / `surveyCreation-v2.html` 側で完結する。

### 1.4 対象範囲 / 対象外

**対象**: `02_dashboard/group-edit.html` / `02_dashboard/src/groupEdit.js` / `02_dashboard/modals/memberDetailModal.html` / `02_dashboard/modals/newGroupModal.html`（本画面から起動しないが関連記述）/ `02_dashboard/src/groupManagementModal.js`（同）。

**対象外**（§11 参照のみ）: サーバサイドのグループ永続化 API / `data/core/groups.json` の実運用スキーマ / 個人/グループ切替（サイドバー `accountSwitcher` 側）の UI フロー / 管理者画面 `admin/user_management` のグループ管理機能。

### 1.5 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§11 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| ハードコード グループ ID | `GROUP001` / `GROUP002` / `GROUP003` | [group-edit.html:63-65](../../../02_dashboard/group-edit.html#L63) / [groupEdit.js:504-527](../../../02_dashboard/src/groupEdit.js#L504) |
| 初期選択グループ | `elements.groupSelector.value`（= HTML で `selected` の `GROUP001`） | [groupEdit.js:555](../../../02_dashboard/src/groupEdit.js#L555) |
| ダミーメンバー生成数 | 各グループ 20 名 | [groupEdit.js:510,518,526](../../../02_dashboard/src/groupEdit.js#L510) |
| ログインユーザー email | `user0@example.com`（管理者として全グループに unshift） | [groupEdit.js:530-547](../../../02_dashboard/src/groupEdit.js#L530) |
| 既定権限オプション | `member`（一般） / `admin`（管理者） | [group-edit.html:170-171](../../../02_dashboard/group-edit.html#L170) |
| メンバーカード権限選択肢 | `管理者` / `一般`（文字列） | [groupEdit.js:74](../../../02_dashboard/src/groupEdit.js#L74) |
| ステータス種別 | `グループ加入済` / `グループ招待中` / `アドレスエラー` | [groupEdit.js:77-86](../../../02_dashboard/src/groupEdit.js#L77) |
| アバター URL | `https://i.pravatar.cc/40?u={email}` | [groupEdit.js:368,484](../../../02_dashboard/src/groupEdit.js#L368) |
| メール形式チェック | `/\S+@\S+\.\S+/` | [groupEdit.js:357](../../../02_dashboard/src/groupEdit.js#L357) |
| メンバー詳細モーダルプレースホルダー | `#memberDetailModal-placeholder` | [group-edit.html:234](../../../02_dashboard/group-edit.html#L234) |
| 保存ボタン初期状態 | `disabled` | [group-edit.html:222](../../../02_dashboard/group-edit.html#L222) |
| Sortable.js CDN | `sortablejs@1.15.0` | [group-edit.html:237](../../../02_dashboard/group-edit.html#L237) |
| **`?groupId` クエリによる初期選択** | **未実装**（URL パラメータ読取なし） | §11-1 |
| **ドラッグハンドル並び替え** | **未実装**（Sortable 初期化なし） | §11-3 |
| **実サーバ保存** | **モック**（console.log のみ） | [groupEdit.js:406](../../../02_dashboard/src/groupEdit.js#L406) / §11-2 |
| **`groupService` 連携** | **未呼出**（本画面は独自ハードコード） | §11-4 |
| **読み込みエラーハンドリング** | **未実装** | §11-5 |

---

## 2. 対象画面・関連ファイル

| ファイル | 役割 | 行数 |
|----------|------|------|
| [group-edit.html](../../../02_dashboard/group-edit.html) | 単一ページ HTML | 241 |
| [groupEdit.js](../../../02_dashboard/src/groupEdit.js) | `initGroupEditPage()` 本体、DOM 参照・state・イベント・モックデータ生成 | 559 |
| [groupService.js](../../../02_dashboard/src/groupService.js) | `fetchGroups()` / `createGroup()` / `updateGroup()` / `deleteGroup()` / `getGroupsInMemory()`。本画面からは **未呼出** | 90 |
| [modals/newGroupModal.html](../../../02_dashboard/modals/newGroupModal.html) | グループ新規作成モーダル | 76 |
| [src/groupManagementModal.js](../../../02_dashboard/src/groupManagementModal.js) | `initGroupManagementModal()`、上記モーダル専用 | 260 |
| [modals/memberDetailModal.html](../../../02_dashboard/modals/memberDetailModal.html) | メンバー詳細モーダル | 18 |

**ルーティング**: [main.js:33](../../../02_dashboard/src/main.js#L33) で import、[main.js:450-452](../../../02_dashboard/src/main.js#L450) で `case 'group-edit.html': initGroupEditPage();`。

**パンくず**: [breadcrumb.js:39-42](../../../02_dashboard/src/breadcrumb.js#L39) 「アンケート一覧 > グループ編集」。画面タイトルは「グループ管理」でパンくずとの不一致あり（§11-12）。

**依存 CDN / CSS**（[group-edit.html:8-16](../../../02_dashboard/group-edit.html#L8)）: Tailwind CDN（`plugins=forms,container-queries`）/ Material Icons / `service-top-style.css` / Google Fonts Inter / Noto Sans JP / Sortable.js 1.15.0（[group-edit.html:237](../../../02_dashboard/group-edit.html#L237)、**使用箇所なし** §11-3）。

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。ハードコード 3 グループ・ダミーメンバー生成・`groupService` 未呼出・Sortable デッドコード・`?groupId` パラメータ不在・ページタイトル不一致などの実装ギャップを §11 将来計画に集約。v1.x 以前の抽象要件（ドラッグハンドル並べ替え、URL パラメータ指定、エラーメッセージ中央表示など）は画面実装に存在しないため v2.0 で削除。
- v1.x (〜 2025-10-04): 本番要件を先行定義した抽象的仕様書。実装未到達の機能を多数含んでいたため v2.0 で全削除または §11 送り。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`body.bg-background[data-page-id="group-management"]` 直下はダッシュボード共通の 2 カラム構造。メイン領域 `<main id="main-content">` は最大幅 `max-w-4xl`（= 896px）で中央寄せ、内部は縦 1 カラム。

```
<body class="bg-background text-on-background" data-page-id="group-management">
├── #mobileSidebarOverlay                       … モバイル用サイドバーオーバーレイ
├── #header-placeholder                         … 共通ヘッダー注入
└── <div class="flex flex-1 pt-16 bg-background">
    ├── #sidebar-placeholder                    … 共通サイドバー注入
    └── <main id="main-content">
        └── <div class="max-w-4xl mx-auto">
            ├── #breadcrumb-container            … パンくず注入（§2）
            ├── 画面ヘッダー
            │   ├── <h1>グループ管理</h1> + ヘルプトリガ (data-help-key="groupOverview")
            │   └── #groupSelector               … <select> 編集対象切替（3 件ハードコード）
            └── .space-y-6 (セクション群)
                ├── グループ情報セクション (.section-card, aria-expanded="true")
                │   ├── #groupName (input, required)
                │   ├── #groupNameError (.hidden)
                │   └── #groupDescription (textarea)
                ├── 請求先情報セクション (.section-card, aria-expanded="true")
                │   ├── 切替ボタン
                │   │   ├── #use-creator-billing-btn
                │   │   └── #use-group-billing-btn
                │   ├── #creator-billing-info    … 読取専用、作成者情報を表示
                │   └── #group-billing-info (.hidden 初期)
                │       ├── #group-billing-display
                │       │   └── #edit-group-billing-btn
                │       └── #group-billing-form (.hidden 初期)
                │           ├── 5 フィールド (contact-name / department / phone / postal-code / address1)
                │           ├── #cancel-group-billing-btn
                │           └── #save-group-billing-btn
                └── メンバー管理セクション (.section-card, aria-expanded="true")
                    ├── 招待エリア
                    │   ├── #newMemberEmail + #newMemberEmailError
                    │   ├── #newMemberRole (<select>: member / admin)
                    │   └── #add-member-btn
                    ├── 一覧ヘッダー
                    │   ├── ラベル「並び替え:」
                    │   ├── #sort-by-role-btn + #sort-indicator-role
                    │   ├── #sort-by-status-btn + #sort-indicator-status
                    │   └── #reset-sort-btn
                    └── #member-list             … 20 件カード（.member-card, data-member-id=email）
└── フッター
    ├── #cancel-btn
    └── #save-btn (disabled 初期)

#confirmationModal-placeholder                   … 動的注入
#memberDetailModal-placeholder                   … 動的注入
#footer-placeholder
```

### 4.2 レスポンシブ挙動

- コンテナ `.max-w-4xl mx-auto` は全ブレイクポイント共通、横幅は常にフルまたは 896px 上限。
- 画面ヘッダーの `flex-wrap` で SP は縦積み、画面タイトル行と `#groupSelector` が 2 行に分かれる（[group-edit.html:55](../../../02_dashboard/group-edit.html#L55)）。
- 請求先フォーム `#group-billing-form` は `sm:` ブレイクポイントで 2 列グリッド、モバイルは 1 列（[group-edit.html:135](../../../02_dashboard/group-edit.html#L135)）。
- 招待エリアは `flex-wrap items-baseline gap-4 md:flex-nowrap`。md 未満では `w-full` 招待ボタンが 3 行目に折り返る（[group-edit.html:162](../../../02_dashboard/group-edit.html#L162)）。
- メンバーカードは常に横並び（`flex items-center gap-4`）、狭幅での挙動は未検証（§11-13）。
- フッター保存エリアは `sticky bottom-0` + `backdrop-blur-sm`（[group-edit.html:220](../../../02_dashboard/group-edit.html#L220)）。

### 4.3 セクション詳細

**画面ヘッダー**: `<h1>` 「グループ管理」（[group-edit.html:57](../../../02_dashboard/group-edit.html#L57)）+ ヘルプトリガ `.help-inline-button[data-help-key="groupOverview"]`（[group-edit.html:58-59](../../../02_dashboard/group-edit.html#L58)、押下で `tooltipContent.groupOverview` テキストが表示）+ `#groupSelector`（`<select>`、`w-full sm:w-64`、選択肢 3 件は HTML 直書き）。`<title>` / `<h1>` / `data-page-id` は「グループ管理」、パンくずは「グループ編集」で不一致（§11-12）。

**グループ情報セクション**: `<h2>` 「グループ情報」 + `#groupName`（`input[type=text][required]`、JS 空チェック無し §11-6）+ `#groupNameError`（「必須項目です。」ハードコード、JS 側 表示切替無し §11-6）+ `#groupDescription`（`textarea[rows=3]`、バリデーション・文字数上限なし）。アコーディオンは `.section-header` クリックで開閉、初期 `aria-expanded="true"` で開（[group-edit.html:74](../../../02_dashboard/group-edit.html#L74)）。

**請求先情報セクション**: 切替ボタン 2 本（`#use-creator-billing-btn` / `#use-group-billing-btn`、`.bg-secondary-container text-on-secondary-container` の付与/剥奪で active 表現、[groupEdit.js:158-172](../../../02_dashboard/src/groupEdit.js#L158)）+ `#creator-billing-info`（`data-field` 5 フィールド、`state.creatorBillingInfo` のハードコード「山田太郎 / 営業部 / 03-1111-1234 / 100-0001 / 東京都千代田区千代田1-1 ビルディング10F」、アカウント非連動 §11-7）+ `#group-billing-display`（読取 + `#edit-group-billing-btn`）+ `#group-billing-form`（5 入力 + キャンセル/保存ボタン、address2 は HTML 入力欄なし §11-10）。

**メンバー管理セクション**:

- 招待エリア: `#newMemberEmail`（`type=email` + `#newMemberEmailError`）/ `#newMemberRole`（`<select>`、`member`/`admin` 英語値）/ `#add-member-btn`「招待する」。
- 並び替えヘッダー: `#sort-by-role-btn` + `#sort-indicator-role`（アイコン `supervisor_account`）/ `#sort-by-status-btn` + `#sort-indicator-status`（`checklist`）/ `#reset-sort-btn`（`refresh`）。各ツールチップは「権限で並び替え」「ステータスで並び替え」「並び替えをリセット」。
- `#member-list` は `createMemberCardHTML(member)` が返す `<div.member-card>` を `innerHTML` 一括上書き（[groupEdit.js:73-112](../../../02_dashboard/src/groupEdit.js#L73)）。カード構成: アバター 40px / 氏名 + email / 権限 `<select>`（`管理者`/`一般` 日本語値、§11-14 不整合）/ ステータスバッジ（加入済=緑 / 招待中=黄 / エラー=赤 / 既定=グレー）/ `.delete-member-btn[data-email]`。

**フッター**: `#cancel-btn`（常時押下可）/ `#save-btn`（初期 `disabled`、`state.isDirty` true でのみ有効化、[groupEdit.js:66](../../../02_dashboard/src/groupEdit.js#L66)）。

### 4.4 モーダル

| モーダル | 配置 | 起動 | 閉じる | 用途 |
|----------|------|------|--------|------|
| `#memberDetailModal` | `modals/memberDetailModal.html`、placeholder `#memberDetailModal-placeholder` に動的注入（[group-edit.html:234](../../../02_dashboard/group-edit.html#L234)） | メンバーカードの非操作領域クリック → `handleOpenModal('memberDetailModal', resolveDashboardAssetPath('modals/memberDetailModal.html'))`（[groupEdit.js:342](../../../02_dashboard/src/groupEdit.js#L342)） | `[data-modal-close="memberDetailModal"]`（2 箇所、[memberDetailModal.html:5,15](../../../02_dashboard/modals/memberDetailModal.html#L5)） | 選択メンバーの詳細プロフィール読取専用表示 |
| `#confirmationModal` | `confirmationModal.js` から注入 | 複数箇所（§5.7） | モーダル内確定/キャンセル | 未保存破棄・削除確認 |
| `#newGroupModal` | `modals/newGroupModal.html` | **本画面からは起動しない**（関連仕様として §5.9 に記述） | — | 新規グループ作成／編集モーダル（別フロー専用） |

---

## 5. 機能要件

### 5.1 初期化フロー [**MVP**]

`initGroupEditPage()`（[groupEdit.js:495-559](../../../02_dashboard/src/groupEdit.js#L495)）:

1. `state.creatorBillingInfo` をハードコード値で初期化（[groupEdit.js:496-502](../../../02_dashboard/src/groupEdit.js#L496)）。
2. `state.allGroupsData` に 3 件のハードコードグループ（`GROUP001`/`GROUP002`/`GROUP003`）を格納。各 20 名のダミーメンバーを `generateDummyMembers(20, startIndex)` で生成（[groupEdit.js:503-528](../../../02_dashboard/src/groupEdit.js#L503)）。
3. `loggedInUser`（`user0@example.com`、管理者、作成者情報と連動）を各グループの `members` 先頭へ `unshift`（[groupEdit.js:530-548](../../../02_dashboard/src/groupEdit.js#L530)）。
4. `originalMembers = [...members]` を各グループに複製（ソートリセット用、[groupEdit.js:551-553](../../../02_dashboard/src/groupEdit.js#L551)）。
5. `state.currentGroupId = elements.groupSelector.value`（初期値 `GROUP001`、[groupEdit.js:555](../../../02_dashboard/src/groupEdit.js#L555)）。
6. `initAccordions()` → `renderPage()` → `setupEventListeners()` を呼ぶ（[groupEdit.js:557-559](../../../02_dashboard/src/groupEdit.js#L557)）。

`renderPage()`（[groupEdit.js:137-152](../../../02_dashboard/src/groupEdit.js#L137)）は基本情報投入 / `updateBillingToggleUI(useGroupBilling, false)` / `renderBillingInfo()` / `renderMemberList()` / `toggleGroupBillingForm(false)` / ソート state 初期化 / `setDirty(false)` / `setBillingDirty(false)` を直列実行する。

**実行しない処理**（§11）: `fetchGroups()` 呼出 / `URLSearchParams` 読取 / データ取得失敗時のハンドリング。

### 5.2 グループ基本情報編集 [**MVP**]

| 項目 | DOM | 編集挙動 | 実装位置 |
|------|-----|----------|----------|
| グループ名 | `#groupName`（`input[required]`） | `input` イベント → `setDirty(true)` | [groupEdit.js:270](../../../02_dashboard/src/groupEdit.js#L270) |
| 説明文 | `#groupDescription`（`textarea`） | 同上 | 同 |

- HTML に `#groupNameError` 領域が存在するが、JS はこれを表示/非表示する処理を持たない。必須違反時のエラー表示・保存時の空チェック共に未実装（§11-6）。
- 保存処理 `#save-btn` ハンドラ（[groupEdit.js:378-416](../../../02_dashboard/src/groupEdit.js#L378)）も **空チェックを行わず**、空文字のまま `console.log` → `setDirty(false)` と進む。

### 5.3 グループ選択・切替 [**MVP**]

- `#groupSelector.change` で新グループ ID を取得（[groupEdit.js:275-287](../../../02_dashboard/src/groupEdit.js#L275)）。
- `state.isDirty === true` なら `showConfirmationModal('変更が保存されていません。切り替えますか？', switchGroup)` を表示。確定時のみ切替。
- 切替実行: `state.currentGroupId = newGroupId` → `renderPage()`（`setDirty(false)` / `setBillingDirty(false)` 含む）。
- **URL `?groupId=...` に対応していない**。外部リンクから特定グループを開けない（§11-1）。
- **グループ選択肢は HTML で 3 件ハードコード**。実グループ数や権限に基づく動的生成は未実装（§11-4）。

### 5.4 請求先情報管理 [**MVP**]

#### 5.4.1 2 モード切替

| モード | active ボタン | 表示領域 | state 更新 |
|--------|---------------|----------|-----------|
| 作成者情報利用 | `#use-creator-billing-btn` | `#creator-billing-info` | `currentGroupData.useGroupBilling = false` |
| グループ専用 | `#use-group-billing-btn` | `#group-billing-info` | `currentGroupData.useGroupBilling = true` |

- `updateBillingToggleUI(show, isUserAction=true)`（[groupEdit.js:154-174](../../../02_dashboard/src/groupEdit.js#L154)）が active クラス付け替えと表示切替を行う。
- ユーザー操作（`isUserAction=true`）時は `setDirty(true)` を呼び、保存ボタンを有効化。初期化時（`false`）は呼ばない。

#### 5.4.2 グループ専用請求先の編集サブフロー

`#group-billing-info` 内に `#group-billing-display`（読取、`#edit-group-billing-btn` 付き）と `#group-billing-form`（5 入力: contactName / department / phone / postalCode / address1 + `#cancel-group-billing-btn` / `#save-group-billing-btn`）が排他配置される。`toggleGroupBillingForm(show)`（[groupEdit.js:176-185](../../../02_dashboard/src/groupEdit.js#L176)）が `.hidden` をトグルし、編集開始時は `setBillingDirty(false)`。

| 操作 | 動作 | 実装位置 |
|------|------|---------|
| フィールド入力 | `setBillingDirty(true)` | [groupEdit.js:271](../../../02_dashboard/src/groupEdit.js#L271) |
| 編集キャンセル（`isBillingFormDirty` true） | 確認モーダル → 確定で `renderBillingInfo()`（値復元）+ `toggleGroupBillingForm(false)` | [groupEdit.js:294-304](../../../02_dashboard/src/groupEdit.js#L294) |
| 編集キャンセル（dirty なし） | 即 `cancelAction()` | 同 |
| 編集保存 | `billingInfo = { contactName, department, phone, postalCode, address1, address2: '' }` + `renderBillingInfo()` + `toggleGroupBillingForm(false)` + `setDirty(true)` + 成功トースト | [groupEdit.js:306-321](../../../02_dashboard/src/groupEdit.js#L306) |

**`#group-billing-form` 側にバリデーションなし**（郵便番号・電話番号の形式、必須チェック全て未実装、§11-11）。**`billingInfo.address2` は HTML に入力欄が無く常に空文字**（§11-10）。

### 5.5 メンバー管理 [**MVP**]

#### 5.5.1 メンバーカード描画

- `createMemberCardHTML(member)`（[groupEdit.js:73-107](../../../02_dashboard/src/groupEdit.js#L73)）が単一カード HTML を返し、`renderMemberList(members)` が `innerHTML` 一括上書き（[groupEdit.js:109-112](../../../02_dashboard/src/groupEdit.js#L109)）。
- カード属性:
  - `data-member-id="${member.email}"`（一意キーがメールアドレス、§11-8）
  - `<img src="${member.avatarUrl}">`（`i.pravatar.cc`、外部依存）
  - `<select>` の `option` は `管理者` / `一般` 日本語固定、`selected` は `member.role === r` の一致判定
  - ステータスバッジの色は `switch(member.status)` で 4 通り分岐
  - 削除ボタン `.delete-member-btn[data-email="${member.email}"]`

#### 5.5.2 メンバー招待 [**MVP**]

`#add-member-btn.click`（[groupEdit.js:349-375](../../../02_dashboard/src/groupEdit.js#L349)）の処理:

- `email = #newMemberEmail.value.trim()`、既存エラー表示をリセット。
- `!email || !/\S+@\S+\.\S+/.test(email)` なら `#newMemberEmailError` に「有効なメールアドレスを入力してください。」+ `#newMemberEmail.input-error` で return。
- `newMember = { email, role: newMemberRole.value, name: email.split('@')[0], status: 'グループ招待中', avatarUrl: 'https://i.pravatar.cc/40?u=${email}' }` を生成。
- `currentGroup.members.push(newMember)` + `originalMembers.push(newMember)` + `renderMemberList()` + 入力クリア + `setDirty(true)`。

**未実装**:
- 既存メンバーとの email 重複チェック（§11-8。`groupManagementModal.js:148-151` は重複チェックあり、本画面には無い）。
- 権限表記の不整合: 招待フォームの `#newMemberRole.value` は `member`/`admin`（英語）、メンバーカード `<select>` の `option value` は `管理者`/`一般`（日本語）。`newMember.role` は英語値で push されるため `createMemberCardHTML` の `selected` 判定（`member.role === r`、r は日本語）で一致せず、**表示上 `管理者` がデフォルト選択される**（§11-14 最重要バグ）。
- 招待送信通知（メール発火 / `POST` API 連携）なし、成功トーストなし、ログイン済ユーザーとの照合なし。

#### 5.5.3 メンバー削除 [**MVP**]

`#member-list click` の delegation（[groupEdit.js:324-346](../../../02_dashboard/src/groupEdit.js#L324)）:

- `target.closest('.delete-member-btn')` 命中 →
  - `showConfirmationModal('メンバー「${member.name}」を削除しますか？', callback)`。
  - 確定時: `currentGroup.members = members.filter(m => m.email !== memberId)`、`originalMembers` も同様にフィルタ、`renderMemberList()` + `setDirty(true)` + `showToast('メンバーを削除しました。', 'success')`。

#### 5.5.4 メンバー詳細モーダル表示 [**MVP**]

- 同じ `#member-list click` デリゲーション内、`target.closest('.delete-member-btn')` でも `target.closest('select, button, a')` でもない場合に発火（[groupEdit.js:341-345](../../../02_dashboard/src/groupEdit.js#L341)）。
- `handleOpenModal('memberDetailModal', resolveDashboardAssetPath('modals/memberDetailModal.html'))` → Promise 完了後 `populateMemberDetailModal(member)` を呼ぶ。
- `populateMemberDetailModal()`（[groupEdit.js:187-211](../../../02_dashboard/src/groupEdit.js#L187)）は `#member-details-content.innerHTML` に下記を書き込む:
  - ヘッダー: アバター 64px + 氏名 + メールアドレス
  - 本体: 権限 / ステータス / 会社名 / 部署名 / 役職 / 電話番号 / 住所
  - `detailItem(label, value)` は value が真値の場合のみ `<div>` を生成（falsy だと空文字を返す）。

### 5.6 メンバー並び替え [**MVP**]

state: `state.currentSort = { key: null | 'role' | 'status', order: 'asc' | 'desc' }`（[groupEdit.js:60](../../../02_dashboard/src/groupEdit.js#L60)）。

#### 5.6.1 ソート実行 `handleSort(key)`（[groupEdit.js:237-266](../../../02_dashboard/src/groupEdit.js#L237)）

- 同一キー連打で `asc` / `desc` トグル、別キーなら `asc` に初期化。`orderFactor = asc ? 1 : -1`。
- `role`: `a.role === '管理者' ? -1 : 1` × `orderFactor`（同権限は 0、安定）。
- `status`: `{ 'グループ加入済': 1, 'グループ招待中': 2, 'アドレスエラー': 3 }` の差 × `orderFactor`。未知値は 99。
- `members.sort()` は **破壊的**（`originalMembers` を温存してリセット可能）。
- 末尾で `renderMemberList()` + `updateSortIndicators()` + `setDirty(true)`。

#### 5.6.2 インジケーター / リセット

- `updateSortIndicators()`（[groupEdit.js:225-235](../../../02_dashboard/src/groupEdit.js#L225)）: `#sort-indicator-role` / `#sort-indicator-status` に `arrow_upward` / `arrow_downward` / 空文字をセット。`key === null` で両方空。
- `#reset-sort-btn.click`（[groupEdit.js:428-435](../../../02_dashboard/src/groupEdit.js#L428)）: `members = [...originalMembers]` + ソート state クリア + `setDirty(true)`。**初期順に戻しても `isDirty` が立つ** UX 上の粗あり（§11-16）。

**ソートが dirty 扱いになる理由**: 並び順が保存対象に含まれる前提の実装だが、`dataToSave.members` は `{email, role}` のみで **順序メタ情報を持たない**（§11-15）。

### 5.7 権限・役割管理 [**MVP**]

- 招待フォーム側: `#newMemberRole` `<option value="member">一般</option><option value="admin">管理者</option>`（[group-edit.html:170-171](../../../02_dashboard/group-edit.html#L170)）。`value` は英語。
- メンバーカード側: `createMemberCardHTML` 内の `<select>` は `value` / 表示とも日本語（`管理者` / `一般`）（[groupEdit.js:74](../../../02_dashboard/src/groupEdit.js#L74)）。
- `memberList.change` リスナ: `e.target.tagName === 'SELECT'` なら `setDirty(true)`（[groupEdit.js:272](../../../02_dashboard/src/groupEdit.js#L272)）。state 配列 `members[].role` は更新されず、**保存時に `memberElements.querySelectorAll('select').value` を直接拾って組み立てる** ため、state と DOM が一時的に乖離する設計（[groupEdit.js:384-393](../../../02_dashboard/src/groupEdit.js#L384)）。
- **ロール表記 2 系統併存**（英語 `member`/`admin` と日本語 `一般`/`管理者`）は保守性を損ねる（§11-14）。

### 5.8 保存・キャンセル・離脱警告 [**MVP**]

#### 5.8.1 保存（`#save-btn.click`）[[groupEdit.js:378-416](../../../02_dashboard/src/groupEdit.js#L378)]

- `if (!state.isDirty) return;`（多重発火防止）。
- `memberElements = elements.memberList.querySelectorAll('.member-card')` から `data-member-id` と `<select>.value` を取り出し、`currentGroup.members.find(m => m.email === email)` と合成して `updatedMembers` を構築（[groupEdit.js:384-393](../../../02_dashboard/src/groupEdit.js#L384)）。
- `dataToSave = { groupInfo: { name, description }, members: updatedMembers.map({email, role}) }`。
- `console.log('Saving data:', dataToSave)` → `showToast('グループ情報を保存しました。', 'success')`。
- state 反映: `currentGroup.name/description/members/originalMembers` を上書き（[groupEdit.js:410-413](../../../02_dashboard/src/groupEdit.js#L410)）。
- `setDirty(false)` で保存ボタン再 disabled 化。

**未実装**: `updateGroup()` 接続、通信中ローディング、エラートースト、`billingInfo` / `useGroupBilling` のペイロード含め漏れ（§11-2 / §11-17）。

#### 5.8.2 キャンセル / 離脱系の 3 点セット

| トリガ | 条件 | 動作 | 実装位置 |
|--------|------|------|---------|
| `#cancel-btn.click` | `state.isDirty` true | 確認モーダル → 確定で `window.location.reload()` | [groupEdit.js:417-423](../../../02_dashboard/src/groupEdit.js#L417) |
| `#cancel-btn.click` | `state.isDirty` false | 即 `window.location.reload()` | 同 |
| `window.beforeunload` | `state.isDirty` true | `preventDefault() + returnValue=''`（標準ダイアログ） | [groupEdit.js:438-443](../../../02_dashboard/src/groupEdit.js#L438) |
| `document.body.click` (capture) | `state.isDirty` + 内部 `<a>` 遷移 | 確認モーダル → 確定で `setDirty(false)` + `location.href = anchor.href` | [groupEdit.js:445-462](../../../02_dashboard/src/groupEdit.js#L445) |

内部リンクキャッチャーの除外条件: `target === '_blank'`、`javascript:` から始まる href、現在と同 pathname（ハッシュリンク等）。サイドバー/ヘッダーからの遷移もここで拾う。**`reload()` ベースのため戻り先 URL を指定できない**（§11-18）。

### 5.9 関連モーダル（newGroupModal / groupManagementModal）との関係 [**Phase 2 / 参考**]

本画面からは起動しないが、同一ドメイン（グループ）を扱うフローとして併記。詳細は `03_ux_group_creation_modal.md` 側。

| モーダル | ソース | 本画面との接点 | 論点 |
|----------|--------|----------------|------|
| `#newGroupModal` | [modals/newGroupModal.html](../../../02_dashboard/modals/newGroupModal.html) + [groupManagementModal.js](../../../02_dashboard/src/groupManagementModal.js) | 起動しない。別フロー（ヘッダーメニュー等）から呼ばれる想定 | `#allowBillingInfoView` を JS が参照するが HTML に無い（§11-19） / `handleDeleteGroup` は `confirm()` を使用（§11-20） / 新規作成後の一覧再読み込みが TODO |
| `#memberDetailModal` | [modals/memberDetailModal.html](../../../02_dashboard/modals/memberDetailModal.html) | §5.5.4 から起動 | `innerHTML` で詳細を注入（§11-21）、`role="dialog"` / `aria-modal="true"` / `aria-labelledby` あり |
| `#confirmationModal` | `confirmationModal.js`（共通） | 5 箇所から起動: グループ切替 / 請求先編集キャンセル / メンバー削除 / キャンセル / 内部リンク離脱 | 共通化済み |

### 5.10 バリデーション [**MVP**]

### 5.10.1 項目別バリデーション表

現行実装が行っているチェックのみ。

| 項目 | 条件 | 違反時 | 実装位置 |
|------|------|--------|----------|
| `groupName` | `required` 属性のみ | HTML5 標準の必須警告のみ。JS 側の空チェック **なし** | [group-edit.html:83](../../../02_dashboard/group-edit.html#L83) / §11-6 |
| `groupDescription` | なし | — | — |
| `newMemberEmail`（招待時） | 非空 + `/\S+@\S+\.\S+/` | `#newMemberEmailError` にメッセージ表示、`#newMemberEmail.input-error` 付与 | [groupEdit.js:357-362](../../../02_dashboard/src/groupEdit.js#L357) |
| メンバー重複 email | なし（招待時チェック無し） | **重複のまま `push` される** | §11-8 |
| `group-billing-*` | なし | — | §11-11 |
| メンバーカード `<select>` | なし | — | — |

### 5.10.2 エラー表示仕様

- `#groupNameError`: HTML 上に `text-error text-xs mt-1 hidden` + メッセージ「必須項目です。」が定義されているが、JS で表示切替を行う箇所が存在しない（§11-6）。
- `#newMemberEmailError`: `classList.toggle('hidden')` + `textContent` で動的更新。`aria-live` は未設定（§11-22）。
- 保存失敗トースト: 保存処理が `console.log` のみのため、失敗シナリオ自体が発生しない（§11-2）。

---

## 6. データモデル

### 6.1 `state` オブジェクト構造

`initGroupEditPage()` クロージャ外で module スコープ保持（[groupEdit.js:54-61](../../../02_dashboard/src/groupEdit.js#L54)）。**モジュール単一インスタンスのため SPA 内で再 init すると前回 state が残る**（本画面は SPA ルーティング未使用のため実害は低い、§11-23）。

| キー | 型 | 説明 |
|------|----|------|
| `isDirty` | `boolean` | 編集中フラグ。`#save-btn.disabled` と連動 |
| `isBillingFormDirty` | `boolean` | 請求先フォームのローカル編集フラグ（キャンセル確認のみ参照） |
| `allGroupsData` | `Record<string, Group>` | 全グループのメモリキャッシュ（`GROUP001`/`GROUP002`/`GROUP003`） |
| `currentGroupId` | `string \| null` | 現在選択中グループ ID |
| `creatorBillingInfo` | `object \| null` | 作成者（ログインユーザー）の請求先ハードコード値 |
| `currentSort` | `{ key: 'role' \| 'status' \| null, order: 'asc' \| 'desc' }` | メンバー一覧ソート状態 |

### 6.2 `Group` スキーマ（メモリ）

`state.allGroupsData[groupId]`（[groupEdit.js:503-528](../../../02_dashboard/src/groupEdit.js#L503)）:

| キー | 型 | 例 |
|------|----|-----|
| `id` | `string` | `GROUP001` |
| `name` | `string` | `営業部` |
| `description` | `string` | `第一営業部のメンバーが所属するグループです。` |
| `useGroupBilling` | `boolean` | `false` |
| `billingInfo` | `BillingInfo`（§6.3） | — |
| `members` | `Member[]`（§6.4） | 20 名 + ログインユーザー = 21 名 |
| `originalMembers` | `Member[]` | members のスナップショット。ソートリセット用 |

### 6.3 `BillingInfo` スキーマ

| キー | 型 | 備考 |
|------|----|------|
| `contactName` | `string` | 請求書送付先氏名 |
| `department` | `string` | 部署名 |
| `phone` | `string` | 電話番号（形式検証なし） |
| `postalCode` | `string` | 郵便番号（形式検証なし） |
| `address1` | `string` | 住所 |
| `address2` | `string` | **常に空文字。HTML 入力欄なし**（§11-10） |

**作成者請求先 `state.creatorBillingInfo`** は別スキーマ（[groupEdit.js:496-502](../../../02_dashboard/src/groupEdit.js#L496)）で、プロパティ名が `name` / `department` / `phone` / `postalCode` / `address`。`BillingInfo.contactName` と `creatorBillingInfo.name` でキー名が異なり、両者の相互変換ロジックがない（§11-7）。

### 6.4 `Member` スキーマ

`generateDummyMembers()`（[groupEdit.js:465-493](../../../02_dashboard/src/groupEdit.js#L465)）と `loggedInUser`（[groupEdit.js:530-541](../../../02_dashboard/src/groupEdit.js#L530)）が生成するオブジェクト:

| キー | 型 | 値域 / 生成方法 |
|------|----|-----------------|
| `email` | `string` | `user{N}@example.com`（主キー扱い） |
| `role` | `string` | `一般` / `管理者`（日本語、ダミー生成時）／`member` / `admin`（英語、招待時）— §11-14 で不整合 |
| `name` | `string` | `{surname} {given}` or `email.split('@')[0]`（招待時） |
| `status` | `string` | `グループ加入済` / `グループ招待中` / `アドレスエラー` |
| `avatarUrl` | `string` | `https://i.pravatar.cc/40?u={email}` |
| `companyName` | `string` | ダミー 5 社ローテーション |
| `departmentName` | `string` | ダミー 5 部署ローテーション |
| `positionName` | `string` | ダミー 5 役職ローテーション |
| `phoneNumber` | `string` | `03-{4桁}-{4桁}` ランダム |
| `address` | `string` | `東京都千代田区{index}丁目` |

`companyName` / `positionName` / `phoneNumber` / `address` はメンバー詳細モーダルのみで使用。招待メンバー（`handleAddMember` 経由）はこれらのフィールドを持たないため、招待直後にモーダルを開くと詳細欄が空になる（§11-24）。

### 6.5 保存ペイロード形式

`handleSaveSettings()` 相当の `dataToSave`（[groupEdit.js:395-404](../../../02_dashboard/src/groupEdit.js#L395)）:

```json
{
  "groupInfo": {
    "name": "営業部",
    "description": "..."
  },
  "members": [
    { "email": "user0@example.com", "role": "管理者" },
    { "email": "user1@example.com", "role": "一般" }
  ]
}
```

- **`groupId` 未含**。サーバ連携時は送信先 URL で補う想定（§11-2）。
- **`billingInfo` / `useGroupBilling` 未含**。請求先切替を保存ボタンでペイロードに含めるロジックが未実装（§11-17）。
- **並び順情報なし**。ソート状態は送信されない（§11-15）。

### 6.6 `groupService` との関係（本画面では未使用）

[groupService.js](../../../02_dashboard/src/groupService.js) は `data/core/groups.json`（本番）または `data/core/groups.sample.json`（`/sample/` 配下）を fetch してメモリに保持する。

| 関数 | 処理 | 本画面 |
|------|------|--------|
| `fetchGroups()` | JSON fetch + `accountType` 補完 | 未呼出 |
| `createGroup(data)` | `grp_{Date.now()}` 割当 + push | 未呼出 |
| `updateGroup(id, data)` | `findIndex` → マージ | 未呼出 |
| `deleteGroup(id)` | `filter` で除去 | 未呼出 |
| `getGroupsInMemory()` | `groups` 返却 | 未呼出 |

`groups.json` のスキーマは `{ id, accountId, name, billing: { type: 'creator'\|'group', creatorId?, corporateName? } }`（[data/core/groups.json](../../../data/core/groups.json)）で、本画面ハードコード ID `GROUP001`/`GROUP002`/`GROUP003` と体系が一致しない。サーバ連携時は ID マッピングとスキーマ吸収が必要（§11-4）。

### 6.7 ストレージ

- **localStorage / sessionStorage は本画面で未使用**。編集状態はメモリ上のみで、ページリロードでダミーデータが再生成される。
- `beforeunload` で防げない強制リロード・別タブ操作は同期されない（§11-25）。

---

## 7. 非機能要件

### 7.1 パフォーマンス [**Should**]

- ダミー 20 名 × 3 グループ = 60 件を初期化時に生成（乱数電話番号含む）。所要時間は ms オーダー。
- `renderMemberList()` は毎回 `innerHTML` で一括再描画するため、並び替え・削除のたびにフルレンダリング。20 件程度では実用上問題なし。100 件以上に増えた場合は仮想スクロール or 差分更新が要検討（§11-26）。
- `document.body.click` のキャプチャハンドラは常時走る。`state.isDirty` が false の間は早期 return されるため通常時コストは低い。

### 7.2 アクセシビリティ [**Should**]

**実装済み**: セクションヘッダーの `aria-expanded` 動的切替（[groupEdit.js:213-223](../../../02_dashboard/src/groupEdit.js#L213)）/ 並び替えボタン `aria-label`「並び替えをリセット」等（[group-edit.html:204](../../../02_dashboard/group-edit.html#L204)）/ モーダル `role="dialog"` + `aria-modal` + `aria-labelledby` / 削除ボタン `aria-label="メンバーを削除"` / ヘルプトリガ `aria-label="グループの説明を表示"`。

**欠落**（§11-22）: `#sort-indicator-*` に `aria-live` なし / `#groupNameError` / `#newMemberEmailError` に `role="alert"` なし / 保存ボタン disabled 変化時の SR 通知なし / ドラッグ並び替えのキーボード代替なし / `#groupSelector` の `aria-describedby` なし。

### 7.3 セキュリティ [**Should**]

- `innerHTML` 多用（カード / モーダル詳細）。現状は内製ダミーのみだが、サーバ連携時は `textContent` 化 or エスケープが必要（§11-21）。
- `i.pravatar.cc` 外部画像への依存はプライバシー・可用性リスク。
- `handleDeleteGroup()`（`groupManagementModal.js` 側）が `confirm()` を使用、XSS フック時に偽装される余地（§11-20）。

### 7.4 国際化 [**Phase 2**]

- 全テキストが日本語ハードコード。`role` の内部値も日本語混入（§11-14）。i18n 対応は未着手。

---

## 8. Definition of Done

本版 MVP をリリース可能と判断するチェックリスト（機能面 / UI 面 / 非機能面）。

| 区分 | 項目 |
|------|------|
| 機能 | グループ選択プルダウンで 3 件切替でき、未保存時は確認モーダルが出る |
| 機能 | グループ名・説明の編集で保存ボタンが有効化される |
| 機能 | 請求先モード切替が dirty 扱いとなり、グループ専用編集の保存/キャンセルが期待どおり動く |
| 機能 | メンバー招待・削除・権限変更で保存ボタンが有効化される |
| 機能 | ソート（権限/ステータス）とリセットが期待順序で動く |
| 機能 | メンバーカード非操作領域クリックで詳細モーダルが開き情報が表示される |
| 機能 | 保存ボタン押下で `console.log` が出る（モック動作）+ 成功トースト |
| 機能 | キャンセル / 離脱 / 内部リンク遷移時に未保存確認が出る |
| UI | `section-header` アコーディオン開閉が動作し、初期展開される |
| UI | モバイル（`<md`）で招待エリア・グループセレクタが折り返し、操作可能 |
| UI | メンバーカード内の `<select>` 値がカード生成時に `selected` される（§11-14 修正後） |
| 非機能 | console にエラー・警告が出ない |
| 非機能 | 並び替えボタン・エラー領域に `aria-live` を追加（§11-22 修正後） |

---

## 9. 将来計画（Phase 2）

§11 の実装ギャップから優先度高めのものを抜粋。詳細は §11 を参照。

| # | 項目 | 期待実装 |
|---|------|---------|
| A | `?groupId` URL パラメータ対応 | `URLSearchParams` で `groupId` を読み、存在すれば `currentGroupId` に反映、不在 ID はトースト + 既定 fallback |
| B | `groupService` 接続 | `fetchGroups()` を初期化に組み込み、`updateGroup(id, payload)` を保存で呼ぶ |
| C | メンバー重複チェック | `members.some(m => m.email === email)` ガードを本画面にも追加 |
| D | ロール値の統一 | `role: 'admin' \| 'member'` に正規化し、描画時のみ日本語ラベル変換 |
| E | 請求先保存の漏れ | `dataToSave.billing = { useGroupBilling, billingInfo }` を追加 |
| F | ソート後リセットでの dirty | ソート state を保存対象外へ |
| G | ドラッグ並び替え | `new Sortable(#member-list, { handle: '.drag-handle' })` + カード左端にハンドル追加 |
| H | 読み込みエラーハンドリング | `fetchGroups().catch()` で画面中央エラー表示 |
| I | 権限制御 | サーバ判定または `currentUser.role` で UI 抑制 |
| J | i18n | `tooltipContent.js` と同様の多言語辞書化 |

---

## 10. 用語集

| 用語 | 定義 |
|------|------|
| グループ | アンケートを複数名で編集する単位。作成者（= 管理者）が 1 名、一般メンバー複数名。 |
| グループ管理者 | メンバー招待・削除・権限変更・請求先設定ができるユーザー。`role === '管理者'`。 |
| 一般メンバー | アンケート編集に参加できる権限のみを持つユーザー。本画面のアクセス制御は未実装（§7.3）。 |
| 作成者情報 | グループ作成時点で登録されたアカウント情報。本画面では `state.creatorBillingInfo` でハードコード。 |
| グループ専用請求先 | `useGroupBilling=true` 時に適用される、グループ個別の請求情報。 |
| Dirty State | 未保存変更の有無フラグ。`state.isDirty` / `state.isBillingFormDirty` の 2 種。 |
| originalMembers | ソートリセット用のメンバー配列スナップショット。招待/削除と同時更新。 |

---

## 11. 関連ファイル・デッドコード棚卸し

`group-edit.html` + `groupEdit.js` を正として実装ギャップを追跡するリスト。番号は本書 §5〜§7 から参照される。

| # | 項目 | 現状 | 備考 |
|---|------|------|------|
| 1 | `?groupId` クエリパラメータ | 未実装 | `URLSearchParams` 未使用。旧 v1.x 要件は未到達 |
| 2 | 実サーバ保存 | モック | [groupEdit.js:406](../../../02_dashboard/src/groupEdit.js#L406) `console.log` のみ、`updateGroup()` 未呼出 |
| 3 | Sortable.js ドラッグ並び替え | デッドコード | CDN 読込 + CSS 定義あり、`new Sortable` / `.drag-handle` 付与なし |
| 4 | `groupService` 連携 | 未接続 | 本画面から import なし。ID 体系も不一致 |
| 5 | 読み込みエラーハンドリング | 未実装 | try/catch なし |
| 6 | `#groupName` 空チェック / `#groupNameError` 表示切替 | 未実装 | HTML 要素のみ存在、JS 連動なし |
| 7 | 作成者請求先 ↔ グループ請求先のキー名差 | 不整合 | `creatorBillingInfo.name` vs `billingInfo.contactName` の吸収ロジックなし |
| 8 | メンバー email 重複チェック（招待時） | 未実装 | モーダル側には実装あり（[groupManagementModal.js:148](../../../02_dashboard/src/groupManagementModal.js#L148)） |
| 9 | アクセス権制御 | 未実装 | URL 直打ちで誰でも開ける |
| 10 | `billingInfo.address2` | 常に空 | HTML 入力欄なし |
| 11 | グループ専用請求先フォームのバリデーション | 未実装 | 必須 / 郵便番号 / 電話番号チェック無し |
| 12 | ページタイトル不一致 | 不整合 | `<title>`/`<h1>`/`data-page-id` は「グループ管理」、パンくずは「グループ編集」 |
| 13 | 狭幅レイアウト | 未検証 | メンバーカード内部が SP で潰れる可能性 |
| 14 | ロール値 2 系統（英語/日本語）併存 | バグ候補 | 招待直後カードで `selected` が付かず `管理者` が表示上デフォルトになる |
| 15 | メンバー並び順の保存 | なし | `dataToSave.members` に順序メタなし |
| 16 | ソートリセット時の `setDirty(true)` | 過剰 | 初期順に戻しても保存ボタン点灯 |
| 17 | `billingInfo` / `useGroupBilling` の保存 | 漏れ | `dataToSave` に含まれず |
| 18 | キャンセル時 `window.location.reload()` | 粗い | 戻り先 URL 指定不可 |
| 19 | `#allowBillingInfoView` HTML 欠落 | 矛盾 | `groupManagementModal.js:90,97,256` が参照、HTML に要素なし |
| 20 | `handleDeleteGroup()` の `confirm()` | 未統一 | 他は `showConfirmationModal` |
| 21 | `innerHTML` 多用 | XSS リスク | `populateMemberDetailModal()` / `createMemberCardHTML()` がエスケープなく展開 |
| 22 | ARIA 欠落 | 未対応 | ソートインジケーター / エラー領域に `aria-live` / `role="alert"` なし |
| 23 | module スコープ `state` | 設計リスク | 再 init 時に前回値残存 |
| 24 | 招待メンバーの詳細情報欠落 | ダミー限定 | 招待直後の詳細モーダルに会社名・住所等が出ない |
| 25 | タブ間同期 | なし | メモリのみ |
| 26 | 大量メンバーのパフォーマンス | 未検証 | `innerHTML` 一括再描画のみ |

---

## 12. 関連仕様書との関係

| 仕様書 | 関係 |
|--------|------|
| [03_ux_group_creation_modal.md](./03_ux_group_creation_modal.md) | `newGroupModal` + `groupManagementModal.js` の仕様を扱う別文書（§5.9）。`allowBillingInfoView` 等の記述は本画面の請求先トグル（§5.4）と競合するため将来統合時に整理が必要。 |
| [admin/user_management_requirements.md](./admin/user_management_requirements.md) | 管理者ロールでのグループ横断管理。本画面は「自身が管理するグループ」に限定され、管理者画面の「全ユーザー横断のグループ付与/剥奪」とは別レイヤー。権限判定ロジックは同期必須。 |
| [06_bizcard_settings_requirements.md](../../リライト版仕様書/06_bizcard_settings_requirements.md) | 「グループ管理者宛に請求される」仕様の根拠（§1.3）。`useGroupBilling` / `billingInfo` の整合が bizcard / thank-you の請求先決定に影響。 |
| [00_screen_requirements.md](./00_screen_requirements.md) | 画面一覧・遷移の全体インデックス。 |
| [18_screen_inventory_current.md](./18_screen_inventory_current.md) | 現行実装の画面棚卸し。本画面の実装ステータスを追跡。 |

