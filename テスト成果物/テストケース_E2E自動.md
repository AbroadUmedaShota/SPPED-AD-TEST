# テストケース（E2E自動）

対象: ログイン機能（ユーザー側 `/login` ＋ 管理者側 `/admin/login`）
環境: `https://stg.speed-ad.com`
作成日: 2026-06-03
テスト設計: `テスト成果物/テスト設計.md`（TD001〜TD040 のうち E2E自動・確定分）

---

## 1. 作成対象

| 対象 | URL |
|---|---|
| ユーザー側ログイン | `https://stg.speed-ad.com/login` |
| 管理者側ログイン | `https://stg.speed-ad.com/admin/login` |

Playwright E2E 自動テストで実行するテストケース（確定分）。認証情報の具体値は含まない。
実施方法: `npx playwright test --project=staging`（Node は PATH 前置き必要）。

---

## 2. 参照資料

| 資料 | パス |
|---|---|
| テスト設計 | `テスト成果物/テスト設計.md` |
| テスト分析 | `テスト成果物/テスト分析.md` |
| テスト計画書 | `テスト成果物/テスト計画書.md` |
| テスト設計 質問票 | `テスト成果物/テスト設計_質問票.md` |
| 引き継ぎ書 | `テスト成果物/run-test-process_引き継ぎ.md` |

既知のセレクタ（ユーザー側）: `#email` / `#password` / `button[type=submit]:has-text("ログイン")`
認証情報は環境変数のみ: `SPEEDAD_LV3_EMAIL`・`SPEEDAD_LV3_PASSWORD`（Lv3アカウント）等

---

## 3. E2E自動テストで実行するテストケース

### 3.1 正常系ログイン（確定分）

| テストケースID | 元テスト設計ID | テスト観点ID | テストアプローチID | 実行区分 | テストレベル/タイプ | 優先度 | テストケース名 | 前提条件 | 入力/データ | 手順 | 期待結果 | 確認方法/証跡 | 関連質問ID | 仕様 | リスクID | 状態 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-E2E-001 | TD001 | TV001 | TA001 | E2E自動 | E2E | 高 | ユーザー側ログイン: 正規資格情報で `/dashboard` へ到達する | `https://stg.speed-ad.com/login` が Playwright からアクセスできること。環境変数 `SPEEDAD_USER_EMAIL`・`SPEEDAD_USER_PASSWORD`（ユーザー口アカウント）が設定されていること ※実測: Lv1〜Lv4 はユーザー口では認証されない（OBS-001）。ユーザー口の実working資格は `SPEEDAD_USER_EMAIL`/`SPEEDAD_USER_PASSWORD` | ユーザー口アカウントのメールアドレス（環境変数 `SPEEDAD_USER_EMAIL` 参照）、ユーザー口アカウントのパスワード（環境変数 `SPEEDAD_USER_PASSWORD` 参照） | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` フィールドに `process.env.SPEEDAD_USER_EMAIL` の値を入力する。3. `#password` フィールドに `process.env.SPEEDAD_USER_PASSWORD` の値を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページの URL が `/dashboard` を含むこと（`expect(page).toHaveURL(/dashboard/)` 等）。ブラウザコンソールに `console.error` が 0 件であること。 | Playwright 実行ログ（exit code 0）、`page.url()` の値、コンソールリスナーのエラー件数 | なし | 計画書3章 / 24番3.1 / STG-AX-01 | R003 | 作成済み |
| TC-E2E-002 | TD002 | TV002 | TA001 | E2E自動 | E2E | 高 | ユーザー側ログイン成功後: `/dashboard` のタイトルが「アンケート一覧」であること | TC-E2E-001 の正常ログイン完了後の状態（`/dashboard` に到達済み） | TC-E2E-001 と同一フロー内で実行（同一テストケース内でアサーション追加） | 1. TC-E2E-001 の手順 1〜5 を実行する（または storageState 再利用で `/dashboard` に到達する）。2. `document.title` または Playwright の `page.title()` を取得する。 | `document.title` が「アンケート一覧」を含むこと（`expect(page).toHaveTitle(/アンケート一覧/)` 等）。 | Playwright 実行ログ、`page.title()` の値 | なし | 計画書3章 / STG-AX-01 | R003 | 作成済み |
| TC-E2E-003 | TD005 | TV021 | TA001 | E2E自動 | E2E | 低 | ユーザー側ログインフォームの初期表示: メール欄・パスワード欄が空であること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること。認証なし（storageState なし）でアクセスする | なし（初期表示の確認のみ） | 1. storageState を使用しない状態（未認証）で `https://stg.speed-ad.com/login` へナビゲートする。2. ページロード完了を待機する。3. `#email` フィールドの `value` 属性を取得する。4. `#password` フィールドの `value` 属性を取得する。 | `#email` フィールドの value が空文字列であること。`#password` フィールドの value が空文字列であること。 | Playwright 実行ログ、`inputValue('#email')` および `inputValue('#password')` の値 | なし | 24番3.1 | R003 | 作成済み |
| TC-E2E-004 | TD006 | TV032 | TA001 | E2E自動 | Compatibility | 中 | ユーザー側ログインが Playwright Chromium headless で正常動作すること | `--project=login` が Chromium headless 設定で構成されていること。環境変数 `SPEEDAD_USER_EMAIL`・`SPEEDAD_USER_PASSWORD` が設定されていること | TC-E2E-001 と同一の入力・手順（Chromium headless での実行確認）。環境変数 `SPEEDAD_USER_EMAIL`/`SPEEDAD_USER_PASSWORD` 参照 | 1. TC-E2E-001 と同一の手順を `npx playwright test --config=playwright.login.config.js` で実行する。2. 実行後の exit code を確認する。3. コンソールエラーを確認する。 | Playwright 実行が正常終了すること（exit code 0）。コンソールエラーが 0 件であること。 | Playwright 実行ログ（exit code 0）、コンソールリスナーのエラー件数 | なし | 計画書9章 / SSI009 | R003 | 作成済み |

