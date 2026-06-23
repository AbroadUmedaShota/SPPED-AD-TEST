# 05_DEPLOYMENT.md: デプロイガイド

## 1. 現行方針

SPEED AD は静的モック画面開発を継続しつつ、公開済みの support サブドメインは `05_support/` 配下だけを半自動で反映する。

- デプロイ対象は `05_support/` のみとし、`02_dashboard/` や `03_admin/` などの開発中画面は混ぜない。
- 本番反映は承認後に実施する。2026年6月15日（月）の公開コンテンツは、同日JSTの承認後に prod へ反映する。
- 反映前に GitHub の最新 `origin/main` と作業ツリーの状態を確認し、未整理のローカル差分を含めない。

## 2. 事前確認

```powershell
git fetch origin main
git status --short --branch
git log --oneline -5
```

作業ツリーが dirty、または `origin/main` と意図せず差分がある場合は、本番デプロイ前に差分の扱いを確認する。必要に応じて `origin/main` からクリーンな一時 worktree を作ってデプロイする。

JSON と mirror の確認:

```powershell
Get-Content .\05_support\assets\data\news.json | ConvertFrom-Json | Out-Null
Get-Content .\05_support\assets\data\customer-voices.json | ConvertFrom-Json | Out-Null
Get-Content .\data\customer-voices.json | ConvertFrom-Json | Out-Null
.\scripts\sync-customer-voices.ps1 -Check
```

問い合わせフォームは専用GASを配備済みで、`05_support/contact/index.html` の `#contactForm[data-endpoint]` に Web App URL を反映する。未設定の場合、フォームは送信成功扱いにせず「送信先の設定が未完了」と表示する。本番反映前に、最新の Web App URL、Sheet保存、Drive添付保存、`customer@speed-ad.com` From の受付メール送信を再確認する。

## 3. STG デプロイ

```powershell
.\scripts\deploy-support-site.ps1 -Environment stg -Delete -Profile speed-ad -DistributionId EDJ1GHHD1FP7Q
```

STG では最低限以下を確認する。

- `https://stg.support.speed-ad.com/`
- `https://stg.support.speed-ad.com/help/`
- `https://stg.support.speed-ad.com/faq/`
- `https://stg.support.speed-ad.com/contact/`
- `https://stg.support.speed-ad.com/bug-report/` が `/contact/` へ転送されること
- `https://stg.support.speed-ad.com/news/`
- `https://stg.support.speed-ad.com/assets/data/news.json`
- `https://stg.support.speed-ad.com/customer-voices/`
- `https://stg.support.speed-ad.com/customer-voices/company-monitor/`
- `https://stg.support.speed-ad.com/customer-voices/university-survey/`
- `https://stg.support.speed-ad.com/assets/data/customer-voices.json`
- `https://stg.support.speed-ad.com/plans/`
- `https://stg.support.speed-ad.com/privacy/`
- `https://stg.support.speed-ad.com/tokushoho/`
- `https://stg.support.speed-ad.com/common/header.html`

## 4. PROD デプロイ

本番は承認後のみ実行する。

```powershell
.\scripts\deploy-support-site.ps1 -Environment prod -Delete -Profile speed-ad -ConfirmProduction
```

CloudFront distribution ID が分かっている場合は `-DistributionId <ID>` も付け、キャッシュを無効化する。DistributionId がない場合、スクリプトは S3 sync のみ実施し、CloudFront invalidation をスキップする。

## 5. 本番確認

本番反映後は以下を確認する。

- `https://support.speed-ad.com/news/` に新規お知らせが表示される
- `https://support.speed-ad.com/contact/` の必須入力、同意チェック、送信先未設定時のエラー表示が意図通りである
- `https://support.speed-ad.com/bug-report/` が `/contact/` へ転送される
- `https://support.speed-ad.com/news/official-release-2026-06-15/` が 200
- `https://support.speed-ad.com/customer-voices/` と2件の詳細ページが 200
- `https://support.speed-ad.com/assets/data/customer-voices.json` が公開予定の匿名データと新規画像6枚を参照している
- `pic1.jpg`、`pic2.jpg`、`pic3.jpg`、実名・固有名詞が公開 JSON と導入事例画面に残っていない
- 主要ページで画像404とコンソールエラーがない

## 6. 役割境界

- AI/Codex: 事前確認、STG/prod コマンド実行、URL確認、結果報告を担当できる。
- 人間の承認者: 本番反映可否、公開タイミング、AWS SSO 認証、法務・文言判断を承認する。
- 本番公開後の戻し判断が必要な場合は、直前コミットまたは S3/CloudFront の状態を確認してから個別に手順化する。
