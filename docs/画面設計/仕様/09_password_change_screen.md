---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# パスワード変更画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/password_change.html`（128 行、ウィザード形式 step1 / step2 / step3）、独立完了ページ `02_dashboard/password-change-complete.html`（55 行）、ロジック `02_dashboard/src/password_change.js`（289 行）。本書はこれら現行実装を根拠にする「実装トレースドキュメント」である。
> - v1.x まで採用していた「本書が正・実装は参照」スタンスを破棄し、`16_bizcard_settings_requirements.md` と同方針で「画面が正」へ刷新した。
> - 完了画面は **step3（同一ページ内）と `password-change-complete.html`（独立ページ）の二重実装** になっており、`handleNextStep2()` 成功時は独立ページへ `window.location.href` で遷移する一方、`backToDashboardBtn` は step3 にも残存している。§10-1 の最重要課題として追跡する。
> - 強度基準の正本文言は HTML 直書きの「**必須: 8文字以上で、英字と数字を必ず含めてください。記号を組み合わせるとより安全になります。**」（[password_change.html:83](../../../02_dashboard/password_change.html#L83)）。JS のバリデーションも「8 文字以上」＋「数字 1 つ以上」の 2 条件のみで、英字チェックは **未実装**（§10-3）。
> - 現在パスワード検証・変更適用は両方ともモック（`password === 'password123'` 判定＋ 500ms `setTimeout`）。サーバ API・CSRF・レート制限はすべて Phase 2（§10-2）。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§10 に集約。 |

### 1.2 目的・想定利用者

ログイン中のユーザーが自身のパスワードを任意のタイミングで安全に変更できること。想定利用者:

- ダッシュボードにログイン済みのユーザー全般（`accountInfoModal` 内「パスワードを変更する」導線から到達）。
- 現在のパスワードを覚えている、かつメールリセットを挟まずに即時変更したいユーザー。

**対象外**:
- ログイン前の「パスワードを忘れた」フロー（`forgot-password.html` / `10_password_reset_feature.md`）。
- 管理者による他ユーザーのパスワードリセット。
- 初回仮パスワードからの強制変更。

### 1.3 対象範囲 / 対象外

**対象**:
- `02_dashboard/password_change.html`
- `02_dashboard/password-change-complete.html`
- `02_dashboard/src/password_change.js`

**対象外**（§10 参照のみ）:
- サーバサイドのパスワード保存・ハッシュ化・履歴保持
- CSRF トークン発行、レート制限、アカウントロック
- 多要素認証（MFA）
- `confirmationModal.js` / `utils.js`（`showToast`）の内部実装（本書では呼び出し契約のみ扱う）

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§10 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| モック合格パスワード | `password123` のみ | [password_change.js:10](../../../02_dashboard/src/password_change.js#L10) |
| モック通信遅延（step1 / step2 共通） | 500ms（`setTimeout`） | [password_change.js:9](../../../02_dashboard/src/password_change.js#L9) / [password_change.js:22](../../../02_dashboard/src/password_change.js#L22) |
| 最小文字数 | 8 文字 | [password_change.js:146](../../../02_dashboard/src/password_change.js#L146) |
| 必須文字種（JS 判定） | 数字 1 つ以上（`/[0-9]/`） | [password_change.js:152](../../../02_dashboard/src/password_change.js#L152) |
| 必須文字種（HTML 表示文言） | 英字 **かつ** 数字 | [password_change.html:83](../../../02_dashboard/password_change.html#L83) |
| 強度スコア加点 1 | 長さ ≥ 8 | [password_change.js:194](../../../02_dashboard/src/password_change.js#L194) |
| 強度スコア加点 2 | 長さ ≥ 10 | [password_change.js:195](../../../02_dashboard/src/password_change.js#L195) |
| 強度スコア加点 3 | 小文字 **かつ** 大文字を含む | [password_change.js:196](../../../02_dashboard/src/password_change.js#L196) |
| 強度スコア加点 4 | 数字を含む | [password_change.js:197](../../../02_dashboard/src/password_change.js#L197) |
| 強度スコア加点 5 | 記号（英数字以外）を含む | [password_change.js:198](../../../02_dashboard/src/password_change.js#L198) |
| 「弱い」閾値 | score < 2 → 赤 33% | [password_change.js:200](../../../02_dashboard/src/password_change.js#L200) |
| 「普通」閾値 | 2 ≤ score < 4 → 黄 66% | [password_change.js:201](../../../02_dashboard/src/password_change.js#L201) |
| 「安全」閾値 | score ≥ 4 → 緑 100% | [password_change.js:202](../../../02_dashboard/src/password_change.js#L202) |
| 完了画面遷移先 | `password-change-complete.html` | [password_change.js:171](../../../02_dashboard/src/password_change.js#L171) |
| キャンセル遷移先 | `index.html` | [password_change.js:92](../../../02_dashboard/src/password_change.js#L92) |
| 「ダッシュボードに戻る」遷移先 | `index.html`（`handleCancel` 再利用） | [password_change.js:241](../../../02_dashboard/src/password_change.js#L241) |
| パスワード忘れリンク | `forgot-password.html` | [password_change.html:52](../../../02_dashboard/password_change.html#L52) |
| ナビゲーションガードモーダル文言 | 「変更が保存されていません。ページを移動しますか？」 | [password_change.js:280](../../../02_dashboard/src/password_change.js#L280) |
| ガード承認ボタン文言 | 「移動する」 | [password_change.js:282](../../../02_dashboard/src/password_change.js#L282) |
| `currentPassword` オートコンプリート | `current-password` | [password_change.html:48](../../../02_dashboard/password_change.html#L48) |
| `newPassword` / `confirmPassword` オートコンプリート | **未指定**（`new-password` 未設定） | §10-5 |
| **実サーバ API 接続** | **未実装**（モック `setTimeout`） | §10-2 |
| **完了画面の一元化** | **未実装**（step3 と独立ページが並存） | §10-1 |
| **強度基準文言と JS 判定の整合** | **ズレあり**（HTML「英字と数字」／JS「数字のみ」） | §10-3 |
| **パスワード履歴・現在値との同一禁止** | **未実装** | §10-6 |

---

## 2. 対象画面・関連ファイル

- `02_dashboard/password_change.html`（128 行、ウィザード本体、`#passwordChangeWizard` 配下に `#step1` / `#step2` / `#step3` を内包）
- `02_dashboard/password-change-complete.html`（55 行、独立した完了ページ。`#passwordChangeWizard` を持たず、`password_change.js` は呼ばれない）
- `02_dashboard/src/password_change.js`（289 行、`initPasswordChange()` を `export`）
- 依存モジュール:
  - [src/utils.js](../../../02_dashboard/src/utils.js)：`showToast()`（失敗時トースト表示。現行コードでは `handleNextStep2()` 失敗分岐のみで使用、[password_change.js:173](../../../02_dashboard/src/password_change.js#L173)）
  - [src/confirmationModal.js](../../../02_dashboard/src/confirmationModal.js)：`showConfirmationModal()`（サイドバー離脱ガードで使用、[password_change.js:279](../../../02_dashboard/src/password_change.js#L279)）
- 共通ルーティング: `<script type="module" src="./src/main.js">` と `./src/password_change.js` が `password_change.html` 末尾で直接読み込まれる（[password_change.html:125-126](../../../02_dashboard/password_change.html#L125)）。`password-change-complete.html` では `main.js` のみ（[password-change-complete.html:53](../../../02_dashboard/password-change-complete.html#L53)）。
- 共通注入: `#header-placeholder` / `#sidebar-placeholder` / `#footer-placeholder` / `#breadcrumb-container` は両 HTML 共通で `main.js` が注入する前提。
- サイドバー側連携: [src/sidebarHandler.js](../../../02_dashboard/src/sidebarHandler.js) がサイドバー描画完了後に `window.attachPasswordChangeNavGuard?.()` を呼び出すことで `setupSidebarNavigationGuard()` が有効化される（[password_change.js:248](../../../02_dashboard/src/password_change.js#L248)）。

**依存 CDN**（両 HTML 冒頭で共通）:
- Tailwind CDN（`plugins=forms,container-queries`、[password_change.html:8](../../../02_dashboard/password_change.html#L8)）
- Material Icons（同:10）
- `service-top-style.css`（同:12）
- Google Fonts Inter / Noto Sans JP（同:15）

---

## 3. 改訂履歴

- **v2.0 (2026-04-24)**: 実装トレース型へ全面刷新。`password_change.html` / `password-change-complete.html` / `password_change.js` の 3 ファイルを根拠に、ウィザード 3 ステップ、モック API、強度メーター、ナビガードをすべて文書化。完了画面の二重実装・強度基準の文言／判定ズレ・数字必須のみで英字未判定などの実装ギャップを §10 将来計画に集約。v1.x 系の Mermaid・モックデータ JSON 記載・「推奨: 8文字以上で、英字、数字、記号…」等の v1 文言は破棄。
- **v1.x (〜 2025-09-22)**: 「本書が正・モックは参照実装」スタンスで書かれた抽象仕様書。`data/dashboard/user_credentials.json` を前提とした記述、`POST /api/validate-password` / `POST /api/change-password` のエンドポイント記述、強度基準「推奨: …」文言などを含んでいたが実装と乖離していたため v2.0 で全面破棄。旧版をバックアップする場合は `_archive/` へ退避すること。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

**`password_change.html`（ウィザード本体）**

```
<body class="bg-background text-on-background">
├── #mobileSidebarOverlay                     … モバイル用オーバーレイ
├── #header-placeholder                       … 共通ヘッダー注入
└── <div class="flex flex-1 pt-16 bg-background">
    ├── #sidebar-placeholder                  … 共通サイドバー注入
    └── <main id="main-content">
        └── <div class="... max-w-2xl mx-auto">
            ├── #breadcrumb-container         … パンくず注入
            ├── <h1>パスワード変更</h1>
            └── #passwordChangeWizard         … bg-surface p-6 rounded-xl
                ├── #step1                    … 現在パスワード確認
                │   ├── <input #currentPassword type="password" autocomplete="current-password">
                │   ├── #currentPasswordError (.error-message)
                │   ├── <a #forgotPasswordLink href="forgot-password.html">
                │   ├── #cancelStep1 (キャンセル)
                │   └── #nextStep1 (次へ)
                ├── #step2.hidden             … 新パスワード入力
                │   ├── <input #newPassword type="password" required>
                │   ├── 表示切替ボタン [data-toggle-password="newPassword"]
                │   ├── #newPasswordError.hidden (.error-message)
                │   ├── 強度メーター
                │   │   ├── #strength-text   … 「パスワード強度: 弱い/普通/安全」
                │   │   ├── #strength-bar    … h-2 rounded-full 0%→100%
                │   │   └── #strength-criteria … 必須文言の静的表示
                │   ├── <input #confirmPassword type="password" required>
                │   ├── 表示切替ボタン [data-toggle-password="confirmPassword"]
                │   ├── #confirmPasswordError.hidden (.error-message)
                │   ├── #backStep2 (戻る)
                │   ├── #clearStep2 (クリア)
                │   └── #nextStep2 (変更する)
                └── #step3.hidden.text-center … 完了（同一ページ内）
                    ├── <span.material-icons> check_circle
                    ├── <h2>パスワードの変更が完了しました</h2>
                    ├── <p>新しいパスワードでログインしてください。</p>
                    └── #backToDashboard (ダッシュボードに戻る)
└── #footer-placeholder
```

**`password-change-complete.html`（独立完了ページ）**

```
<body class="bg-background text-on-background">
├── #mobileSidebarOverlay
├── #header-placeholder
└── <div class="flex flex-1 pt-16 bg-background">
    ├── #sidebar-placeholder
    └── <main id="main-content">
        └── <div class="... max-w-2xl mx-auto">
            ├── #breadcrumb-container
            ├── <h1>パスワード変更</h1>
            └── <div class="bg-surface p-6 rounded-xl text-center">
                ├── <span.material-icons> check_circle
                ├── <h2>パスワードの変更が完了しました</h2>
                ├── <p>新しいパスワードでログインしてください。</p>
                └── <a href="index.html">ダッシュボードに戻る</a>   … a 要素（button ではない）
└── #footer-placeholder
```

### 4.2 ウィザード 3 ステップ（step1 / step2 / step3）

`navigateToStep(n)` が全 step に `.hidden` を付与したうえで対象 step のみ `.hidden` を外す単純な切替。初期化時に `navigateToStep(1)` が呼ばれる（[password_change.js:82-87](../../../02_dashboard/src/password_change.js#L82) / [password_change.js:245](../../../02_dashboard/src/password_change.js#L245)）。

| step | 見出し | 先へ進む条件 | 戻る/離脱先 |
|------|--------|--------------|-------------|
| step1 | 現在のパスワードの確認 | `validateCurrentPassword()` 成功（モック） | キャンセル → `index.html` ／「パスワードを忘れた場合」→ `forgot-password.html` |
| step2 | 新しいパスワードの設定 | 空でない / 8 文字以上 / 数字含有 / 確認一致 → `changePassword()` 成功 | 戻る → step1 ／ クリア → 入力 2 欄を空に |
| step3 | パスワードの変更が完了しました | **実際には遷移しない**（step2 成功で独立ページへ `window.location.href`）。§4.3 参照 | ダッシュボードに戻る → `index.html` |

### 4.3 独立完了画面 `password-change-complete.html` との関係

現状の成功経路は `step2 → password-change-complete.html` の一方向で、同一ページ内 step3 には **通常フローで到達しない**。

- `handleNextStep2()` は `changePassword()` 成功後に `window.location.href = 'password-change-complete.html'` を実行する（[password_change.js:171](../../../02_dashboard/src/password_change.js#L171)）。
- `#step3` ブロックと `#backToDashboard` イベントハンドラは残ったままで、`navigateToStep(3)` を呼ぶコードは存在しない。
- したがって `#backToDashboard` / `#step3` は **現状デッドコード相当**。保守時に混乱するため §10-1 で一本化を追跡する。

二重実装である根拠:

| 観点 | step3（同一ページ） | `password-change-complete.html` |
|------|---------------------|-----------------------------------|
| 表示内容 | `check_circle` / 「パスワードの変更が完了しました」 / 「新しいパスワードでログインしてください。」 | 同文言・同アイコン |
| 「ダッシュボードに戻る」要素 | `<button #backToDashboard>` | `<a href="index.html">` |
| 遷移先 | `handleCancel()` 経由 `index.html` | `href="index.html"` |
| URL | `password_change.html` のまま | 新 URL（`password-change-complete.html`） |
| `password_change.js` | ロード済（`#passwordChangeWizard` が存在するため `initPasswordChange` がフル動作） | 未ロード（スクリプトタグなし） |

### 4.4 レスポンシブ

- コンテナは `max-w-2xl mx-auto`、左右パディング `px-4 sm:px-6 lg:px-8`。
- モバイルでも単一カラムで `#passwordChangeWizard` が `p-6 rounded-xl` のまま表示される。
- step2 のボタン群は `flex justify-end gap-4 pt-4`。3 ボタン並び（戻る / クリア / 変更する）が狭幅でも折返し可能（`flex-wrap` は未指定だが `min-w-[100px]` 単位）。
- step2 の強度メーター `#strength-bar` は `w-full` で親幅に追従。

---

## 5. 機能要件

### 5.1 step1: 現在のパスワード検証

**入力**: `#currentPassword`（`type="password"` / `autocomplete="current-password"`、[password_change.html:48](../../../02_dashboard/password_change.html#L48)）。

**トリガ**: `#nextStep1` クリック（[password_change.js:234](../../../02_dashboard/src/password_change.js#L234)）。

**`handleNextStep1()` の動作**（[password_change.js:97-119](../../../02_dashboard/src/password_change.js#L97)）:

| 優先度 | 分岐 | 結果 |
|--------|------|------|
| MVP | 空入力 | `#currentPasswordError` に「現在のパスワードを入力してください。」を表示、処理中断 |
| MVP | 入力あり | `#nextStep1` を `disabled=true` / 文言を「確認中...」に切替、`validateCurrentPassword()` を await |
| MVP | 検証成功（`password === 'password123'`） | `navigateToStep(2)` で step2 へ |
| MVP | 検証失敗 | `#currentPasswordError` に「現在のパスワードが正しくありません。」を表示 |
| MVP | いずれの結果でも最後に | `disabled=false` / 文言「次へ」に復旧 |

**キャンセル**: `#cancelStep1` クリック → `handleCancel()` → `window.location.href = 'index.html'`。確認モーダルは表示しない（[password_change.js:91-93](../../../02_dashboard/src/password_change.js#L91)）。

**パスワードを忘れた場合**: `#forgotPasswordLink` → `forgot-password.html` への純粋な `<a>` 遷移。JS 側のイベントハンドラは未設定。

### 5.2 step2: 新パスワード入力と強度チェック

**入力**: `#newPassword` と `#confirmPassword`（両方 `type="password"` 初期、表示切替ボタン `[data-toggle-password]` 付き）。

**リアルタイム処理**: `#newPassword` の `input` イベントで `handlePasswordInput()` が発火（[password_change.js:239](../../../02_dashboard/src/password_change.js#L239)）。

1. `#newPasswordError` のテキストを空にする（前回エラーをクリア）。
2. `checkPasswordStrength(password)` → 強度オブジェクト `{ level, text, color, width }` 取得。
3. `updatePasswordStrengthUI(strength)` で `#strength-text` / `#strength-bar` を更新。
4. `checkPasswordMatch()` で `#confirmPassword` との一致を即時確認。

> 注: `#confirmPassword` の `input` イベントは **未バインド**。確認欄を編集しても即時一致チェックは走らず、`#newPassword` 側を再入力するか「変更する」押下時に初めて評価される（§10-7）。

**強度スコアリング**（`checkPasswordStrength()`、[password_change.js:189-203](../../../02_dashboard/src/password_change.js#L189)）:

| 加点条件 | 判定 |
|----------|------|
| 空文字 | `level=-1` / width 0% / 表示なし |
| 長さ ≥ 8 | +1 |
| 長さ ≥ 10 | +1 |
| `/[a-z]/` **かつ** `/[A-Z]/` | +1（両方必要） |
| `/[0-9]/` | +1 |
| `/[^a-zA-Z0-9]/` | +1 |

| 合計スコア | 表示 | バー色 / 幅 |
|------------|------|-------------|
| score < 2 | 弱い | `bg-error` / 33% |
| 2 ≤ score < 4 | 普通 | `bg-warning` / 66% |
| score ≥ 4 | 安全 | `bg-success` / 100% |

**「変更する」押下時の検証**（`handleNextStep2()`、[password_change.js:132-178](../../../02_dashboard/src/password_change.js#L132)）:

| 優先度 | 条件 | エラー文言 / 動作 |
|--------|------|-------------------|
| MVP | `#newPassword` が空 | 「新しいパスワードを入力してください。」（inline、`.hidden` を外す） |
| MVP | 長さ < 8 | 「パスワードは8文字以上で入力してください。」 |
| MVP | `/[0-9]/` 不含 | 「パスワードには少なくとも1つの数字を含めてください。」 |
| MVP | `#confirmPassword` が空 or 不一致 | `checkPasswordMatch()` が `#confirmPasswordError` に「パスワードが一致しません。」を表示。`handleNextStep2()` は `return` |
| MVP | 上記すべて通過 | `#nextStep2` を `disabled=true` / 文言「変更中...」、`changePassword()` を await |
| MVP | 成功 | `window.location.href = 'password-change-complete.html'`（§4.3 参照） |
| MVP | 失敗 | `showToast(result.message, 'error')`（モックでは失敗経路なし、§10-8） |
| MVP | 成功 / 失敗いずれも末尾 | `disabled=false` / 文言「変更する」に復旧 |

> **重要**: HTML の注意文言は「8 文字以上で、**英字と数字**を必ず含めてください」（[password_change.html:83](../../../02_dashboard/password_change.html#L83)）だが、JS の判定は「数字を含む」のみで英字チェックは無い。ユーザーが `12345678` を入力してもエラーにならず通過する（§10-3）。

### 5.3 step3: 完了画面（同一ページ内）

- HTML 上は `#passwordChangeWizard` 配下に `#step3.hidden` として定義されている（[password_change.html:106-113](../../../02_dashboard/password_change.html#L106)）。
- 表示要素: `check_circle` アイコン（`text-6xl text-success`）、`<h2>パスワードの変更が完了しました</h2>`、案内文、`#backToDashboard` ボタン。
- `#backToDashboard` のハンドラは `handleCancel`（= `index.html` 遷移）を再利用する（[password_change.js:241](../../../02_dashboard/src/password_change.js#L241)）。
- **現行コードから `navigateToStep(3)` は呼ばれない** ため、この step は事実上デッドコード。§10-1 で完了画面の一本化を追跡する。

### 5.4 独立完了画面 `password-change-complete.html`

- `step2` の `changePassword()` 成功で `window.location.href` により遷移。URL が `password-change-complete.html` に切り替わり、`password_change.js` は再ロードされない（`#passwordChangeWizard` が無いので `initPasswordChange()` は `return`）。
- 「ダッシュボードに戻る」は純粋な `<a href="index.html">` で、確認モーダルやイベントハンドラは介在しない（[password-change-complete.html:42](../../../02_dashboard/password-change-complete.html#L42)）。
- ヘッダー・サイドバー・フッター・パンくずは `main.js` による共通注入。パンくずの現在位置文言は本画面専用の登録が必要（現状登録済みかは `main.js` / `breadcrumb.js` 側で確認、§10-9）。

### 5.5 表示/非表示トグル

`setupPasswordVisibilityToggle()`（[password_change.js:29-47](../../../02_dashboard/src/password_change.js#L29)）:

- `[data-toggle-password]` 属性を持つ全ボタンに `click` リスナを付与。
- ボタン内の `.material-icons` テキスト（`visibility` ⇄ `visibility_off`）と対象 `<input>` の `type` 属性（`password` ⇄ `text`）を同期切替。
- 対象は step2 の `#newPassword` / `#confirmPassword` の 2 つのみ（step1 の `#currentPassword` には表示切替ボタンは配置されていない）。

### 5.6 クリアボタン

`handleClearStep2()`（[password_change.js:125-130](../../../02_dashboard/src/password_change.js#L125)）:

1. `#newPassword.value = ''`
2. `#confirmPassword.value = ''`
3. `handlePasswordInput()` を呼び、強度メーター・エラー状態をリセット。
4. `checkPasswordMatch()` を呼び、確認エラーも解除（空 vs 空なので一致扱い）。

> 注: 表示切替で `type="text"` に変更されていた場合、クリア後もテキスト表示のまま残る（アイコンも `visibility_off` のまま）。これは UX 仕様として許容する（§10-10 で追跡）。

### 5.7 導線（`forgotPasswordLink`）

- `#forgotPasswordLink` は `<a href="forgot-password.html">`（[password_change.html:52](../../../02_dashboard/password_change.html#L52)）。
- JS では DOM 参照のみ取得し（[password_change.js:63](../../../02_dashboard/src/password_change.js#L63)）、イベントハンドラは付けていない。すなわち純粋な `<a>` 遷移で、未保存入力があってもナビゲーションガードは走らない（§10-11）。

### 5.8 サイドバーナビゲーションガード

`setupSidebarNavigationGuard()`（[password_change.js:269-288](../../../02_dashboard/src/password_change.js#L269)）:

- `window.attachPasswordChangeNavGuard` にエクスポートし、サイドバー描画完了後に外部（`sidebarHandler.js`）から呼び出させる。
- `#sidebar-placeholder` 内の全 `<a>` に `click` リスナを追加。
- `hasUnsavedChanges()`（`#currentPassword` / `#newPassword` / `#confirmPassword` のいずれかが非空）が `true` の場合、`event.preventDefault()` のうえ `showConfirmationModal('変更が保存されていません。ページを移動しますか？', callback, '移動する')` を表示。
- `beforeunload` で `window.attachPasswordChangeNavGuard` を `delete`（[password_change.js:251-253](../../../02_dashboard/src/password_change.js#L251)）。

> 注: キャンセルボタン（`#cancelStep1`）、パスワード忘れリンク（`#forgotPasswordLink`）、ヘッダーのリンク、ブラウザの戻るボタンにはガードは **掛からない**。サイドバー経由のみ保護（§10-11）。

---

## 6. データモデル

### 6.1 state 構造

本画面では明示的な state オブジェクトは持たず、全状態を DOM（入力値 + クラス `.hidden`）に保持する。UI 駆動の最小実装。

| 仮想 state | 実体 | リセットタイミング |
|-----------|------|-------------------|
| 現在 step | `#step1` / `#step2` / `#step3` の `.hidden` 有無 | `navigateToStep(n)` |
| 現在パスワード入力 | `#currentPassword.value` | ページ離脱まで保持 |
| 新パスワード入力 | `#newPassword.value` | クリア / ページ離脱 |
| 確認入力 | `#confirmPassword.value` | クリア / ページ離脱 |
| 強度結果 | `#strength-text.textContent` / `#strength-bar.className` / `.style.width` | 次回 `handlePasswordInput()` |
| 各種エラー | `#currentPasswordError` / `#newPasswordError` / `#confirmPasswordError` の `.textContent` と `.hidden` | 次回入力・検証時 |
| ボタン loading | `.disabled` / `.textContent` | API コールバック末尾で復旧 |

### 6.2 バリデーションルール

| 対象 | ルール | 判定箇所 |
|------|--------|----------|
| `currentPassword` | 非空 | [password_change.js:101](../../../02_dashboard/src/password_change.js#L101) |
| `currentPassword` | `=== 'password123'` | [password_change.js:10](../../../02_dashboard/src/password_change.js#L10) （モック） |
| `newPassword` | 非空 | [password_change.js:140](../../../02_dashboard/src/password_change.js#L140) |
| `newPassword` | 長さ ≥ 8 | [password_change.js:146](../../../02_dashboard/src/password_change.js#L146) |
| `newPassword` | `/[0-9]/.test(...)` | [password_change.js:152](../../../02_dashboard/src/password_change.js#L152) |
| `confirmPassword` | `newPassword === confirmPassword` | [password_change.js:218](../../../02_dashboard/src/password_change.js#L218) |

### 6.3 モック API 契約

| 関数 | 入力 | 出力 | 実装行 |
|------|------|------|--------|
| `validateCurrentPassword(password)` | 文字列 | `{ success: true }` または `{ success: false, message: '...' }` | [password_change.js:5-17](../../../02_dashboard/src/password_change.js#L5) |
| `changePassword(newPassword)` | 文字列 | `{ success: true, message: '...' }` のみ（モック失敗分岐なし） | [password_change.js:19-27](../../../02_dashboard/src/password_change.js#L19) |

両関数とも `Promise` + `setTimeout(500)` を返すだけの純粋なモック。

---

## 7. パスワード強度基準

**正本文言**（HTML 直書き、[password_change.html:83](../../../02_dashboard/password_change.html#L83)）:

> 必須: 8文字以上で、英字と数字を必ず含めてください。記号を組み合わせるとより安全になります。

| 基準 | 種別 | 現行 JS 判定 | 備考 |
|------|------|--------------|------|
| 8 文字以上 | 必須 | あり（[password_change.js:146](../../../02_dashboard/src/password_change.js#L146)） | エラー文言一致 |
| 英字を含む | 必須（HTML 表示上） | **なし** | §10-3 の矛盾点 |
| 数字を含む | 必須 | あり（[password_change.js:152](../../../02_dashboard/src/password_change.js#L152)） | |
| 記号を含む | 推奨（強度加点のみ） | あり（スコア加点 only） | ブロックはしない |
| 大文字小文字混在 | 推奨（強度加点のみ） | あり（スコア加点 only） | ブロックはしない |

**本書確定事項**: 実装ベースで「8 文字以上 かつ 英字と数字を必須」とする。ただし現行 JS では英字判定が欠落しているため、§10-3 で「英字判定の実装追加」を MVP 級で追跡する。

**強度表示の段階**: 5.2 節のスコアリング表参照。「弱い」評価でも `handleNextStep2()` は変更をブロックしない（強度は視覚フィードバック専用）。

---

## 8. 非機能要件

### 8.1 セキュリティ（本フェーズで保証される範囲）

| 項目 | 実装状況 | ソース |
|------|----------|--------|
| 入力値マスク（`type="password"`） | あり（初期状態） | [password_change.html:48](../../../02_dashboard/password_change.html#L48) / [password_change.html:65](../../../02_dashboard/password_change.html#L65) / [password_change.html:89](../../../02_dashboard/password_change.html#L89) |
| `autocomplete="current-password"` | あり（step1） | [password_change.html:48](../../../02_dashboard/password_change.html#L48) |
| `autocomplete="new-password"` | **未指定**（§10-5） | step2 の 2 欄 |
| 表示切替ボタン | step2 のみ提供 | [password_change.html:67](../../../02_dashboard/password_change.html#L67) / [password_change.html:91](../../../02_dashboard/password_change.html#L91) |
| サーバサイド検証 | **モックのみ** | §10-2 |
| CSRF トークン | **未実装** | §10-2 |
| レート制限・アカウントロック | **未実装**（v1 で記載されていた「3 回間違えたらロック示唆」も未実装） | §10-12 |
| ハッシュ化（Argon2/bcrypt） | サーバ側で担保する前提、本画面範囲外 | §10-2 |
| HTTPS 強制 | インフラ領域、本書対象外 | - |

### 8.2 アクセシビリティ

- フォームラベル: `input-group` パターン（`<input>` + `<label for>`）を全入力欄で使用。
- エラー表示: `.error-message` クラスと隣接配置。`aria-describedby` / `aria-invalid` は **未付与**（§10-13）。
- 強度メーター: `#strength-bar` は視覚のみ。`aria-valuenow` / `role="progressbar"` 等は未設定（§10-13）。
- キーボード操作: 全ボタン・入力は通常 Tab フォーカス可能。Enter キーによる submit は `<form>` ラッパーが無いため発火せず、マウス or Enter on button のみで進める（§10-14）。
- フォーカス管理: `navigateToStep(n)` 後に step 内先頭入力にフォーカスを移す処理は無い（§10-14）。

### 8.3 パフォーマンス

- JS ファイルは `type="module"` の通常ロード。単一ファイル 289 行、依存は `utils.js` と `confirmationModal.js` のみ。
- 強度計算は正規表現 5 本のみの O(n) で、入力毎に同期実行（デバウンスなし、問題にならない軽さ）。
- API 呼び出しは 500ms の固定待機モック。本番接続時はタイムアウト・リトライ戦略を規定（§10-2）。

---

## 9. Definition of Done

| # | 条件 | 検証方法 |
|---|------|----------|
| 1 | step1 で空送信 → 「現在のパスワードを入力してください。」が表示 | 手動 |
| 2 | step1 で誤パスワード送信 → 「現在のパスワードが正しくありません。」が表示 | 手動（モック判定） |
| 3 | step1 で `password123` 送信 → step2 に遷移 | 手動 |
| 4 | step2 で空送信 → 「新しいパスワードを入力してください。」 | 手動 |
| 5 | step2 で 7 文字入力 → 「パスワードは8文字以上で入力してください。」 | 手動 |
| 6 | step2 で 8 文字英字のみ → **現状エラーにならず通過する**（§10-3 修正後は「英字と数字が必要」メッセージ） | 手動 |
| 7 | step2 で 8 文字 `12345678` → 通過（§10-3 修正後はエラー） | 手動 |
| 8 | step2 で新 ≠ 確認 → 「パスワードが一致しません。」 | 手動 |
| 9 | 強度メーターが入力に応じて 3 段階（弱い / 普通 / 安全）で色と幅が変わる | 目視 |
| 10 | 表示切替ボタンで `type` が `password` ↔ `text` に切り替わる | 目視 |
| 11 | クリアボタンで 2 欄が空になり強度メーターがリセットされる | 目視 |
| 12 | 成功経路で `password-change-complete.html` に遷移する | 手動 |
| 13 | `password-change-complete.html` の「ダッシュボードに戻る」で `index.html` に戻る | 手動 |
| 14 | 入力ありの状態でサイドバー遷移 → 確認モーダル「変更が保存されていません…」表示 | 手動（`sidebarHandler.js` 経由） |
| 15 | `#cancelStep1` / 「パスワードを忘れた場合」はガードされず即遷移する（現行仕様） | 手動 |

---

## 10. 将来計画（Phase 2 以降）

実装差分・バグ疑い・仕様ギャップを一元管理する。番号は本書内の参照先。

| # | 項目 | 現状 | 到達像 | 優先度 |
|---|------|------|--------|--------|
| **1** | **完了画面の二重実装を一本化** | `#step3`（デッドコード）と `password-change-complete.html`（実使用）が並存 | どちらかに寄せる。推奨は独立ページ（URL が変わるためブックマーク・再読込に耐える）とし、`#step3` ブロックと `#backToDashboard` 関連コード（[password_change.html:106-113](../../../02_dashboard/password_change.html#L106) / [password_change.js:80](../../../02_dashboard/src/password_change.js#L80) / [password_change.js:241](../../../02_dashboard/src/password_change.js#L241)）を削除 | MVP |
| **2** | **実サーバ API 接続** | `validateCurrentPassword()` / `changePassword()` はモック `setTimeout`（[password_change.js:5-27](../../../02_dashboard/src/password_change.js#L5)） | 実 API `POST /api/auth/verify-password` / `POST /api/auth/change-password`（仮）に差し替え。CSRF トークン付与、エラーレスポンスのハンドリング、タイムアウト・リトライ | MVP |
| **3** | **強度基準「必須」文言と JS 判定の整合** | HTML 文言は「英字と数字」、JS は「数字のみ」判定（英字ブロックなし） | `/[a-zA-Z]/.test(...)` 判定を追加し、欠落時に「パスワードには少なくとも1つの英字を含めてください。」を表示 | MVP |
| **4** | **パスワード変更成功後のセッション処理** | クライアント側で単純リダイレクトのみ | サーバからの再ログイン要求・旧セッション無効化・トークン再発行を反映 | MVP |
| **5** | **`autocomplete="new-password"` 付与** | step2 の 2 欄とも未指定 | `#newPassword` / `#confirmPassword` に `autocomplete="new-password"` を追加。ブラウザ強度提案・パスワードマネージャ対応 | Should |
| **6** | **パスワード履歴・現在値との同一禁止** | 未実装 | 直近 N 世代との一致禁止、`newPassword === currentPassword` の明示禁止。クライアント側で先行チェックする場合は `validateCurrentPassword` 成功時に受領した hash 比較（サーバ実装ありき） | Should |
| **7** | **`confirmPassword` の `input` リスナ** | 未バインド。確認欄単独の編集ではエラー表示が更新されない（[password_change.js:239](../../../02_dashboard/src/password_change.js#L239) 参照） | `confirmPasswordInput.addEventListener('input', checkPasswordMatch)` を追加 | Should |
| **8** | **`changePassword` の失敗経路** | モックは常に成功。`showToast(result.message, 'error')` 分岐はデッドコード（[password_change.js:172-174](../../../02_dashboard/src/password_change.js#L172)） | 本番 API 接続時にエラーパターン（同一パスワード / ポリシー違反 / サーバエラー）を規定・文言策定 | Should |
| **9** | **`password-change-complete.html` のパンくず登録** | 登録状況未検証 | `breadcrumb.js` に専用エントリ（「アカウント情報 > パスワード変更 > 完了」相当）を追加 | Nice |
| **10** | **表示切替後の状態が「クリア」で戻らない** | クリア後も `type="text"` / `visibility_off` アイコンが残る | クリア時に `type="password"` / `visibility` アイコンに戻す | Nice |
| **11** | **`forgotPasswordLink` / `#cancelStep1` のナビゲーションガード** | 未保護（サイドバーのみガード） | 入力ありの状態で確認モーダルを挟むか、挟まない方針を UX として明文化 | Should |
| **12** | **レート制限・アカウントロック** | 未実装（v1 書面で言及のみ） | 現在パスワード誤入力回数に応じたロック、ロック時の文言・導線 | MVP（サーバ連携後） |
| **13** | **アクセシビリティ属性** | `aria-invalid` / `aria-describedby` / `role="progressbar"` 等いずれも未付与 | 各エラー領域と入力を `aria-describedby` で紐付け、`aria-invalid` を動的更新、強度バーに `role="progressbar"` + `aria-valuenow`/`aria-valuemax` | Should |
| **14** | **Enter キー送信 / `<form>` 化** | `<form>` 要素なし。Enter で送信されない | `<form>` で各 step を囲み、`onsubmit` で `handleNextStepX` を呼ぶ。合わせてフォーカス移動も整理 | Nice |
| **15** | **クリアボタン押下時の `newPasswordError` 明示リセット** | `handlePasswordInput` 経由で `textContent=''` は行うが `.hidden` クラスは戻さない（[password_change.js:183](../../../02_dashboard/src/password_change.js#L183)） | クリア直後に `#newPasswordError.classList.add('hidden')` を実行 | Nice |
| **16** | **多要素認証（MFA）** | 未実装 | MFA 有効ユーザーは現在パスワード検証後に TOTP 等を要求 | Phase 2 |

---

## 11. 用語集

| 用語 | 意味 |
|------|------|
| **ウィザード** | 複数ステップを `.hidden` 切替で順に進める UI パターン。本画面は 3 step。 |
| **モック API** | `setTimeout` で成功/失敗を模擬する擬似非同期関数。実サーバ接続前の仮実装。 |
| **ナビゲーションガード** | 未保存変更がある状態でサイドバー遷移しようとした際、確認モーダルで引き止める仕組み。 |
| **強度メーター** | 入力パスワードを 0〜5 点でスコアリングし 3 段階（弱い / 普通 / 安全）にマップして表示するバー。 |
| **表示切替ボタン** | `[data-toggle-password]` 属性で対象 `<input>` の `type` を `password` ↔ `text` に切り替える目玉アイコンボタン。 |
| **ハンドオフ** | step 間・ページ間で状態（入力値 / 成功フラグ）を受け渡すこと。本画面では DOM のみで完結し、`sessionStorage` は使用しない。 |

---

## 12. 関連ファイル・デッドコード棚卸し

**アクティブ**:
- [password_change.html](../../../02_dashboard/password_change.html)（step1 / step2 は実使用）
- [password-change-complete.html](../../../02_dashboard/password-change-complete.html)（成功後の実遷移先）
- [src/password_change.js](../../../02_dashboard/src/password_change.js)（`initPasswordChange()` が `main.js` 経由で呼ばれる想定）
- [src/utils.js](../../../02_dashboard/src/utils.js) → `showToast()`
- [src/confirmationModal.js](../../../02_dashboard/src/confirmationModal.js) → `showConfirmationModal()`
- [src/sidebarHandler.js](../../../02_dashboard/src/sidebarHandler.js) → `window.attachPasswordChangeNavGuard?.()` 呼び出し側

**デッドコード疑い**（§10 で追跡）:
- `#step3` ブロック（[password_change.html:106-113](../../../02_dashboard/password_change.html#L106)）：`navigateToStep(3)` が呼ばれないため表示経路なし
- `#backToDashboard` とそのイベント登録（[password_change.js:80](../../../02_dashboard/src/password_change.js#L80) / [password_change.js:241](../../../02_dashboard/src/password_change.js#L241)）
- `changePassword()` 失敗分岐の `showToast(result.message, 'error')`（モックが常に成功するため到達不能、[password_change.js:172-174](../../../02_dashboard/src/password_change.js#L172)）

**削除済み（v1 記述の遺物）**:
- `data/dashboard/user_credentials.json` への参照（v1 記載のみ、実装に対応ファイル無し）
- `POST /api/validate-password` / `POST /api/change-password` の明示的エンドポイント記述（v1 のみ）
- 「3 回間違えたらアカウントロックを示唆」の記述（v1 のみ、実装無し）

---

## 13. 関連仕様書との関係

| 関連仕様 | 関係 |
|----------|------|
| [10_password_reset_feature.md](./10_password_reset_feature.md) | ログイン **前** のパスワードリセット（メールトークン方式）。本画面の `#forgotPasswordLink` → `forgot-password.html` への導線先。本書はログイン **後** の変更のみ扱う。 |
| `accountInfoModal.js`（`05` 番台想定） | 本画面への主要導線。モーダル内「パスワードを変更する」ボタンから `password_change.html` へ遷移。本書では導線の存在のみ前提とする。 |
| `00_screen_requirements.md` | 共通ヘッダー・サイドバー・フッター・パンくず・デザイントークンの基底仕様。本画面はそれに準拠。 |
| `design/01_ui_messages.md` | エラーメッセージ・トースト文言の共通定義。本書で列挙した文言は最終的に本定義へ集約されることを想定。 |
