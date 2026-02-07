### Summary
- サンプル回答用画像を、同一画像の複製から動的に生成されたリアリスティックな画像に更新しました。
- 命名規則を「アンケートID_連番_判別コード」の形式に変更し、システム連携のテストを容易にしました。
- 画像生成用のPythonスクリプト `tools/generate_realistic_images.py` を追加しました。

### Related Issue
Closes #239

### Changes
- **New Script:** `tools/generate_realistic_images.py`
    - Pillowを使用して、会社名、氏名、ロゴ（名刺）、手書き風の線とテキスト（手書きメモ）、図面風の描画（添付資料）をランダムに生成します。
- **Updated Images:** `media/generated/sv_0001_26009/` 配下の全3,600枚を再生成。
    - 名刺表: `*_1.jpg`
    - 名刺裏: `*_2.jpg`
    - 手書き: `*_handwriting.png`
    - 添付: `*_attachment.jpg`

### Verification Results
- [x] スクリプトの正常動作確認。
- [x] 生成された画像の目視確認（日本語の描画、ランダム性）。
- [x] 命名規則が指定通りであることを確認。
