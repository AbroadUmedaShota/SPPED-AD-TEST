---
owner: product
status: draft
document_type: 方針メモ（PRD/ADRではない）
last_reviewed: 2026-04-24
---

# サポートサイト分離 方針メモ

| 項目 | 値 |
| --- | --- |
| 対象 | ダッシュボード（`app.speed-ad.com`）から `support.speed-ad.com` サブドメインへの静的ページ切り出し計画 |
| 正本区分 | 本書は方針メモ。現実装なし、将来計画。実装着手前に別途 PRD/ADR で確定する |
| owner | product |
| last_reviewed | 2026-04-24 |

## 1. 文書目的

- ヘルプ・FAQ・規約などの静的ページを、ダッシュボードから `support.speed-ad.com` サブドメインへ切り出す将来計画を整理する。
- 本書は**モックアップ段階の備忘メモ**であり、決定事項ではない。PRD/ADR ではなく、前段の検討資料である。
- KPI・ROI・予算承認・詳細スケジュールは本書スコープ外とする。法務合意・マーケ合意などは実装前提条件として別途取得する。

### 1.1 本番化要件の扱いに関する注記

- 本書は方針メモであるため、他のリライト版仕様書（例: 01 番 §9）のような独立した「§N 本番化要件」セクションは設けない。
- 本番化に必要な要素は既に以下の既存セクションへ分散して記述済みである。実装着手時は、本書ではなく個別の PRD/ADR へ転記・詳細化することを前提とする。
  - §3 URL振り分け方針・§6 301リダイレクト計画（URL・リダイレクト要件）
  - §4 クロスドメイン認証方式・§7 不具合報告フォーム（認証・セキュリティ要件）
  - §5 法令対応（電気通信事業法外部送信規律・GDPR・同意記録）
  - §8 推奨フォルダ構成（アセット管理・デプロイ構成）
  - §10 未決事項（改修着手前に確定すべき論点）
  - §11 異常系（エラー時の期待挙動）
  - §12 受入条件 / DoD（機能受入基準）
  - §13 非機能要件（性能・セキュリティヘッダ・アクセシビリティ・対応ブラウザ）
  - §14 運用要件（監視・ログ・RTO/RPO・インシデント対応・コスト・変更管理）
  - §15 リリース計画概要（フェーズ・ロールバック・CS テンプレ棚卸し）
- 上記に未充足の本番化観点（例: 本書固有の API 契約・DB スキーマ）は**本書スコープ外**である。支配下画面側の仕様書（13 番ヘルプセンター・14 番 FAQ・15 番 bug-report・16 番 法務ページ）側にそれぞれ §9 / §11 相当で記載する方針とする。

## 2. 背景と狙い

- ダッシュボード配下に、ヘルプ・FAQ・問い合わせ・各種規約など「アプリ機能ではない静的画面」が混在している。
- 責務分離のため、別サブドメインへ切り出す案を検討する。

### 2.1 分離の狙い

| 観点 | 内容 |
| --- | --- |
| デプロイサイクル分離 | ヘルプ記事更新をダッシュボード再デプロイなしに実施。CS／コンテンツ担当が独立運用可能。 |
| SEOドメイン権威性 | サポート専用ドメインとして検索評価を集中させる。 |
| Cookie／セッション分離 | ダッシュボード認証Cookieとサポートサイトセッションを独立管理し、リスクを局所化。 |
| 運用チーム分離余地 | サポート領域をCS／コンテンツチームが独立管理する体制への移行を容易化。 |

### 2.2 法令要件の概要

- **電気通信事業法外部送信規律**（2023年施行）：GAやreCAPTCHA等で外部送信する場合、利用者への通知・公表を義務付け。
- **GDPR**：EU域内ユーザーを想定する場合、同意取得前のトラッキングスクリプト読込遅延等の要件あり。
- いずれも実装前に法務合意を取得する。

## 3. URL振り分け方針

### 3.1 Before / After URL 一覧