### 3.2 異常系ログイン（確定分）

| テストケースID | 元テスト設計ID | テスト観点ID | テストアプローチID | 実行区分 | テストレベル/タイプ | 優先度 | テストケース名 | 前提条件 | 入力/データ | 手順 | 期待結果 | 確認方法/証跡 | 関連質問ID | 仕様 | リスクID | 状態 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-E2E-005 | TD008 | TV005 | TA003 | E2E自動 | E2E | 高 | ユーザー側: 正規メール + 誤パスワードでログインが成功しないこと | `https://stg.speed-ad.com/login` が Playwright からアクセスできること。環境変数 `SPEEDAD_USER_EMAIL` が設定されていること（※実測でユーザー口に実際に認証できるアカウントの環境変数。OBS-001 参照） | ユーザー口アカウントのメールアドレス（環境変数 `SPEEDAD_USER_EMAIL` 参照）+ 誤ったパスワード文字列（例: `wrong_password_test_value_1234`。正規パスワードと異なる文字列であること） | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `process.env.SPEEDAD_USER_EMAIL` の値を入力する。3. `#password` に `wrong_password_test_value_1234` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | URL が `/dashboard` にならないこと（ログイン成功しないこと）。エラーメッセージを示す要素がページ内に 1 件以上表示されること（エラー要素の存在を確認）。 | Playwright 実行ログ、`page.url()` の値（`/dashboard` 不一致を確認）、エラー要素の `locator.count()` または `toBeVisible()` | なし | 計画書6章 / 認証境界 / R001 | R001 | 作成済み |
| TC-E2E-006 | TD010 | TV006 | TA003 | E2E自動 | E2E | 高 | 未登録メールアドレスでログインが成功しないこと | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | 未登録メールアドレス（テスト用ダミー: `nonexist_test_autotest@example.com`。実ユーザーデータは使用しない）+ 任意のパスワード文字列（例: `any_test_pw_nonexist_001`） | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `nonexist_test_autotest@example.com` を入力する。3. `#password` に `any_test_pw_nonexist_001` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | URL が `/dashboard` にならないこと。エラーメッセージを示す要素がページ内に 1 件以上表示されること。 | Playwright 実行ログ、`page.url()` の値、エラー要素の確認 | なし | 認証境界 / SSI002 | R001, R005 | 作成済み |
| TC-E2E-007 | TD013 | TV008 | TA004 | E2E自動 | E2E | 高 | メールアドレス空欄で送信した場合にログインがブロックされること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: 空文字列（入力操作なし）。`#password` フィールドへの入力: 有効な形式の任意文字列（例: `DummyPassword_TC007`） | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` フィールドは空のまま操作しない。3. `#password` に `DummyPassword_TC007` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。ブラウザの HTML5 バリデーション（required 属性によるブロック）またはサーバー側バリデーションエラーがページに表示されること（いずれかが確認されれば Pass）。 | Playwright 実行ログ、`page.url()` の値（`/dashboard` 不一致を確認）、HTML5 バリデーションメッセージまたはエラー要素の存在確認 | なし | 24番3.1 / TA004 | R001 | 作成済み |
| TC-E2E-008 | TD014 | TV009 | TA004 | E2E自動 | E2E | 高 | パスワード空欄で送信した場合にログインがブロックされること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: 有効な形式のメールアドレス（例: `valid_format_test@example.com`）。`#password` フィールドへの入力: 空文字列（入力操作なし） | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `valid_format_test@example.com` を入力する。3. `#password` フィールドは空のまま操作しない。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。HTML5 バリデーション（required 属性）またはサーバー側バリデーションエラーが表示されること。 | Playwright 実行ログ、`page.url()` の値、バリデーションメッセージまたはエラー要素の存在確認 | なし | 24番3.1 / TA004 | R001 | 作成済み |
| TC-E2E-009 | TD015 | TV010 | TA004 | E2E自動 | E2E | 高 | 形式不正メール（@なし）で送信した場合にバリデーションエラーが表示されること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `invalidemail`（`@` を含まない文字列）。`#password` フィールドへの入力: `DummyPassword_TC009` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `invalidemail` を入力する。3. `#password` に `DummyPassword_TC009` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。ブラウザの HTML5 バリデーションエラー（`type=email` の場合のフォーマットチェック）が表示されること。 | Playwright 実行ログ、`page.url()` の値、バリデーションメッセージ確認 | なし | 24番3.1 / TA004 | R001 | 作成済み |
| TC-E2E-010 | TD016 | TV010 | TA004 | E2E自動 | E2E | 高 | 形式不正メール（ドメインなし）で送信した場合にバリデーションエラーが表示されること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `user@`（ドメイン部が空の文字列）。`#password` フィールドへの入力: `DummyPassword_TC010` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `user@` を入力する。3. `#password` に `DummyPassword_TC010` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。HTML5 バリデーションエラーが表示されること。 | Playwright 実行ログ、`page.url()` の値、バリデーションメッセージ確認 | なし | 24番3.1 / TA004 | R001 | 作成済み |
| TC-E2E-011 | TD017 | TV010 | TA004 | E2E自動 | E2E | 中 | 形式不正メール（スペース含む）で送信した場合にバリデーションエラーが表示されること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `user @example.com`（スペースを含む文字列）。`#password` フィールドへの入力: `DummyPassword_TC011` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `user @example.com` を入力する。3. `#password` に `DummyPassword_TC011` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。バリデーションエラーが表示されること（HTML5 バリデーションまたはサーバー側エラー）。 | Playwright 実行ログ、`page.url()` の値、バリデーションメッセージ確認 | なし | 24番3.1 / TA004 | R001 | 作成済み |
| TC-E2E-012 | TD018 | TV022 | TA004 | E2E自動 | E2E | 中 | HTML5メールバリデーション境界: 空（送信ブロック）・最小有効形式（送信試行）の2クラスで発動有無が異なること（空） | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: 空文字列（境界直前クラス）。`#password` フィールドへの入力: `DummyPassword_TC012a` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` フィールドは空のまま操作しない。3. `#password` に `DummyPassword_TC012a` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | ページが `/dashboard` へ遷移しないこと。送信がブロックされること（HTML5 required バリデーションまたはサーバー側エラー）。 | Playwright 実行ログ、`page.url()` の値、バリデーション発動確認 | なし | 24番3.1 / SSI002 | R001 | 作成済み |
| TC-E2E-013 | TD018 | TV022 | TA004 | E2E自動 | E2E | 中 | HTML5メールバリデーション境界: 最小有効形式（`a@b.co`）では送信が試みられること（認証エラーになる） | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `a@b.co`（最小有効形式の境界値）。`#password` フィールドへの入力: `DummyPassword_TC013` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `a@b.co` を入力する。3. `#password` に `DummyPassword_TC013` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | HTML5 バリデーションによる送信ブロックが発生しないこと（送信リクエストが試みられること）。ログイン認証エラー（認証失敗によるエラーメッセージ表示）が返ること。ページが `/dashboard` へ遷移しないこと。 | Playwright 実行ログ、`page.url()` の値、エラーメッセージ要素の確認 | なし | 24番3.1 / SSI002 | R001 | 作成済み |
| TC-E2E-014 | TD018 | TV022 | TA004 | E2E自動 | E2E | 中 | HTML5メールバリデーション境界: `@` なし形式不正（送信ブロック）でバリデーションが発動すること | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `invalidemail`（`@` なし・境界外クラス代表）。`#password` フィールドへの入力: `DummyPassword_TC014` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `invalidemail` を入力する。3. `#password` に `DummyPassword_TC014` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | HTML5 バリデーションエラーが発動し送信がブロックされること。ページが `/dashboard` へ遷移しないこと。 | Playwright 実行ログ、`page.url()` の値、バリデーション発動確認 | なし | 24番3.1 / SSI002 | R001 | 作成済み |
| TC-E2E-015 | TD020 | TV037 | TA003 | E2E自動 | E2E | 中 | SQLインジェクション相当入力でログインが成功しないこと（認証バイパスが発生しないこと） | `https://stg.speed-ad.com/login` が Playwright からアクセスできること | `#email` フィールドへの入力: `' OR '1'='1`（SQLi パターン代表文字列）。`#password` フィールドへの入力: `DummyPassword_TC015` | 1. `https://stg.speed-ad.com/login` へナビゲートする。2. `#email` に `' OR '1'='1` を入力する。3. `#password` に `DummyPassword_TC015` を入力する。4. `button[type=submit]:has-text("ログイン")` をクリックする。5. ページ遷移を待機する。 | URL が `/dashboard` へ遷移しないこと（認証バイパスが発生しないこと）。エラーメッセージが表示されること（バリデーションまたは認証エラー）。 | Playwright 実行ログ、`page.url()` の値（`/dashboard` 不一致を確認）、エラー要素の確認 | なし | 汎用セキュリティ / R001 | R001 | 作成済み |

