### Implementation Proposal

本Issueを解決するため、以下の計画で実装を進めます。

#### 1. **事前調査のまとめ**
- `tools/generate_dummy_answers.py` 内に `TARGET_COUNT = 100` という定数があります。
- これを `500` に変更し、スクリプトを実行することで目的を達成できます。

**変更対象ファイル:**
- `tools/generate_dummy_answers.py`

#### 2. **プロジェクト目標への貢献**
- 開発およびテスト用のデータセットを拡充し、品質向上に寄与します。

#### 3. **変更の概要**
- `TARGET_COUNT` を 500 に変更。
- スクリプト実行により `docs/examples/demo_answers/sv_0001_25060.json` を更新。

#### 4. **各ファイルの具体的な作業内容**
- `tools/generate_dummy_answers.py`:
    - `TARGET_COUNT = 100` -> `TARGET_COUNT = 500`

#### 5. **完了の定義 (Definition of Done)**
- [ ] `docs/examples/demo_answers/sv_0001_25060.json` に500件のデータが含まれていること。
- [ ] `WEEKLY_CHANGELOG.md` に変更を記録する。

---
承認いただける場合は、本コメントに "Approve" と返信するか、CLIで承認の旨をお伝えください。