| 画面 | 現在のパス（Before） | 新URL（After） |
| --- | --- | --- |
| ヘルプセンター | `02_dashboard/help.html` | `https://support.speed-ad.com/help/` |
| 記事詳細 | `02_dashboard/help-content.html` | `https://support.speed-ad.com/help-content/<slug>/` |
| よくある質問 | `02_dashboard/faq.html` | `https://support.speed-ad.com/faq/` |
| 不具合報告フォーム | `02_dashboard/bug-report.html` | `https://support.speed-ad.com/bug-report/` |
| 利用規約 | `02_dashboard/terms-of-service.html` | `https://support.speed-ad.com/terms/` |
| 特定商取引法表示 | `02_dashboard/specified-commercial-transactions.html` | `https://support.speed-ad.com/tokushoho/` |
| 個人情報保護方針 | `02_dashboard/personal-data-protection-policy.html` | `https://support.speed-ad.com/privacy/` |
| 更新履歴 | `02_dashboard/changelog.html`（実在する場合） | `https://support.speed-ad.com/changelog/` |
| ログイン前画面 | `index.html`（ルート） | **据え置き**（変更なし） |

### 3.2 URL方針の要点

- 記事詳細はパス方式（`/help-content/<slug>/`）を採用。
- 規約3種（利用規約・特商法表示・個人情報保護方針）は support 配下へ統合。
- `tokushoho` はローマ字のまま維持（日本固有用語で英語化の根拠が弱く、URL変更コストが上回るため）。
- ログイン前画面（`index.html`）は対象外。ルート直下構成を維持。

### 3.3 15番仕様との整合

- 本書の URL 構造は `/help/`・`/help-content/<slug>/`・`/faq/` 等を正本とする。
- 従来案内していた `/help-center/` は廃止し `/help/` に統一（13 番仕様書 §8 と一致）。`/tutorial/` は本書スコープ外。

## 4. クロスドメイン認証方式

サポートサイト遷移後にユーザーを特定する方式の選択肢。

| 方式 | 概要 | メリット | デメリット |
| --- | --- | --- | --- |
| 共有Cookie（`Domain=.speed-ad.com`） | セッションCookieをサブドメイン共有 | 実装コスト低 | Safari ITP で第三者コンテキスト扱いされ遮断されうる |
| クエリパラメータ | 遷移時にIDをクエリで渡す | Safari ITP の影響なし | URL露出／CSRF・リプレイ対策必須。採用時は短寿命署名付きトークン化（JWT等・数分）、ワンタイム化、ログマスキング必須 |
| SSO（将来） | Auth0等の共通認証基盤 | 最も堅牢 | 実装コスト大。別PRDで検討 |

- eTLD+1 が同一であればサブドメイン間通信は ITP の影響を受けにくいが、第三者コンテキストとして扱われる場合は遮断の可能性があり検証が必要。

### 4.1 Cookie／セッション属性方針

| 属性 | 目的 |
| --- | --- |
| `Domain=.speed-ad.com` | サブドメイン間でCookie共有するための設定。不要なら限定する |
| `Secure` | HTTPS時のみ送信。本番必須 |
| `HttpOnly` | JSからの読取禁止でXSS経由窃取防止。セッションCookie必須 |
| `SameSite=Lax`（または `Strict`） | 他サイト発リクエスト時に送信抑制しCSRF防止 |
| CSRFトークン | サポートサイトのフォームはダッシュボードと共用せず、独立発行・検証 |

## 5. 法令対応

### 5.1 規約URL変更時の同意記録ポリシー

規約URLが変わっても「同意時にユーザーが何に同意したか」を追跡可能にする。

- 旧URLは参照用アーカイブとして一定期間保持（単純301ではない）。
- 同意記録には **URL・バージョン・タイムスタンプ** を保存。
- **追記専用（append-only）ログ** ＋ SHA-256 等の改ざん検知ハッシュ。
- 改ざん防止策（SHA-256単体は検知のみ）として以下のいずれかを併用：
  - (a) ハッシュチェーン化
  - (b) WORM ストレージ保管
  - (c) 外部タイムスタンプ認証局（TSA）署名