### 3.3 コンソールエラー確認（確定分）

| テストケースID | 元テスト設計ID | テスト観点ID | テストアプローチID | 実行区分 | テストレベル/タイプ | 優先度 | テストケース名 | 前提条件 | 入力/データ | 手順 | 期待結果 | 確認方法/証跡 | 関連質問ID | 仕様 | リスクID | 状態 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-E2E-016 | TD035 | TV012 | TA006 | E2E自動 | E2E | 高 | ユーザー側ログイン成功後の `/dashboard` でコンソールエラーが 0 件であること | TC-E2E-001 の正常ログイン完了後の状態（`/dashboard` に到達済み）。Playwright のコンソールリスナーが設定されていること | TC-E2E-001 と同一フローで実行。コンソールリスナーを test 開始時から設定する | 1. テスト開始時に `page.on('console', msg => { if(msg.type() === 'error') errors.push(msg.text()); })` を設定する。2. TC-E2E-001 の手順 1〜5 を実行する。3. `/dashboard` に到達後、収集した `console.error` の件数を確認する。 | `console.error` イベントが 0 件であること。WARN レベルのメッセージは許容する。ERROR レベルのメッセージは 0 件であること。 | Playwright 実行ログ、コンソールリスナーの収集件数ログ（0 件であることを確認） | なし | STG-AX-02 / SSI005 | R003 | 作成済み |

