---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# パスワードリセット機能 要件定義書

> **TL;DR**
> - 対象は「ログイン前」のパスワード再設定フロー。ログイン画面の「パスワードを忘れた方」導線から入り、3 画面（`forgot-password.html` / `reset-password.html` / `reset-password-complete.html`）と 2 本の JS（`forgot-password.js` 77 行 / `reset-password.js` 101 行）で構成される。ログイン後の変更導線（マイページ内パスワード変更）は本書対象外（`09_password_change_screen.md` 参照）。
> - 本書は「画面が正」方針。v1.x までの抽象定義（タイミング攻撃対策、URL トークン発行仕様、zxcvbn スコア閾値等）は**現行実装には未接続**のため §10 将来計画へ集約し、本編には実装上の事実のみを記述する。
> - forgot 画面の送信処理は **1,000ms の `setTimeout` モック**で、API 呼び出し・メール送信・メールアドレス存在チェックはすべて未実装（[forgot-password.js:68](../../../02_dashboard/src/forgot-password.js#L68)）。reset 画面の送信処理は **`console.log` + 遷移のみ**で API 呼び出しなし（[reset-password.js:96-98](../../../02_dashboard/src/reset-password.js#L96)）。
> - パスワード強度基準は UI ヒント文言（`必須: 8文字以上で、英字と数字を必ず含めてください。記号を組み合わせるとより安全になります。`）を正とする。ただし JS のバリデーションは **「8 文字以上 + 数字 1 文字以上」しかチェックしておらず英字必須は未実装**。§10-5 で追跡。
> - reset 画面は `zxcvbn` CDN（v4.4.2）による強度インジケーター（`弱い / 普通 / 安全` 3 段）をリアルタイム表示するが、強度スコアは送信可否には**関与しない**（§5.2）。URL トークンの受信・検証ロジックも未実装（§10-2）。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§10 に集約。 |

### 1.2 目的・想定利用者

自社アカウントのパスワードを失念したユーザーが、登録メールアドレス経由で自らパスワードを再設定できるようにする。ログイン前の動線のため、認証済み利用者（ダッシュボード内）は対象外。

想定利用者:

- SPEED AD 管理画面を利用するクライアント担当者（営業・運用・経理いずれも）。
- 初回ログイン試行に失敗し、ログイン画面からセルフサービスで復旧を試みるユーザー。

### 1.3 対象範囲 / 対象外

**対象**:

- `02_dashboard/forgot-password.html`（104 行）
- `02_dashboard/reset-password.html`（86 行）
- `02_dashboard/reset-password-complete.html`（44 行）
- `02_dashboard/src/forgot-password.js`（77 行）
- `02_dashboard/src/reset-password.js`（101 行）

**対象外**（本書では §10 で参照のみ）:

- ログイン後のパスワード変更画面（`09_password_change_screen.md` 配下）。
- ログイン画面本体（`02_dashboard/index.html`）。本書は同画面からの「パスワードを忘れた方」導線のみを扱う。
- リセット URL 生成・メール送信・トークン検証のバックエンド実装（現状すべて未実装）。
- 管理者による代理パスワード再発行機能。

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・文言の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§10 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| forgot 送信モック遅延 | 1,000ms（`setTimeout`） | [forgot-password.js:68](../../../02_dashboard/src/forgot-password.js#L68) |
| forgot 成功メッセージ | 「ご入力のメールアドレスに、パスワード再設定の手順をお送りしました。メールをご確認ください。」 | [forgot-password.js:74](../../../02_dashboard/src/forgot-password.js#L74) |
| email 形式正規表現 | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | [forgot-password.js:49](../../../02_dashboard/src/forgot-password.js#L49) |
| ローディング文言 | 「送信中...」 | [forgot-password.js:65](../../../02_dashboard/src/forgot-password.js#L65) |
| パスワード最小長（バリデーション） | 8 文字 | [reset-password.js:67](../../../02_dashboard/src/reset-password.js#L67) |
| パスワード必須文字種（バリデーション） | 数字 1 文字以上のみ | [reset-password.js:71](../../../02_dashboard/src/reset-password.js#L71) |
| パスワード強度ヒント文言（UI 正） | 「必須: 8文字以上で、英字と数字を必ず含めてください。記号を組み合わせるとより安全になります。」 | [reset-password.html:66](../../../02_dashboard/reset-password.html#L66) |
| 強度判定ライブラリ | `zxcvbn` 4.4.2（CDN） | [reset-password.html:83](../../../02_dashboard/reset-password.html#L83) |
| 強度レベル（3 段） | `弱い(0-1) / 普通(2-3) / 安全(4)` | [reset-password.js:12-18](../../../02_dashboard/src/reset-password.js#L12) |
| 強度バー伸長率 | 20 / 40 / 60 / 80 / 100 % | [reset-password.js:13-17](../../../02_dashboard/src/reset-password.js#L13) |
| 完了画面アイコン | 絵文字 `✅` | [reset-password-complete.html:37](../../../02_dashboard/reset-password-complete.html#L37) |
| 完了遷移先 | `../index.html`（ログイン画面） | [reset-password-complete.html:40](../../../02_dashboard/reset-password-complete.html#L40) |
| reset 送信成功時の遷移先 | `reset-password-complete.html` | [reset-password.js:98](../../../02_dashboard/src/reset-password.js#L98) |
| **英字必須チェック** | **未実装**（UI 文言には明記あり） | §5.2.4 / §10-5 |
| **URL トークン取得・検証** | **未実装**（`location.search` 参照なし） | §4.3 / §10-2 |
| **forgot 画面 API 呼出** | **モック**（`setTimeout` のみ） | [forgot-password.js:68](../../../02_dashboard/src/forgot-password.js#L68) / §10-1 |
| **reset 画面 API 呼出** | **未実装**（`console.log` のみ） | [reset-password.js:97](../../../02_dashboard/src/reset-password.js#L97) / §10-1 |
| **二重送信防止（reset）** | **未実装**（forgot のみローディング制御あり） | §10-6 |
| **トークン有効期限 UI** | **未実装** | §10-3 |
| **強度スコアによる送信ブロック** | **なし**（表示のみ） | §5.2.5 / §10-7 |

---

## 2. 対象画面・関連ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| `02_dashboard/forgot-password.html` | 104 | メールアドレス入力画面のマークアップ & インライン CSS |
| `02_dashboard/reset-password.html` | 86 | 新パスワード入力画面のマークアップ & インライン CSS |
| `02_dashboard/reset-password-complete.html` | 44 | 完了画面のマークアップ & インライン CSS（JS なし） |
| `02_dashboard/src/forgot-password.js` | 77 | forgot 画面のバリデーション・ローディング制御・モック送信 |
| `02_dashboard/src/reset-password.js` | 101 | reset 画面のバリデーション・zxcvbn 強度表示・表示/非表示トグル・遷移 |

**依存 CDN**:

- Google Fonts Noto Sans JP / Inter（全 3 画面）。
- Material Icons（`reset-password.html` のみ、表示/非表示アイコン用、[reset-password.html:7](../../../02_dashboard/reset-password.html#L7)）。
- `zxcvbn` 4.4.2（`reset-password.html` のみ、[reset-password.html:83](../../../02_dashboard/reset-password.html#L83)）。
- 背景画像 `https://images.unsplash.com/photo-1543269865-cbf427effbad`（全 3 画面で同一）。

**共通化されていない項目**（参考）:

- 3 画面ともインライン `<style>` に CSS 変数群・レイアウト・フォーム・ボタン定義を重複記述。共通 `index.css` を `forgot-password.html` のみ読み込んでおり（[forgot-password.html:10](../../../02_dashboard/forgot-password.html#L10)）、`reset-password.html` / `reset-password-complete.html` は未読込（§10-10）。
- 共通ヘッダー・サイドバー・フッターの注入はしない（ログイン前フローのため）。

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。3 画面（forgot / reset / complete）＋ 2 JS を単一ドキュメントに統合。現行の「モック送信 + URL トークン未実装 + 英字必須未チェック」状態を正として記述し、v1.1 までの「タイミング攻撃対策」「bcrypt ハッシュ化」「1 時間有効期限」等の抽象記述は §10 将来計画に送り、本編からは削除。
- v1.1 (〜2026-04-23): サーバサイド実装を前提とした抽象仕様書。現行実装とは乖離していたため v2.0 で破棄。

---

## 4. 画面フロー

### 4.1 全体フロー図

```
┌──────────────────────┐
│ index.html           │
│ （ログイン画面）      │
│                      │
│  [パスワードを        │
│   忘れた方]クリック    │
└──────────┬───────────┘
           ▼
┌──────────────────────────────────────────┐
│ forgot-password.html                    │
│  - email 入力                            │
│  - 「送信」ボタン                         │
│  - バリデーション（必須・形式）             │
└──────────┬───────────────────────────────┘
           │ submit（1秒モック遅延）
           ▼
┌──────────────────────────────────────────┐
│ forgot-password.html（同一画面内）          │
│  - form.style.display = 'none'          │
│  - #success-message を表示               │
│    「ご入力のメールアドレスに、…」           │
└──────────┬───────────────────────────────┘
           │（理論上）メール記載 URL をクリック
           │  ※ URL トークン検証は未実装（§10-2）
           ▼
┌──────────────────────────────────────────┐
│ reset-password.html                     │
│  - 新PW 入力                              │
│  - 確認PW 入力                            │
│  - zxcvbn 強度インジケーター                │
│  - 表示/非表示トグル                        │
│  - 「パスワードを再設定」ボタン              │
└──────────┬───────────────────────────────┘
           │ submit（console.log のみ）
           ▼
┌──────────────────────────────────────────┐
│ reset-password-complete.html             │
│  - ✅ アイコン                             │
│  - 「再設定完了」                          │
│  - 「ログイン画面へ」ボタン                  │
└──────────┬───────────────────────────────┘
           ▼
      index.html に戻る
```

### 4.2 画面遷移サマリ

| From | To | 契機 | 実装 |
|------|-----|------|------|
| `index.html` | `forgot-password.html` | 「パスワードを忘れた方」リンク | ログイン画面側。本書対象外（§12） |
| `forgot-password.html`（入力状態） | `forgot-password.html`（成功状態） | `form submit` 成功 | `form.style.display='none'` ＋ `#success-message.style.display='block'`（[forgot-password.js:73-75](../../../02_dashboard/src/forgot-password.js#L73)） |
| `forgot-password.html` | `index.html` | 「ログイン画面に戻る」 | `<a href="../index.html">`（[forgot-password.html:98](../../../02_dashboard/forgot-password.html#L98)） |
| メール記載 URL | `reset-password.html` | ユーザーがメール内 URL をクリック | **未実装**。トークン受け渡し仕様なし。 |
| `reset-password.html` | `reset-password-complete.html` | `form submit` バリデーション通過 | `window.location.href = 'reset-password-complete.html'`（[reset-password.js:98](../../../02_dashboard/src/reset-password.js#L98)） |
| `reset-password.html` | `index.html` | 「ログイン画面に戻る」 | `<a href="../index.html">`（[reset-password.html:79](../../../02_dashboard/reset-password.html#L79)） |
| `reset-password-complete.html` | `index.html` | 「ログイン画面へ」ボタン | `<a class="button button--filled" href="../index.html">`（[reset-password-complete.html:40](../../../02_dashboard/reset-password-complete.html#L40)） |

### 4.3 URL パラメータ（トークン）

**現行**:

- `reset-password.js` は `window.location.search` / `URLSearchParams` を**一切参照していない**（`grep` 済）。
- `reset-password.html` にもクエリパラメータを受け取る `<input type="hidden">` や `data-*` 属性は存在しない。
- つまり「誰でも `reset-password.html` を直接 URL 入力するだけで到達でき、新パスワードを送信すれば（モック上）完了画面まで進める」。

**期待**（§10-2 で追跡）:

- メール記載 URL は `https://<host>/reset-password.html?token=<opaque>` 形式になる想定。
- ページロード時にトークンを取得し、サーバ検証 API を呼んで有効性・期限をチェック。無効・期限切れなら専用メッセージを表示。

---

## 5. 機能要件

### 5.1 forgot-password.html: メールアドレス入力

#### 5.1.1 フォーム要素

| 要素 ID | 種別 | 属性 | ソース |
|---------|------|------|--------|
| `#forgot-password-form` | `<form novalidate>` | - | [forgot-password.html:86](../../../02_dashboard/forgot-password.html#L86) |
| `#email` | `<input type="email">` | `required` / `aria-required="true"` / `autocomplete="email"` / `aria-describedby="email-error"` | [forgot-password.html:89](../../../02_dashboard/forgot-password.html#L89) |
| `#email-error` | `<div role="alert">` | エラー文言を差し込む | [forgot-password.html:90](../../../02_dashboard/forgot-password.html#L90) |
| 送信ボタン | `<button type="submit">` | `.button.button--filled` / 内部に `.button__spinner` | [forgot-password.html:92-95](../../../02_dashboard/forgot-password.html#L92) |
| `#success-message` | `<div role="status">` | 初期 `display:none`、送信成功で `display:block` | [forgot-password.html:84](../../../02_dashboard/forgot-password.html#L84) |
| 「ログイン画面に戻る」 | `<a href="../index.html">` | `.sub-links__item` | [forgot-password.html:98](../../../02_dashboard/forgot-password.html#L98) |

**見出し・説明文**（HTML 直書き）:

- タイトル「パスワードをお忘れですか？」（[forgot-password.html:81](../../../02_dashboard/forgot-password.html#L81)）。
- 説明「ご登録のメールアドレスを入力してください。<br>パスワード再設定用のURLをお送りします。」（[forgot-password.html:82](../../../02_dashboard/forgot-password.html#L82)）。

#### 5.1.2 バリデーション（`validateEmail()`）

実装: [forgot-password.js:39-55](../../../02_dashboard/src/forgot-password.js#L39)

| 条件 | エラー文言 | `aria-invalid` |
|------|-----------|----------------|
| 空文字（trim 後） | 「メールアドレスを入力してください。」 | `true` |
| `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` に不一致 | 「有効なメールアドレスを入力してください。」 | `true` |
| 上記以外 | (エラーなし、`aria-invalid="false"`) | `false` |

発火タイミング:

- `input` イベント（入力の都度、[forgot-password.js:57](../../../02_dashboard/src/forgot-password.js#L57)）。
- `submit` イベント（送信時の最終チェック、[forgot-password.js:61](../../../02_dashboard/src/forgot-password.js#L61)）。

#### 5.1.3 送信処理（モック）

実装: [forgot-password.js:59-76](../../../02_dashboard/src/forgot-password.js#L59)

1. `event.preventDefault()` で既定送信抑止。
2. `validateEmail()` が `false` なら早期 return。
3. `showLoading(submitButton, '送信中...')` でボタン無効化・スピナー表示・ラベルを「送信中...」に差し替え（[forgot-password.js:9-21](../../../02_dashboard/src/forgot-password.js#L9)）。
4. `await new Promise(resolve => setTimeout(resolve, 1000))` で 1 秒のダミー遅延（[forgot-password.js:68](../../../02_dashboard/src/forgot-password.js#L68)）。
5. `hideLoading(submitButton)` でスピナーを戻し、ラベルを `dataset.originalText`（初期描画時 `"送信"`）に復元。
6. `form.style.display = 'none'` でフォーム全体を非表示。
7. `successMessage.textContent = 'ご入力のメールアドレスに、パスワード再設定の手順をお送りしました。メールをご確認ください。'`。
8. `successMessage.style.display = 'block'`。

**留意点**（§10-1 で追跡）:

- API 呼び出しなし。メールアドレスの存在有無・送信処理は一切行われない。
- 失敗パスがない（常に成功として扱う）。
- 成功表示後に「もう一度送る」等の導線はない。ユーザーはページリロードで初期状態に戻すしかない。

#### 5.1.4 ローディング制御（`showLoading` / `hideLoading`）

実装: [forgot-password.js:9-36](../../../02_dashboard/src/forgot-password.js#L9)

- `classList.add('is-loading')` で `pointer-events:none; opacity:0.8` を付与（CSS 側 [forgot-password.html:59](../../../02_dashboard/forgot-password.html#L59)）。
- `disabled` 属性を付与。
- `.button__spinner` を `display:inline-block`。CSS でグラデ枠＋ `@keyframes spin` によるクルクル回転（[forgot-password.html:62-67](../../../02_dashboard/forgot-password.html#L62)）。
- ボタン直下の**テキストノード**（要素ではなく TextNode）を `dataset.originalText` に退避してから書き換え、復元時に元に戻す。`Array.from(childNodes).find(…)` でテキストノードを走査する実装（[forgot-password.js:17-20](../../../02_dashboard/src/forgot-password.js#L17)）。

### 5.2 reset-password.html: 新パスワード入力

#### 5.2.1 フォーム要素

| 要素 ID | 種別 | 属性 | ソース |
|---------|------|------|--------|
| `#reset-password-form` | `<form novalidate>` | - | [reset-password.html:56](../../../02_dashboard/reset-password.html#L56) |
| `#password` | `<input type="password">` | `required` / `aria-required` / `autocomplete="new-password"` / `aria-describedby="password-error"` | [reset-password.html:59](../../../02_dashboard/reset-password.html#L59) |
| 表示/非表示トグル（1 個目） | `<button type="button" class="password-toggle">` | `<span class="material-icons">visibility_off</span>` | [reset-password.html:60](../../../02_dashboard/reset-password.html#L60) |
| `#password-error` | `<div role="alert">` | - | [reset-password.html:61](../../../02_dashboard/reset-password.html#L61) |
| `.password-strength-indicator` | `<div>` | バー + テキスト | [reset-password.html:62-65](../../../02_dashboard/reset-password.html#L62) |
| `#strength-bar-fill` | `<div>` | width / backgroundColor を JS が更新 | [reset-password.html:63](../../../02_dashboard/reset-password.html#L63) |
| `#strength-text` | `<span>` | `弱い` / `普通` / `安全` を JS が更新 | [reset-password.html:64](../../../02_dashboard/reset-password.html#L64) |
| ヒント文言 | `<p class="password-strength-hint">` | UI 正文言（§7） | [reset-password.html:66](../../../02_dashboard/reset-password.html#L66) |
| `#password-confirm` | `<input type="password">` | `required` / `autocomplete="new-password"` | [reset-password.html:70](../../../02_dashboard/reset-password.html#L70) |
| 表示/非表示トグル（2 個目） | `<button type="button" class="password-toggle">` | - | [reset-password.html:71](../../../02_dashboard/reset-password.html#L71) |
| `#password-confirm-error` | `<div role="alert">` | - | [reset-password.html:72](../../../02_dashboard/reset-password.html#L72) |
| 送信ボタン | `<button type="submit" class="button button--filled">` | ラベル「パスワードを再設定」 | [reset-password.html:74-76](../../../02_dashboard/reset-password.html#L74) |
| 「ログイン画面に戻る」 | `<a href="../index.html">` | - | [reset-password.html:79](../../../02_dashboard/reset-password.html#L79) |

**見出し**（HTML 直書き）: 「パスワードの再設定」（[reset-password.html:55](../../../02_dashboard/reset-password.html#L55)）。

#### 5.2.2 URL トークン取得・検証

**現行**: 実装なし（§4.3 参照）。`reset-password.js` 全 101 行のいずれにもトークン参照コードはない。

#### 5.2.3 表示/非表示トグル

実装: [reset-password.js:39-53](../../../02_dashboard/src/reset-password.js#L39)

- `document.querySelectorAll('.password-toggle')` で 2 ボタンを取得し、それぞれに `click` リスナを登録。
- `button.previousElementSibling` を対象 input とみなす。**HTML 上では `<input>` の直後にトグルボタン**なので `previousElementSibling` で input が取れる前提（[reset-password.html:59-60](../../../02_dashboard/reset-password.html#L59) / [reset-password.html:70-71](../../../02_dashboard/reset-password.html#L70)）。
- `input.type` を `password ⇄ text` で切替。
- Material Icons を `visibility_off ⇄ visibility` で切替。
- `aria-label` を「パスワードを表示する」⇄「パスワードを非表示にする」で切替。

#### 5.2.4 バリデーション（`validateForm()`）

実装: [reset-password.js:56-91](../../../02_dashboard/src/reset-password.js#L56)

**チェック順序と文言**:

| 順 | 条件 | エラー対象 | エラー文言 |
|----|------|-----------|-----------|
| 1 | `passwordInput.value` が空 | `#password-error` | 「パスワードを入力してください。」 |
| 2 | 8 文字未満 | `#password-error` | 「パスワードは8文字以上で入力してください。」 |
| 3 | `/[0-9]/.test()` に不一致 | `#password-error` | 「パスワードには少なくとも1つの数字を含めてください。」 |
| 4 | （独立）新PW が非空かつ 確認PW と不一致 | `#password-confirm-error` | 「パスワードが一致しません。」 |

**実装上の重大ポイント**（§10-5）:

- **英字必須チェック**は存在しない。UI ヒント文言では「英字と数字を必ず含めてください」と謳っているが、JS は数字のみ検証。例: `12345678` はバリデーション通過する。
- **if-else チェインに重複ブロック**がある。[reset-password.js:75-83](../../../02_dashboard/src/reset-password.js#L75) は [67-74](../../../02_dashboard/src/reset-password.js#L67) と同じ条件・同じ処理を書き直している（到達不能な死コード / コピー事故、§10-11）。
- 強度スコアはバリデーションに関与しない（§5.2.5）。

チェック 1〜3 はいずれも `else if` で連結されているため、より早い段階で失敗すれば後続はスキップされる。チェック 4 は独立 `if` のため、チェック 1〜3 と並行してエラー表示され得る。

#### 5.2.5 強度インジケーター（`zxcvbn`）

実装: [reset-password.js:11-36](../../../02_dashboard/src/reset-password.js#L11)

- CDN: `https://cdnjs.cloudflare.com/ajax/libs/zxcvbn/4.4.2/zxcvbn.js`（[reset-password.html:83](../../../02_dashboard/reset-password.html#L83)）。
- `passwordInput` の `input` イベントで `zxcvbn(password).score`（0〜4）を取得。
- `strengthLevels[score]` から文言・色・幅を取り出し、バー (`#strength-bar-fill`) とテキスト (`#strength-text`) を更新。

| score | 文言 | 色 | バー幅 |
|-------|------|-----|--------|
| 0 | 弱い | `var(--color-error)`（#d9534f） | 20% |
| 1 | 弱い | `var(--color-error)` | 40% |
| 2 | 普通 | `var(--color-warning)`（#ffc107） | 60% |
| 3 | 普通 | `var(--color-warning)` | 80% |
| 4 | 安全 | `var(--color-success)`（#28a745） | 100% |

- 入力が空文字になったときは `width: 0%` / `textContent: ''` にリセット（[reset-password.js:22-26](../../../02_dashboard/src/reset-password.js#L22)）。
- 強度スコアは**送信可否に影響しない**。`score < 2` でも `validateForm()` が通れば遷移する。

#### 5.2.6 送信処理

実装: [reset-password.js:93-100](../../../02_dashboard/src/reset-password.js#L93)

1. `event.preventDefault()`。
2. `validateForm()` が `true` なら:
   - `console.log('パスワードリセット成功')`（[reset-password.js:97](../../../02_dashboard/src/reset-password.js#L97)）。
   - `window.location.href = 'reset-password-complete.html'`（[reset-password.js:98](../../../02_dashboard/src/reset-password.js#L98)）。
3. `validateForm()` が `false` なら何もせず（エラー表示のみ）。

**留意点**（§10 で追跡）:

- API 呼出なし（§10-1）。
- `showLoading` 相当のボタン無効化処理がなく、**多重クリックで `console.log` が多発し得る**（§10-6）。
- トークン・新 PW を実サーバに送信する経路が存在しないため、実際のパスワード更新は発生しない。

### 5.3 reset-password-complete.html: 完了

#### 5.3.1 表示要素

| 要素 | 内容 | ソース |
|------|------|--------|
| アイコン | 絵文字 `✅`（font-size 4rem、color primary） | [reset-password-complete.html:37](../../../02_dashboard/reset-password-complete.html#L37) |
| タイトル | 「再設定完了」 | [reset-password-complete.html:38](../../../02_dashboard/reset-password-complete.html#L38) |
| 説明 | 「パスワードの再設定が完了しました。」 | [reset-password-complete.html:39](../../../02_dashboard/reset-password-complete.html#L39) |
| CTA | `<a class="button button--filled" href="../index.html">ログイン画面へ</a>` | [reset-password-complete.html:40](../../../02_dashboard/reset-password-complete.html#L40) |

#### 5.3.2 挙動

- **JS なし**（`<script>` タグ自体が存在しない）。
- CTA は `<a>` タグの単純リンク。
- 直接 URL 入力でもアクセスできる（§10-9 セキュリティ留意）。

---

## 6. データモデル

### 6.1 state / ローカル保持

いずれの画面も**永続化を行わない**。

- `localStorage` / `sessionStorage` / `cookie` への書き込み・読み込み**なし**（`grep` 済、両 JS ファイルとも）。
- DOM のみを揺動する（フォーム非表示 / 成功メッセージ表示 / 強度バー / 遷移）。
- ブラウザをリロードするとすべて初期状態に戻る。

### 6.2 バリデーションルール集約

| 画面 | 項目 | ルール | 実装 |
|------|------|--------|------|
| forgot | email | 必須（trim 後非空） | [forgot-password.js:44-48](../../../02_dashboard/src/forgot-password.js#L44) |
| forgot | email | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | [forgot-password.js:49-53](../../../02_dashboard/src/forgot-password.js#L49) |
| reset | password | 必須（非空） | [reset-password.js:63-66](../../../02_dashboard/src/reset-password.js#L63) |
| reset | password | 8 文字以上 | [reset-password.js:67](../../../02_dashboard/src/reset-password.js#L67) |
| reset | password | 数字 1 文字以上含む | [reset-password.js:71](../../../02_dashboard/src/reset-password.js#L71) |
| reset | password-confirm | password と一致 | [reset-password.js:85-89](../../../02_dashboard/src/reset-password.js#L85) |

---

## 7. パスワード強度基準

**UI ヒント文言（正）**:

> 「必須: 8文字以上で、英字と数字を必ず含めてください。記号を組み合わせるとより安全になります。」
> ([reset-password.html:66](../../../02_dashboard/reset-password.html#L66))

**実装バリデーションの実態**:

| 項目 | UI 文言の主張 | JS の実装 | 差分 |
|------|-------------|----------|------|
| 最低文字数 | 8 文字以上 | 8 文字以上 | 一致 |
| 数字必須 | 必須 | 必須（`/[0-9]/`） | 一致 |
| 英字必須 | 必須 | **未チェック** | **不一致（§10-5）** |
| 記号 | 推奨（必須ではない） | 未チェック（妥当） | 一致 |

**強度インジケーター（情報提供のみ）**:

- `zxcvbn` のスコア 0〜4 を 3 段階文言（弱い / 普通 / 安全）で可視化。
- バリデーション結果には影響を与えない。
- スコア 0 で「安全な組み合わせでも」送信可能になる恐れはないが、逆に「スコア 4 でも 数字欠落なら送信ブロック」が発生しうる（強度指標と必須条件が別建て）。

**本書での確定**:

- 強度基準の「正」は UI ヒント文言とする（MVP）。
- ただし JS 実装が UI 文言より緩いため、§10-5 として「英字必須チェックの追加」を追跡する。

---

## 8. 非機能要件

### 8.1 セキュリティ

| 項目 | 現状 | 期待 |
|------|------|------|
| リセット URL トークン | **未実装**（§4.3） | 発行から一定時間で失効、一度使用で無効化、暗号論的乱数（§10-2 / §10-3） |
| トークン検証 | **未実装** | ページロード時にサーバ検証 API を呼び、無効・失効なら専用メッセージ |
| タイミング攻撃対策 | モック上は常に同じメッセージを表示するため暫定的に成立 | 実 API 実装時に「登録有無にかかわらず常に同じ応答」を保証（§10-8） |
| パスワード保存 | **未実装**（送信自体なし） | bcrypt 等の強力ハッシュ。平文保存禁止（§10-1） |
| 二重送信防止（forgot） | `showLoading` によりボタン無効化で担保 | そのまま維持 |
| 二重送信防止（reset） | **未実装**（§10-6） | submit 中はボタン無効化＋スピナー表示 |
| 完了画面直アクセス | `reset-password-complete.html` は直リンクで誰でも到達可能 | トークン検証後のみ表示する仕組み（§10-9） |
| 新パスワードの画面残留 | 入力値は DOM に保持されるが永続化なし。ページ離脱で消える | 現状維持。`autocomplete="new-password"` は設定済み（[reset-password.html:59](../../../02_dashboard/reset-password.html#L59) / [reset-password.html:70](../../../02_dashboard/reset-password.html#L70)） |

### 8.2 アクセシビリティ

| 項目 | 実装 | ソース |
|------|------|--------|
| ランドマーク | `<div class="page-wrapper" role="main">` | 3 画面共通 |
| 入力ラベル | `<label for="...">` で関連付け | forgot / reset |
| 必須表示 | `required` + `aria-required="true"` | forgot / reset |
| エラー関連付け | `aria-describedby="...-error"` | forgot / reset |
| エラー領域 | `<div role="alert">` | forgot / reset |
| 成功メッセージ | `<div role="status">` | forgot のみ |
| 入力不正表示 | `aria-invalid="true"` を動的付与、CSS で赤枠 | forgot / reset |
| 表示/非表示トグル | `<button type="button" aria-label>` でラベル付き、切替時に更新 | reset |
| 自動入力ヒント | `autocomplete="email"` / `autocomplete="new-password"` | forgot / reset |

**未対応**:

- 完了画面には `role="status"` 相当の通知領域がなく、スクリーンリーダーに「完了」を能動通知しない（静的テキストのみ）。
- 強度インジケーターは `aria-live` が付与されておらず、強度変化が音声で読み上げられない（§10-12）。
- フォーカス管理: 成功メッセージ表示時にフォーカス移動しないため、キーボードユーザーは状態変化に気付きにくい（§10-12）。

### 8.3 パフォーマンス

| 項目 | 実装 | 備考 |
|------|------|------|
| ページロード | 3 画面ともインライン CSS・軽量 JS のみ | 外部 CSS は forgot のみ `index.css` 読込 |
| `zxcvbn` CDN | 約 400KB（gzip 未適用）、reset 画面のみ | 初回ロードがやや重い（§10-13） |
| バリデーション | 同期実行、即時反映 | 負荷問題なし |
| モック遅延 | forgot: 1,000ms | 本番 API 接続時はネットワーク依存 |

---

## 9. Definition of Done

以下すべてを満たすこと。

**MVP（本版リリース条件）**:

1. 3 画面 × 3 HTML ファイル + 2 JS ファイルが `02_dashboard/` 配下の現在位置で動作する。
2. forgot 画面: email 形式バリデーション + 1 秒モック遅延 + 成功メッセージ表示 + ログイン画面戻り導線。
3. reset 画面: 新PW 入力 + 確認PW 入力 + 8 文字&数字必須 + 一致チェック + 強度インジケーター表示 + 表示/非表示トグル + 完了画面遷移。
4. 完了画面: 完了アイコン + 文言 + ログイン画面戻り導線。
5. ログイン画面側の「パスワードを忘れた方」リンクが `forgot-password.html` に到達する（§12）。
6. パスワード強度基準（UI ヒント）が §7 の文言と一致している。

**Should**:

1. 英字必須チェックが JS 側にも実装されている（§10-5 解消）。
2. reset 画面の送信ボタンにローディング状態が実装されている（§10-6 解消）。

**Phase 2（§10 送り）**:

- 実 API 接続・メール送信・URL トークン発行/検証・タイミング攻撃対策・多要素認証連携・監査ログ。

---

## 10. 将来計画（Phase 2 以降）

実装トレース結果として抽出した、仕様と実装のギャップ・未実装・バグ疑い・死参照の一覧。

| # | 項目 | 種別 | 内容 | 該当箇所 |
|---|------|------|------|----------|
| 1 | 実サーバ API 接続 | 未実装 | forgot は `setTimeout` モック、reset は `console.log` のみ。いずれも実サーバに送信していない。 | [forgot-password.js:68](../../../02_dashboard/src/forgot-password.js#L68) / [reset-password.js:97](../../../02_dashboard/src/reset-password.js#L97) |
| 2 | URL トークン取得・検証 | 未実装 | `reset-password.html` は URL パラメータを参照せず、誰でも直 URL で到達可能。 | [reset-password.js](../../../02_dashboard/src/reset-password.js) 全体 |
| 3 | トークン有効期限 | 未実装 | 期限（例: 発行から 1 時間）・一度使用で無効化の UI/API なし。期限切れ専用メッセージ画面も未定義。 | - |
| 4 | メール送信基盤 | 未実装 | forgot 送信時にメール送信 API を呼ぶ経路なし。SMTP / SES 等の選定も未了。 | - |
| 5 | 英字必須チェック | バグ（UI 文言と JS の乖離） | UI ヒントでは「英字と数字を必ず含めてください」だが、JS は数字のみチェック。`12345678` で通る。 | [reset-password.js:67-83](../../../02_dashboard/src/reset-password.js#L67) / [reset-password.html:66](../../../02_dashboard/reset-password.html#L66) |
| 6 | reset 画面の二重送信防止 | 未実装 | submit 中のボタン無効化・スピナー制御なし。多重クリックで `console.log` が重複発火する。 | [reset-password.js:93-100](../../../02_dashboard/src/reset-password.js#L93) |
| 7 | 強度スコアによる送信ブロック | 仕様未確定 | zxcvbn スコアは表示のみ。score ≤ 1 でも送信可。最低強度の方針（MVP: 8文字+英数字 / 将来: score ≥ 2 推奨等）を要合意。 | [reset-password.js:56-91](../../../02_dashboard/src/reset-password.js#L56) |
| 8 | タイミング攻撃対策の明文化 | 仕様未確定 | 「登録有無にかかわらず常に同じ応答」を実 API 実装時に担保する旨を仕様書レベルでも固定する。 | - |
| 9 | 完了画面の直アクセス防止 | セキュリティ | `reset-password-complete.html` は認証フラグなしで直アクセス可能。`sessionStorage` 等でリセット成功直後のみ許可する案。 | [reset-password-complete.html](../../../02_dashboard/reset-password-complete.html) |
| 10 | CSS 重複定義 | リファクタ | 3 HTML とも同じ CSS 変数・レイアウト・ボタン定義をインラインで重複記述。共通 CSS（例: `auth-common.css`）への切出しが望ましい。forgot のみ `index.css` を読込む非対称も解消する。 | [forgot-password.html:11-76](../../../02_dashboard/forgot-password.html#L11) / [reset-password.html:11-50](../../../02_dashboard/reset-password.html#L11) / [reset-password-complete.html:10-32](../../../02_dashboard/reset-password-complete.html#L10) |
| 11 | validateForm の死コード | バグ（コピー事故） | [reset-password.js:75-83](../../../02_dashboard/src/reset-password.js#L75) は直前の 67-74 行と同じ条件ブロックの重複。到達不能。削除推奨。 | [reset-password.js:75-83](../../../02_dashboard/src/reset-password.js#L75) |
| 12 | アクセシビリティ強化 | 未対応 | 成功メッセージ表示時のフォーカス移動、強度インジケーターの `aria-live`、完了画面の `role="status"` 追加。 | 全画面 |
| 13 | zxcvbn のバンドル化 | パフォーマンス | CDN 依存のため初回ロードが遅い。localモジュール化 or フォールバックチェック（自前実装）を検討。 | [reset-password.html:83](../../../02_dashboard/reset-password.html#L83) |
| 14 | 再送信導線 | UX | forgot 成功表示後に「別のメールアドレスで送り直す」導線がない。誤入力に気付いた場合、リロードが必要。 | [forgot-password.js:73-75](../../../02_dashboard/src/forgot-password.js#L73) |
| 15 | 完了画面の自動ログイン | UX（方針未定） | 再設定完了後に自動ログインまで行うか、都度ログインさせるかの方針決定。現状は後者。 | [reset-password-complete.html:40](../../../02_dashboard/reset-password-complete.html#L40) |
| 16 | エラー文言の国際化 | 未対応 | 日本語ハードコード。i18n 基盤導入時に JSON 化。 | 全 JS |
| 17 | 監査ログ | 未実装 | リセット要求・成功/失敗のログ記録方針が未定義。 | - |

---

## 11. 用語集

| 用語 | 定義 |
|------|------|
| パスワードリセット | ログイン前のユーザーが、登録メールアドレス経由で自らパスワードを再設定する動線。 |
| パスワード変更 | ログイン後のユーザーが、旧パスワードを入力したうえで新パスワードに更新する動線（本書対象外、`09_password_change_screen.md`）。 |
| リセット URL | メールに記載される、トークン付きの `reset-password.html` への URL（現行未実装）。 |
| トークン | リセット URL に含まれる一時的・推測困難な識別子。ユーザーとリセット要求を紐付ける。 |
| 強度インジケーター | `zxcvbn` のスコア（0〜4）を 3 段階（弱い / 普通 / 安全）で可視化する UI。情報提供のみで送信可否には関与しない。 |
| タイミング攻撃 | 応答時間・応答内容の違いから、メールアドレスの登録有無を推定する攻撃手法。 |

---

## 12. 関連ファイル・デッドコード棚卸し

### 12.1 関連ファイル（本書の射程内）

| ファイル | 役割 | 現状 |
|---------|------|------|
| `02_dashboard/forgot-password.html` | メールアドレス入力画面 | 稼働 |
| `02_dashboard/reset-password.html` | 新パスワード入力画面 | 稼働 |
| `02_dashboard/reset-password-complete.html` | 完了画面 | 稼働 |
| `02_dashboard/src/forgot-password.js` | forgot 画面ロジック | モック動作 |
| `02_dashboard/src/reset-password.js` | reset 画面ロジック | モック動作（遷移のみ） |
| `02_dashboard/index.css` | 共通スタイル | forgot のみ読込。reset / complete は未読込 |

### 12.2 デッドコード・バグ疑い

| 箇所 | 内容 | 分類 |
|------|------|------|
| [reset-password.js:75-83](../../../02_dashboard/src/reset-password.js#L75) | 直前の `else if` ブロックと完全に同じ条件・処理の重複。到達不能。 | 死コード |
| [reset-password.html:66](../../../02_dashboard/reset-password.html#L66) の「英字…」 | JS バリデーションと不一致（§10-5） | 仕様齟齬 |
| [reset-password-complete.html](../../../02_dashboard/reset-password-complete.html) に JS なし | 完了画面への直アクセスを防ぐ仕組みがない | セキュリティ |
| 3 HTML の CSS インライン重複 | 全く同じ CSS 変数・ボタン・フォームスタイルを 3 ファイルに重複 | 保守性 |
| `forgot-password.html` のみ `index.css` 読込 | 他 2 画面との非対称 | 保守性 |

### 12.3 参照なし / 未接続

- `reset-password.js` は `URLSearchParams` / `location.search` を参照しない（§4.3）。
- `forgot-password.js` / `reset-password.js` ともに `fetch` / `XMLHttpRequest` / `axios` 等の HTTP クライアントを使っていない。
- `localStorage` / `sessionStorage` / `cookie` への書込みなし。

---

## 13. 関連仕様書との関係

| 仕様書 | 関係 |
|--------|------|
| `02_dashboard/index.html`（ログイン画面） | 「パスワードを忘れた方」リンクから `forgot-password.html` への入口を提供。導線側の仕様はログイン画面の仕様書に委ねる。 |
| `09_password_change_screen.md`（ログイン後パスワード変更） | 対になる動線。本書は「ログイン前」、09 番は「ログイン後」。旧パスワード入力・セッション扱いが異なるため完全分離。共通化するなら「パスワード強度基準」の章のみ（§7）。 |
| `04_login_screen.md` 系（存在すれば） | 「パスワードを忘れた方」リンクの表記・位置・`href` 仕様。 |
| `_archive/` 配下の旧仕様 | 本書 v1.x（抽象記述中心）は v2.0 で破棄。`_archive` への移動対象候補。 |

---