- 規約3種の旧URLは同意記録存続期間に準じる（契約期間＋法定保存期間）。

### 5.2 電気通信事業法外部送信規律対応

GA・reCAPTCHA・外部フォント・CDN 等の外部送信ツール使用時、送信先・情報・目的・停止手段を記載した公表ページを `/privacy/` または `/privacy/external-transmission/` で常時公開する。

| 方式 | 内容 |
| --- | --- |
| A：通知UIバナー | 初回アクセス時に通知バナーを表示 |
| B：フッター常設リンク | 全ページフッターに公表ページ常設リンク |

- 公表ページ単独では要件未達の可能性があるため、A/B いずれかを必ず採用する。
- 選定は M2 期限・法務＋PO 合意。

### 5.3 GDPR 対応

- EU域内ユーザー想定時は、reCAPTCHA／GA 等の外部トラッキング系スクリプトを**同意取得まで読込遅延**させる。
- EU域内アクセス想定の要否は未決事項（#8）で確定。

### 5.4 個人情報保護方針の階層

- `abroad-o.com/rule.html`：会社全体のプライバシーポリシー（上位規範）。
- `/privacy/`（本書配置）：Speed Ad サービス固有の個人情報保護方針（実施細則）。
- ユーザー同意は **`/privacy/` を基準**として取得。優先順位は法務合意必須論点。
- 法定表示（`/privacy/`・`/terms/`・`/tokushoho/`）は常時到達可能性を担保し、監視対象に必ず含める。

## 6. 301リダイレクト計画

### 6.1 旧 → 新URL マッピング

規約3種は単純301ではなく §5.1 の同意記録ポリシーに従った別分岐処理となる。

| 旧URL | 新URL | 備考 |
| --- | --- | --- |
| `/help.html` | `https://support.speed-ad.com/help/` | ヘルプTOP |
| `/help-content.html` | `https://support.speed-ad.com/help-content/` | slug未指定時 |
| `/help-content.html?article=<id>` | `https://support.speed-ad.com/help-content/<slug>/` | id→slug変換。変換失敗時は `/help/` へ301（404ではない） |
| `/faq.html` | `https://support.speed-ad.com/faq/` | |
| `/bug-report.html` | `https://support.speed-ad.com/bug-report/` | |
| `/terms-of-service.html` | `https://support.speed-ad.com/terms/` | §5.1 準拠（別分岐） |
| `/specified-commercial-transactions.html` | `https://support.speed-ad.com/tokushoho/` | §5.1 準拠 |
| `/personal-data-protection-policy.html` | `https://support.speed-ad.com/privacy/` | §5.1 準拠 |
| `/changelog.html` | `https://support.speed-ad.com/changelog/` | 実在確認後のみ301対象 |
| `/help-content.html?category=<cat>` | `/help/?category=<cat>` | カテゴリをTOPへ |
| `/help-content.html?search=<query>` | `/help/?search=<query>` | 検索をTOPへ |
| `/faq.html?search=<query>` | `/faq/?search=<query>` | FAQ検索 |

- クエリは UTF-8 統一（Shift_JIS 混入・二重エンコード防止）。

### 6.2 HTTPS 強制・HSTS

- **HTTPS強制：** `http://support.speed-ad.com/*` → `https://` へ301。
- **HSTS：** `Strict-Transport-Security: max-age=31536000; includeSubDomains`。
  - `includeSubDomains` 採用前に**全サブドメインのHTTPS化を必ず確認**する（未対応サブドメインは到達不能になる）。
- リダイレクトループ防止：設定前に検証を実施。

### 6.3 オープンリダイレクト対策

- `Location` ヘッダのホスト部を `support.speed-ad.com`／`app.speed-ad.com` のホワイトリスト限定。
- 照合は**正規化処理後**（NFKC＋小文字化＋パーセントデコード後）の完全一致。
- `?redirect=`／`?next=` 等のユーザー入力由来リダイレクトは原則禁止。

## 7. 不具合報告フォーム（`/bug-report/`）