### 3.4 状態遷移・セッション（確定分）

| テストケースID | 元テスト設計ID | テスト観点ID | テストアプローチID | 実行区分 | テストレベル/タイプ | 優先度 | テストケース名 | 前提条件 | 入力/データ | 手順 | 期待結果 | 確認方法/証跡 | 関連質問ID | 仕様 | リスクID | 状態 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-E2E-017 | TD038 | TV027 | TA006 | E2E自動 | E2E | 高 | storageState を再利用してログイン操作なしで `/dashboard` に到達できること | テスト実行中にセッション内で storageState を生成できること（TC-E2E-017 ではテスト内で一旦ログインして storageState を保存し、別コンテキストで再利用する）。環境変数 `SPEEDAD_USER_EMAIL`・`SPEEDAD_USER_PASSWORD` が設定されていること | ユーザー口アカウントの資格情報（環境変数 `SPEEDAD_USER_EMAIL`/`SPEEDAD_USER_PASSWORD` 参照）。テスト内で生成した storageState（実行時 `login-e2e-storage.json`、テスト後削除） | 1. 環境変数 `SPEEDAD_USER_EMAIL`/`SPEEDAD_USER_PASSWORD` でログインして storageState を保存する。2. 別のブラウザコンテキストで storageState を読み込む。3. ログイン操作（フォーム入力・送信）を行わずに `https://stg.speed-ad.com/dashboard` へ直接ナビゲートする。4. ページロードを待機する。 | ページが `/dashboard` に到達できること（ログインページへリダイレクトされないこと）。`document.title` が「アンケート一覧」を含むこと。 | Playwright 実行ログ、`page.url()` の値（`/dashboard` を含むこと）、`page.title()` の値 | なし | 引き継ぎ / SSI010・SSI013 | R006 | 作成済み |
| TC-E2E-018 | TD040 | TV040 | TA001 | E2E自動 | Performance | 中 | TC-E2E-001 の E2E テストが Playwright のデフォルトタイムアウト（30秒）以内に完了すること | TC-E2E-001 と同一の実行環境・入力条件 | TC-E2E-001 と同一の入力（ユーザー口アカウントの環境変数 `SPEEDAD_USER_EMAIL`/`SPEEDAD_USER_PASSWORD` 参照）。Playwright のデフォルトタイムアウト設定（30秒） | 1. TC-E2E-001 の手順 1〜5 を実行する。2. Playwright がタイムアウトエラーなく完了することを確認する。3. 実行ログの開始・終了タイムスタンプを確認する。 | Playwright のタイムアウトエラーが発生しないこと（テストが 30 秒以内に完了すること）。 | Playwright 実行ログ（タイムアウトエラーなし）、実行時間の記録 | なし | 計画書9章 / SSI009 | R003 | 作成済み |

