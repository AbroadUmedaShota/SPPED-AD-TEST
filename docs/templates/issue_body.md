### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- `media/generated/sv_0003_26009` フォルダ内のサンプル画像が同一画像の複製となっており、テストデータとしての有用性が低い。
- 命名規則が「アンケートID_連番_判別コード」の形式になっておらず、システム連携のテストに適していない。
- `Pillow` ライブラリを使用して、日本語フォントを含む動的な画像生成が可能であることを確認済み。

**Files to be changed:**
- `media/generated/sv_0003_26009/bizcard/*` (再生成)
- `media/generated/sv_0003_26009/handwriting/*` (再生成)
- `media/generated/sv_0003_26009/attachment/*` (再生成)
- `tools/generate_realistic_images.py` (新規追加)

#### 2. **Contribution to Project Goals**
- よりリアリスティックなサンプルデータを提供することで、開発中のダッシュボードや管理画面の機能検証（画像表示、OCR連携等）の精度を向上させる。

#### 3. **Overview of Changes**
- `Pillow` を使用した画像生成スクリプト `tools/generate_realistic_images.py` を作成。
- 命名規則を `アンケートID_連番_判別コード`（例: `sv_0003_26009_0001_1.jpg`）に変更。
- 900セット（計3,600枚）の多様な画像を生成。

#### 4. **Specific Work Content for Each File**
- `tools/generate_realistic_images.py`: 日本語フォント（MSゴシック等）を使用し、ランダムな会社名、氏名、メモ、図面風の描画を行うロジックを実装。
- `media/generated/sv_0003_26009/*`: スクリプトを実行し、既存のダミー画像を新しい命名規則のリアルな画像で置き換える。

#### 5. **Definition of Done**
- [x] 画像生成スクリプトが実装されている。
- [x] 3,600枚の画像が新しい命名規則で正しく生成されている。
- [x] 各画像が同一ではなく、ランダムな内容（テキストや図形）を含んでいる。
- [x] 日本語が正しく描画されている。

---
User approval confirmed on the CLI.