### 7.1 URL方針

- 既存の `/bug-report/` URL を維持（SEO・ブックマーク・外部リンク破壊コスト回避）。
- 汎用お問い合わせ窓口（`contactModal.html`）とは別物。扱いは未決事項（#6）で確定。

### 7.2 セキュリティ要件

| 要件 | 内容 | 目的 |
| --- | --- | --- |
| TLS必須 | HTTPS のみ受付、HTTP からは強制リダイレクト | 盗聴・改ざん防止 |
| サーバーサイド入力検証 | フロント依存しない | フロント検証は迂回可能 |
| CSRFトークン | フォームごとに発行・検証 | 第三者サイトからの悪用防止 |
| bot対策 | reCAPTCHA v3 または同等 | 自動投稿・スパム防止 |
| プライバシー同意 | 送信前に `/privacy/` 同意取得文言 | 個人情報保護法対応 |
| 保管時暗号化 | クラウドKMSによる鍵管理・定期ローテーション | 漏えい時影響最小化 |
| アクセス権限最小化 | RBAC 等で必要最小限の担当者に限定 | 内部不正防止 |

- reCAPTCHA 採用時はユーザー行動データが Google へ外部送信されるため、電気通信事業法外部送信規律の対象。

### 7.3 未ログイン時

- 送信可否（許可／禁止）は未決事項（#6）で確定。
- 少なくともメールアドレスを必須入力。
- `/privacy/` 同意取得の文言を必須。
- 未成年者保護（16歳未満想定の有無・保護者同意要否）も #6 で確定。

## 8. 推奨フォルダ構成

`05_support/` の `05_` は既存 `01_`〜`04_` に続く連番。

```
SPPED-AD-TEST/
├── index.html                       # ログイン前画面（据え置き）
├── 02_dashboard/                    # app.speed-ad.com
│   ├── common/footer.html           # リンクを絶対URLへ差し替え
│   └── src/sidebarHandler.js        # サイドバー「サポート」を絶対URLへ
│
└── 05_support/                      # support.speed-ad.com
    ├── help/index.html
    ├── help-content/<slug>/index.html
    ├── faq/index.html
    ├── bug-report/index.html
    ├── terms/index.html
    ├── tokushoho/index.html
    ├── privacy/index.html
    ├── changelog/index.html            # 実在確認後に配置
    ├── assets/
    ├── src/
    ├── common/
    ├── service-top-style.css
    └── data/
```

### 8.1 共有アセット管理方式

| 方式 | メリット | デメリット |
| --- | --- | --- |
| 複製 | シンプル | バージョンドリフトリスク |
| シンボリックリンク | 単一ソース | 環境依存、CI/CD複雑化 |
| ビルド時コピー | 再現性高い | ビルド設定維持コスト |
| CDN共有 | バージョン一元管理 | CDN設定必要、デプロイ構成確定前提 |

- **暫定：複製運用**。デプロイ構成確定後に CDN 共有移行を判断。CI でチェックサム比較してドリフト検知。
- `help_articles.json` 移設時は非公開メタ情報（ドラフト・社内メモ）混入チェックを手順書化。
- 複製時は `NOTICE`／`LICENSE` も複製し著作権表示義務を遵守。

## 9. ダッシュボード側書換範囲

- 外部遷移（ダッシュボード → サポート）は別タブ（`target="_blank"`）、内部遷移は同タブ。
- `target="_blank"` には **`rel="noopener noreferrer"` 必須**（`window.opener` 悪用・Referer漏洩防止）。
- CI で未付与リンクの検出・ブロックを組み込む。

### 9.1 書換対象ファイル

| ファイル | 書換対象 |
| --- | --- |
| `02_dashboard/common/footer.html` | ヘルプ・FAQ・規約3種・bug-report |
| `02_dashboard/src/sidebarHandler.js` | サイドバー「サポート」リンク |
| `02_dashboard/premium_signup_new.html` / `.js` | お問い合わせリンク |
| `02_dashboard/premium_registration_spa.html` | 利用規約リンク |
| `index.html` | 利用規約・個人情報保護方針リンク（localhost混入も修正対象） |