---

## 4. 上流成果物への追記・更新

なし（本フェーズでの上流変更なし）。

---

## 5. カバレッジ確認

| テスト設計ID | 対応テストケースID | 実行区分 | 状態 | 出力ファイル | カバー状況 |
|---|---|---|---|---|---|
| TD001 | TC-E2E-001 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD002 | TC-E2E-002 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD005 | TC-E2E-003 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD006 | TC-E2E-004 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD008 | TC-E2E-005 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD010 | TC-E2E-006 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD013 | TC-E2E-007 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD014 | TC-E2E-008 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD015 | TC-E2E-009 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD016 | TC-E2E-010 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD017 | TC-E2E-011 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD018 | TC-E2E-012, TC-E2E-013, TC-E2E-014 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（3件 / 期待3件） |
| TD020 | TC-E2E-015 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD035 | TC-E2E-016 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD038 | TC-E2E-017 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |
| TD040 | TC-E2E-018 | E2E自動 | 作成済み | テストケース_E2E自動.md | 充足（1件 / 期待1件） |

質問待ちTD（E2E自動予定分）→ `テストケース_質問待ち.md` を参照:
TD003, TD004, TD007, TD009, TD011, TD012, TD019, TD021（手動に再分類）, TD022, TD023, TD024, TD025, TD026（手動に再分類）, TD027, TD028, TD029, TD030, TD031, TD032, TD033, TD034, TD036, TD037

---

## 6. Case Expansion Ledger（ケース展開台帳）

