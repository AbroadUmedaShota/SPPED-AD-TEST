# デザインガイドライン: SpeedAd

## 1. はじめに

このドキュメントは、SpeedAdアプリケーションのUIデザインにおける一貫性と品質を保証するためのガイドラインを定めます。
本文書は `service-top-style.css` に定義されたスタイルを基にしており、カラースキーム、タイポグラフィ、コンポーネントのスタイル、スペーシングなど、UIを構成する要素の基準を明確にします。

## 2. カラーパレット

### 2.1. 基本思想

Material Designの思想を参考にしつつ、ブランドカラーを効果的に使用します。ライトモードとダークモードの両方で高い可読性と視認性を確保します。

### 2.2. ライトモード

| 用途 | 色名 | HEX | 説明 |
| :--- | :--- | :--- | :--- |
| **プライマリブランド** | Brand Primary Purple | `#4B2E83` | 最も重要なアクションやブランドロゴに使用。 |
| **セカンダリブランド** | Brand Secondary Blue | `#2064A8` | リンクやフォーカス時のハイライトに使用。 |
| **アクセント** | Gradient Brand Accent | `linear-gradient` | 主要なCTAボタンに使用するグラデーション。 |
| **背景 (メイン)** | Background Main | `#FFFFFF` | 画面全体の基本背景色。 |
| **背景 (サブ)** | Background Sub | `#F0F0F0` | カードやセクションの背景など、少し区別したい場合に使用。 |
| **テキスト (メイン)** | Text Main | `#1A1A1A` | 本文や主要なテキスト。 |
| **テキスト (サブ)** | Text Sub | `#6B6B6B` | 補足情報やヒントテキスト。 |
| **ボーダー/区切り線** | Border Divider | `#E0E0E0` | カードの境界線や区切り線。 |
| **エラー** | State Error | `#D32F2F` | エラーメッセージや破壊的操作のボタン。 |
| **成功** | State Success | `#4CAF50` | 成功通知。 |

### 2.3. ダークモード

| 用途 | 色名 | HEX | 説明 |
| :--- | :--- | :--- | :--- |
| **プライマリブランド** | Brand Primary Purple | `#BB86FC` | ライトモードのPrimaryに対応。 |
| **セカンダリブランド** | Brand Secondary Blue | `#03DAC6` | ライトモードのSecondaryに対応。 |
| **背景 (メイン)** | Background Main | `#121212` | ダークモードの基本背景色。 |
| **背景 (サブ)** | Background Sub | `#1E1E1E` | カードや入力フィールドの背景。 |
| **テキスト (メイン)** | Text Main | `#E0E0E0` | 主要なテキスト。 |
| **テキスト (サブ)** | Text Sub | `#BBBBBB` | 補足情報。 |
| **ボーダー/区切り線** | Border Divider | `#3A3A3A` | 境界線。 |
| **エラー** | State Error | `#CF6679` | エラー状態。 |

## 3. タイポグラフィ

- **基本フォント**: `"Noto Sans JP"` (日本語), `"Inter"` (欧文), `sans-serif` (フォールバック)
- **基本フォントサイズ**: `16px` (body-large)
- **フォントウェイト**: Normal (400), Medium (500), Bold (700)

| 用途 | フォントサイズ | ウェイト | 説明 |
| :--- | :--- | :--- | :--- |
| **見出し (H1)** | `2rem` (32px) | Bold | ページやモーダルの主要なタイトル。 |
| **見出し (H2)** | `1.375rem` (22px) | Bold | セクションのタイトル。 |
| **本文 (大)** | `1rem` (16px) | Normal | 主要なコンテンツのテキスト。 |
| **本文 (中)** | `0.875rem` (14px) | Normal | テーブル内のテキストや補足情報。 |
| **本文 (小)** | `0.75rem` (12px) | Normal | ラベルやエラーメッセージ。 |

## 4. コンポーネント別スタイル

### 4.1. ボタン

- **プライマリボタン (CTA)**:
    - **背景**: `var(--gradient-brand-accent)`
    - **テキスト色**: `var(--color-button-primary-text)`
    - **ホバー**: `var(--color-button-primary-hover-bg)` (単色ブルー)
    - **形状**: 角丸 (`rounded-full` または `rounded-md`)
- **セカンダリボタン**:
    - **背景**: `var(--color-button-secondary-bg)`
    - **テキスト色**: `var(--color-button-secondary-text)`
    - **ホバー**: `var(--color-button-secondary-hover-bg)`
- **デンジャーボタン**:
    - **背景**: `var(--color-button-danger-bg)`
    - **テキスト色**: `var(--color-button-danger-text)`
    - **ホバー**: `var(--color-button-danger-hover-bg)`
- **無効状態**:
    - **背景**: `var(--color-button-disabled-bg)`
    - **テキスト色**: `var(--color-button-disabled-text)`
    - **カーソル**: `not-allowed`

### 4.2. フォーム入力 (Raised Label)

- **思想**: ラベルが常に入力フィールドの上に配置される（Raised）UIを採用し、入力内容とラベルの重なりを完全に防ぎ、視認性を確保する。
- **通常時**: ラベルは入力エリアの枠線上に、少し小さいフォントサイズで表示される。
- **フォーカス時**: ラベルのテキスト色と入力欄の枠線の色を、`var(--color-input-border-focus)` に変更し、`3px` の `box-shadow` を表示してフォーカス状態を明確にする。
- **ボーダー**: `1px solid var(--color-input-border-default)`
- **エラー時**: ボーダー色を `var(--color-input-border-error)` に変更し、エラー用の `box-shadow` を表示。下部にエラーメッセージを表示。

### 4.3. カード・パネル

- **背景**: `var(--color-base-card)`
- **ボーダー**: `1px solid var(--color-base-border-divider)`
- **角丸**: `0.5rem` (`rounded-xl` または `rounded-lg`)
- **影**: `var(--color-base-shadow-soft)`

### 4.4. モーダル

- **オーバーレイ**: `var(--color-scrim)` を使用し、背景を半透明に覆う。
- **コンテンツ**: 画面中央に配置。カードスタイルを適用。
- **アニメーション**: 表示時は下から上へ、非表示時は上から下へ移動するような、控えめなトランジションを適用する。

### 4.5. テーブル

- **ヘッダー背景**: `var(--color-surface-variant)`
- **行の区切り線**: `1px solid var(--color-outline-variant)`
- **ホバー**: 行の背景色を `var(--color-surface-variant)` に変更し、カーソルを `pointer` にする。
- **レスポンシブ**: モバイル表示では、各行がカード形式のように縦に積まれ、各データにラベルが付与される形式に変化する。

## 5. スペーシングとレイアウト

- **基本グリッド**: 4の倍数 (4px, 8px, 12px, 16px, 24px, 32px...) を基本単位として、マージンやパディングを設定する。
- **一貫性**: コンポーネント間の余白や、コンポーネント内のパディングは、アプリケーション全体で一貫した値を使用する。

## 6. アイコン

- **ライブラリ**: Material Icons を使用する。
- **サイズ**: `16px`, `20px`, `24px` を基本とし、用途に応じて使い分ける。
- **色**: 基本的にはテキストカラーに準ずるが、アクションを示す場合はブランドカラーを使用することもある。

## 7. アクセシビリティ (A11y)

- **モーション**: `prefers-reduced-motion` メディアクエリを尊重し、アニメーションやトランジションを無効化する。
- **コントラスト**: WCAG 2.1のコントラスト比基準（AAレベル以上）を満たすように、テキストと背景の色の組み合わせを維持する。