完全パス・行番号は実装前棚卸しで確定し、実装仕様書へ記載。

### 9.2 JS移設

- `02_dashboard/src/` 配下は**棚卸しで分類**してから移設。
- `help-center.js`・`help-content.js`・`breadcrumb.js` は support 専用の可能性大。
- `main.js` はダッシュボード共通の可能性があるため、棚卸しなし移設・削除は禁止。

### 9.3 `help_articles.json` 内リンク一括書換

- 本文中 `[label](help-content.html?article=gs002)` 形式（10件以上）を `/help-content/<slug>/` 絶対URLへ変換。
- ドライランモード必須。変換後リンクチェッカー実行。
- 画像・動画の相対／絶対パスも絶対URL化。

## 10. 未決事項（改修着手前に確定）

- デプロイ構成（#2）が未確定のままでは実装不可。
- 期限超過時：一次＝PO、二次＝経営層（CTO 等）。オーナーは週次進捗報告。
- マイルストーン：**M1＝デプロイ構成確定／M2＝法務合意取得／M3＝実装着手／M4＝全面切替**。

| # | 項目 | 期限 | 意思決定者 |
| --- | --- | --- | --- |
| 1 | 共有アセット管理方式（複製／CDN共有） | M1 | 開発リード |
| 2 | **デプロイ構成（同リポジトリ＋別ワークフロー／別リポジトリ）最優先** | M1 | PO＋開発リード |
| 3 | `index.html` 将来配置（本書スコープ外・別途検討） | — | — |
| 4 | マーケ・法務合意（規約3種URL変更・同意記録ポリシー・`/privacy/`階層） | M2 | 法務＋マーケ |
| 5 | 多言語対応の要否 | 中期ロードマップ策定時 | PO |
| 6 | `/bug-report/` ログイン連携方式／未ログイン送信可否／未成年者保護 | M1 | 開発リード＋セキュリティ |
| 7 | 記事詳細URL生成方式（ビルド時HTML／CDN rewrite+JS） | M1 | 開発リード |
| 8 | Cookie同意方針／外部送信規律対応方式A/B／EU域内想定要否 | M2 | 法務＋PO |
| 9 | 15番仕様追従改訂 | 本書確定後M1 | 開発リード |
| 10 | 運用手順書（窓口・エスカレーション・オンコール・障害対応ランブック） | M3前 | CS責任者＋開発リード＋SRE |
| 11 | URL正規化ルール（www有無／末尾スラッシュ／クエリ保持） | M1 | 開発リード |
| 12 | HSTS preload 採用可否 | M3前 | 開発リード＋セキュリティ |
| 13 | 個人情報インシデント対応プレイブック | M3前 | 個人情報保護責任者＋セキュリティ |

## 11. 異常系

| ケース | 期待挙動 |
| --- | --- |
| 存在しない slug | HTTP 404 ＋「ヘルプセンターへ戻る」導線 |
| 大文字URL（`/Help-Center/`） | 小文字へ301 |
| 末尾スラッシュなし | 末尾スラッシュありへ301 |
| `www` 付き | 正規形式へ301（正規方向は #11 で確定） |
| `http://` アクセス | `https://` へ301 |
| 記号・特殊文字 slug（`../../../etc`） | ホワイトリスト検証で 400/404 |
| リダイレクトループ | 500 or 静的エラーページ |
| 500系 | エラーページ。一次：bug-report 誘導／二次：外部ステータスページ |
| 旧URL `?article=<無効id>` | `/help/` へ301 |
| オープンリダイレクト攻撃（`?redirect=外部URL`） | HTTP 400 |
| プロトコル偽装（`https:\\...`・`//...`・Unicode回避） | HTTP 400（正規化後の完全一致で弾く） |

- エラーページはナビゲーションを含め、自身は 200 を返す（Soft 404 回避）。

## 12. 受入条件 / DoD