| テスト設計ID | 期待TC数 | 実TC数 | 不足数 | 対応テストケースID | 分割方針 | 代表抽出理由 | 集約判定ルール | 状態 |
|---|---|---|---|---|---|---|---|---|
| TD001 | 1 | 1 | 0 | TC-E2E-001 | 代表抽出 | 正規資格情報のハッピーパスは1件が代表 | — | 充足 |
| TD002 | 1 | 1 | 0 | TC-E2E-002 | 代表抽出 | TD001 と同一フロー内アサーション | — | 充足 |
| TD005 | 1 | 1 | 0 | TC-E2E-003 | 代表抽出 | 初期表示は1状態のみ | — | 充足 |
| TD006 | 1 | 1 | 0 | TC-E2E-004 | 代表抽出 | Chromium 1ブラウザのみ（スコープ外: クロスブラウザ） | — | 充足 |
| TD008 | 1 | 1 | 0 | TC-E2E-005 | 全件展開 | ユーザー側・誤パスワード1パターン | — | 充足 |
| TD010 | 1 | 1 | 0 | TC-E2E-006 | 代表抽出 | 未登録メールは代表1アドレスで十分 | — | 充足 |
| TD013 | 1 | 1 | 0 | TC-E2E-007 | 全件展開 | 空メール1パターン | — | 充足 |
| TD014 | 1 | 1 | 0 | TC-E2E-008 | 全件展開 | 空パスワード1パターン | — | 充足 |
| TD015 | 1 | 1 | 0 | TC-E2E-009 | 全件展開 | 形式不正「@なし」クラス代表1パターン | — | 充足 |
| TD016 | 1 | 1 | 0 | TC-E2E-010 | 全件展開 | 形式不正「ドメインなし」クラス代表1パターン | — | 充足 |
| TD017 | 1 | 1 | 0 | TC-E2E-011 | 全件展開 | 形式不正「スペース含む」クラス代表1パターン | — | 充足 |
| TD018 | 3 | 3 | 0 | TC-E2E-012, TC-E2E-013, TC-E2E-014 | 境界展開 | 空（境界直前）/ 最小有効形式（境界）/ @なし形式不正（境界外）の3クラス | 各クラスで独立して Pass/Fail を判定 | 充足 |
| TD020 | 1 | 1 | 0 | TC-E2E-015 | 代表抽出 | SQLi パターンは代表1パターン（スモーク範囲） | — | 充足 |
| TD021 | 1 | 0 | 0 | — | 種別変更 | 設計の実施方法が「手動ブラウザ確認」のため人間実行（TC-MAN-004）に分類。E2E 台帳では不足なし | — | 充足（人間実行ファイルに移管: TC-MAN-004） |
| TD026 | 1 | 0 | 0 | — | 種別変更 | 設計の実施方法が「手動ブラウザ確認（探索的）」のため人間実行（TC-MAN-005）に分類 | — | 充足（人間実行ファイルに移管: TC-MAN-005） |
| TD023 | 1 | 0 | 0 | — | 質問待ち | Q7（DQ006）解消後に有効化。TC-QW-012 として質問待ちファイルに記録済み | — | 質問待ち（TC-QW-012） |
| TD024 | 1 | 0 | 0 | — | 質問待ち | Q7（DQ006）解消後に有効化。TC-QW-013 として質問待ちファイルに記録済み | — | 質問待ち（TC-QW-013） |
| TD035 | 1 | 1 | 0 | TC-E2E-016 | 代表抽出 | ユーザー系到達画面コンソールエラー0は1ページ1確認で代表 | — | 充足 |
| TD038 | 1 | 1 | 0 | TC-E2E-017 | 代表抽出 | storageState 再利用は1パターンで代表 | — | 充足 |
| TD040 | 1 | 1 | 0 | TC-E2E-018 | 代表抽出 | タイムアウト確認は TD001 の実行時間を観測 | — | 充足 |

**本ファイル合計（E2E確定分）: 期待TC数 18件 / 実TC数 18件 / 不足数 0件**
**種別変更（設計方法が手動のため人間実行へ移管）: TD021（→TC-MAN-004）・TD026（→TC-MAN-005）= 計2件**
**質問待ち（質問待ちファイルで記録）: TD023（→TC-QW-012）・TD024（→TC-QW-013）= 計2件**

注: TD003・TD004・TD007・TD009・TD011・TD012・TD019・TD022・TD025・TD027〜TD034・TD036・TD037（E2E自動・質問待ち計20件）は `テストケース_質問待ち.md` に分離記録済み。
TD021（手動実行: XSS確認）・TD026（手動実行: 探索的）は設計の実施方法が「手動ブラウザ確認」のため `テストケース_人間実行.md` に分類（種別分離方針に従い正当な移管）。
