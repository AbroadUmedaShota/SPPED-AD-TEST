# E2E テスト (Playwright)

SPEED AD 静的モックの利用者導線を Playwright で確認する。
対象フローの定義は [99_backend-docs/08_e2e-testing/02_target-flows.md](../../99_backend-docs/08_e2e-testing/02_target-flows.md) を参照。

## 前提

- Node.js / npm
- Python（ローカル配信 `scripts/dev-server.py` 用）
- 初回のみ依存とブラウザを取得:
  ```
  npm install
  npm run test:e2e:install   # chromium / firefox / webkit
  ```

## 実行

| コマンド | 内容 |
| --- | --- |
| `npm run test:e2e` | 全プロジェクトで実行（ローカルサーバーは自動起動） |
| `npm run test:e2e:ui` | UI モードで実行 |
| `npm run test:e2e:headed` | ブラウザ表示ありで実行 |
| `npm run test:e2e:report` | 直近の HTML レポートを表示 |

特定ブラウザのみ: `npx playwright test --project=chromium-desktop`

## 設定の要点（[playwright.config.js](../../playwright.config.js)）

- `webServer`: `python scripts/dev-server.py 8765` を自動起動し `http://127.0.0.1:8765` を配信。
- 外部環境に向ける場合は `BASE_URL` を指定（webServer は起動しない）:
  ```
  $env:BASE_URL="https://stg.speed-ad.com"; npm run test:e2e
  ```
  ※ dev/stg/prod での自動操作可否・テストアカウント・副作用ありの操作は要確認。
- プロジェクト: `chromium-desktop` / `firefox-desktop` / `webkit-desktop` / `mobile-chrome`。

## テストの追加

`tests/e2e/*.spec.js` に追加する。`smoke.spec.js` はセットアップ検証用の最小テスト。
クリック対象には安定した id / data 属性を優先して使う（テキスト依存を避ける）。