- [ ] 旧URL全件（規約3種除く）が301応答・`Location` が期待値と一致
- [ ] `http://` → `https://` 正常動作、リダイレクトループなし
- [ ] `target="_blank"` 全件に `rel="noopener noreferrer"` 付与（CI grep＋HTMLパーサ検証）
- [ ] `help_articles.json` Markdownリンク切れ0件
- [ ] 各サポートページ HTTP 200、旧URL→新URL HTTP 301
- [ ] canonical が各ページ正規URLと一致
- [ ] `sitemap.xml`・`robots.txt` 配置・Google Search Console 再送信
- [ ] 法定表示（`/privacy/`・`/terms/`・`/tokushoho/`）HTTP 200・内容表示
- [ ] 非機能要件（性能・セキュリティヘッダ等）PASS
- [ ] CSテンプレ棚卸し完了
- [ ] マーケ・法務合意取得
- [ ] 書換対象ファイル棚卸し完了

### 12.1 規約3種 DoD

- [ ] 新URL が HTTP 200／canonical 一致
- [ ] 同意導線（フォーム送信時同意）正常動作
- [ ] 同意記録に URL・バージョン・タイムスタンプ記録
- [ ] 旧URL保持が §5.1 ポリシー準拠（単純301ではない）

## 13. 非機能要件

### 13.1 性能・可用性

- 初期表示（TTFB・LCP）は許容範囲内（数値は PRD/ADR）。
- 静的アセットは CDN 経由・適切な `Cache-Control`。
- SLO／SLA は別 PRD/ADR。法定表示は月次可用性 99.9% 以上を目安。

### 13.2 セキュリティヘッダ

| ヘッダ | 設定 | 目的 |
| --- | --- | --- |
| CSP | `default-src 'self'` ベース＋必要ドメインのみホワイトリスト | XSS・不正リソース読込緩和。reCAPTCHA・GA等は明示追加 |
| HSTS | `max-age=31536000; includeSubDomains` | HTTPダウングレード攻撃防止 |
| X-Frame-Options | `DENY` または `SAMEORIGIN` | クリックジャッキング防止 |
| Referrer-Policy | `strict-origin-when-cross-origin` | URL詳細のRefererでの漏洩防止 |
| Permissions-Policy | 最小権限（不要機能は `()` で全無効化） | カメラ・位置情報・広告トラッキング系（`interest-cohort`・`browsing-topics` 等）の乱用防止 |
| X-Content-Type-Options | `nosniff` | MIMEスニッフィング防止 |

### 13.3 アクセシビリティ・i18n・対応ブラウザ

- WCAG 2.1 AA 準拠目標。
- 初期リリースは日本語のみ。多言語対応は #5 意思決定後。
- Chrome／Firefox／Safari／Edge 最新版（前1メジャーも推奨対象）。
- Safari ITP でのクロスサブドメイン Cookie、Chrome SameSite 挙動は必ず検証。

## 14. 運用要件

### 14.1 監視・ログ

- 死活監視・SSL期限監視・4xx/5xxアラート・法定表示ページ監視。
- 旧URL定期合成監視（301応答・Location値を例：5分間隔で検証）。
- 本番ログアクセスはSRE・セキュリティのみ（RBAC）。開発者参照は個別承認フロー：(a) チケット、(b) 責任者承認（監査ログ連動）、(c) 期限付き権限昇格（JIT Access）。
- PII（メール・電話番号等）は自動マスキング検討。IPアドレス・フォーム送信内容を含むログは保管期間最短化、必要に応じ仮名化。

### 14.2 RTO/RPO・切り戻し

- RTO／RPO 数値は PRD/ADR。
- 切り戻し：`app.speed-ad.com` 配下の旧ファイルへ一時向け直し。
- サポートサイトダウン時：法定表示3ページはダッシュボード側に静的ミラー保持、または代替ドメイン自動切替。
- 発動条件例：主要旧URL合成監視が連続 N 分異常。解除条件：復旧検知後。
- `/bug-report/` 到達不能時のため外部ステータスページ（Statuspage.io 等）を併記し、ダッシュボードフッターに固定掲示推奨。
- 旧ファイル保持：切り戻し可能期間（新旧URL併記6ヶ月以上と同期）中は保持。

