# Laravel_キャッシュの削除について_OCR認証エラー

> [!CAUTION]
> このページは Backlog wiki の旧資料バックアップです。プロトタイプ期の資料であり、現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata

- wikiId: `1082514`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-04-15T04:33:48Z`

## Backlog 原文

php artisan config:clear
php artisan cache:clear

上記コマンド後は
php artisan optimize:clear
を行わないとOCRで認証エラーがでる

## 添付情報

- 添付なし

## Shared Files

- sharedFiles なし
