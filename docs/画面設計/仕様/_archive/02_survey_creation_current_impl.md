# アンケート作成・編集（現行実装メモ）

本ドキュメントは、`02_dashboard/surveyCreation.html` を中心とするアンケート作成・編集画面の「現在の実装状態」をまとめた付録です。`surveyCreation.html` は `surveyCreation-v2.html` のUI/操作系を正式版として取り込み、正式URLのままV2デザインを提供します。

## 現在の前提
- 表示・入力は日本語単一で運用（多言語UIはCSSで一時非表示）
- 既存データ（{ja,en}形式）はロード時に日本語優先で文字列へ正規化
- コア構成・依存は従来どおり（Tailwind, Material Icons, flatpickr, Sortable）

## 対象ファイル
- 画面: `02_dashboard/surveyCreation.html`
- ロジック: `02_dashboard/src/surveyCreation.js`
- レンダラ: `02_dashboard/src/ui/surveyRenderer.js`
- スタイル: `02_dashboard/service-top-style.css`

## 現状のUI（主なポイント）
- レイアウト
  - `surveyCreation.html` / `surveyCreation-v2.html` は同一系のV2 UIを表示
  - 基本情報、設定カード、設問ビルダー、右側アウトライン、モバイル固定アクションバーで構成
- 設問編集
  - 設問はアコーディオン型カードで編集
  - 設問タイプ追加、並べ替え、アウトライン同期、空状態ガイドを提供
- 追加導線
  - プレビュー、QR発行、保存をデスクトップ/モバイル双方に配置
  - 名刺データ化設定、お礼メール設定、サンクス画面設定への遷移導線を維持
- 多言語
  - V2の言語タブUIを利用し、編集中言語の切替と未入力バッジ表示に対応

## 暫定シングル化（互換あり）の要点
- 多言語データの取り込み
  - ロード時に {ja,en} → 文字列へ正規化（`ja`→`en`→空文字の優先）
  - レンダリング時も安全側で `ja/en` を文字列へ読み替え
- 多言語UIの一時非表示
  - CSSで英語入力フィールド/ラベルと言語切替UIを非表示
  - DOMは温存（後で戻せる）

## 主要CSSユーティリティ（追加分）
- `input-error`: 必須未入力時の赤枠
- マトリクス用
  - `.matrix-handle`/`.handle` hoverでprimary色へ
  - `.matrix-chosen`/`.matrix-drag`/`.matrix-ghost`（ドラッグ中の視覚効果）
  - `.matrix-preview-table`（stickyヘッダー/左列固定、ゼブラ/hover強調）

## 最近の改善（抜粋）
- タイプ名の日本語統一（Q見出しのタイプ表記）
- ハンドルの見やすさ（title付与/hover強調）
- プレースホルダ追加（入力の取っ掛かり）
- 必須入力の赤枠フィードバック
- マトリクス表の見やすさ（sticky/hover/アイコン）

## 次の段階（提案）
- フォーカス維持（追加/複製/並べ替え直後の対象入力にfocus）
- インラインエラーメッセージ（フィールド直下の文言＋セクション見出しバッジ）
- マトリクスのプリセット（5段階評価などの一括挿入）
- EN入力DOMの段階的削除/コメントアウト（暫定シングル化の仕上げ）
- 変換/正規化ロジックのloader集約とrendererの簡素化

本メモは現行の実装状態に追従して更新します。詳細仕様は従来の仕様書（`docs/画面設計/仕様/02_survey_creation.md` 等）も併読してください。