### 14.3 個人情報インシデント対応

漏えい時は個情法26条に基づき：

1. 本人通知（遅滞なく）
2. 個人情報保護委員会への速報（3〜5日以内）
3. 確報（30日以内）

- 責任者：個人情報保護責任者（PRD/ADR で任命）
- 通報経路：開発リード → セキュリティ → 保護責任者 → 個情委
- プレイブック策定は #13。

### 14.4 コスト・IaC・変更管理

- 月次コストレビュー・予算超過アラート（DNS/CDN/SSL/監視/運用工数）。
- インフラ設定（DNS・CDN・リダイレクト）は IaC 管理推奨。
- URL一覧・CDN・リダイレクト設定変更は担当者以外の承認（レビュー）必須。

### 14.5 旧ファイル削除の承認・監査

`02_dashboard/` 配下の旧サポート系削除時は3者分離：

1. 棚卸し担当者が対象リスト作成
2. 承認者（開発リード）が内容確認
3. 削除実施者が実行

削除ログは監査ログ基盤保管。棚卸しサイクルは切り戻し可能期間満了後。

## 15. リリース計画概要

### 15.1 フェーズ

| フェーズ | 内容 |
| --- | --- |
| 準備 | デプロイ構成確定・ドメイン／SSL設定・フォルダ構成・JS棚卸し・`help_articles.json` 移設・Markdownリンク書換・`changelog.html` 実在確認 |
| 検証 | ステージングでリダイレクト全件検証・リンクチェッカー・非機能要件・セキュリティ検証 |
| 段階公開 | 一部ページから順次切替 |
| 全面切替 | 全ページ新URL公開・旧URLリダイレクト有効化・Search Console再送信 |

### 15.2 ロールバック

- 問題発生時は `app.speed-ad.com` 配下の旧ファイルへ一時切り戻し。
- 段階公開中は切替済みページのみ切り戻し対象。
- 旧ファイル削除は切り戻し可能期間満了後。

### 15.3 事前アナウンス・新旧URL併記

- 影響ユーザー・CS・外部連携システムへ切替前通知（方法・時期は PRD）。
- 一定期間ダッシュボード内に「サポートサイトがリニューアルしました」バナー検討。
- 旧URLリダイレクトは**最低6ヶ月維持**推奨（SEO移転完了観点）。

### 15.4 CSテンプレ棚卸し（必須）

- [ ] メール署名（CS担当・自動送信）URL更新
- [ ] 自動返信メールURL更新
- [ ] 障害・メンテナンス通知テンプレURL更新
- [ ] ヘルプ記事本文内絶対URL（`help_articles.json` 外部参照含む）更新
- [ ] CS運用ドキュメント・社内Wiki棚卸し
- [ ] **外部媒体掲載URL**棚卸し（`abroad-o.com` 本体／公式SNS／リスティング・LP／請求書・契約書PDF／Googleビジネスプロフィール／取引先・代理店掲載）

### 15.5 CS負荷・SEO再送信

- URL変更後一定期間は「ページが見つからない」問い合わせ増の可能性。事前アナウンス・バナー・旧URLリダイレクトで軽減。CS事前周知と対応フロー整備必須。
- 全面切替後、`sitemap.xml` を Google Search Console へ再送信。canonical が新URLを指すことを確認。

## 16. 関連ドキュメント

| ドキュメント | 本書との関係 | 期限 | 担当 |
| --- | --- | --- | --- |
| `13_help_center_requirements.md` | §8 URL構造と本書は `/help/` で整合。本書確定後に微調整 | 本書確定後M1 | 開発リード |
| `18_screen_inventory_current.md` | support移設画面の「ホスト」列を更新 | M1 | 開発リード |
| `00_screen_requirements.md` | サポートサイト分離後のURL・ドメインは本書が正本 | 適宜 | 開発リード |
