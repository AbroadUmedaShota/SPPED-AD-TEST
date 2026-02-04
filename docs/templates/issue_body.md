# docs: ドキュメント構造の実態に合わせた GEMINI.md の修正と整備

## 1. Pre-investigation Summary
- \GEMINI.md\ 第5章で定義されているドキュメント構造（\docs/00_PROJECT_OVERVIEW.md\ 等）が現在の実態（\docs/product/overview/00_PROJECT_OVERVIEW.md\ 等）と乖離しています。
- ルートディレクトリに \README.md\ が存在せず、プロジェクトの全体像が把握しづらい状態です。
- \AGENTS.md\ や \docs/product/README.md\ の情報を統合し、最新のディレクトリ構造に基づいた参照関係を再構築する必要があります。

## 2. 変更予定のファイル
- \GEMINI.md\
- \README.md\ (新規作成)

## 3. 具体的な作業内容
### GEMINI.md の修正
- \5.1. Document Structure and Content\ のテーブルを実態に合わせて更新。
- 全体を通して古いパス参照（\docs/01_ARCHITECTURE.md\ 等）を最新の配置に置換。

### README.md の新規作成
- プロジェクト概要、ディレクトリ構造、主要ドキュメントへのリンクを記載。

## 4. Definition of Done
- [ ] \GEMINI.md\ に記載されたドキュメントパスがすべて実在する。
- [ ] ルートに \README.md\ が作成されている。
- [ ] 全てのドキュメントリンクが正しく機能する（存在を確認）。
