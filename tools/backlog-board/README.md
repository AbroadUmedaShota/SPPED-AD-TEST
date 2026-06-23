# SPDAD2026 課題ボード — 運用ルールブック

Backlog プロジェクト **SPDAD2026（SPEEDAD 2026）** の全課題を、タブ/フィルタ/検索/要約モーダル付きの 1 枚 HTML にまとめて公開する仕組み。更新・追記の手順をここに集約する（Claude も人間もこの README を見れば運用できる）。

- 公開URL: https://abroadumedashota.github.io/SPPED-AD-TEST/backlog_unresolved_SPDAD2026_20260616.html
- 出力ファイル: リポジトリ直下 `backlog_unresolved_SPDAD2026_20260616.html`
  - **ファイル名は変えない**（公開URLを固定するため。日付は初版の名残で、中身の「最終更新」は生成日を表示する）

---

## 0. ファイル構成（このフォルダ）

| ファイル | 役割 | Git |
|---|---|---|
| `generate.py` | 本体。Backlog取得 or キャッシュ読込 → HTML生成 | コミットする |
| `prep_summaries.py` | 要約生成の補助（チャンク分割 / マージ） | コミットする |
| `summaries.json` | 各課題のAI要約（`{課題キー: 要約}`）。モーダルの「要約」に使う | コミットする |
| `cache.json` | Backlog取得結果のスナップショット（本文+最新2コメント込み） | **gitignore**（再取得可） |
| `chunk_*.json` / `sum_*.json` | 要約生成の一時ファイル | **gitignore**（merge後に自動削除） |

> APIキーはこのフォルダにもリポジトリにも**置かない**。キーは Claude のメモリ `reference_backlog_api`（`repinc.backlog.com`）にある。引数で渡すだけ。公開リポジトリなので絶対にハードコードしない。

---

## 1. いつ何をするか（運用トリガ）

- **定期（推奨：週1～展示会前後）**: Backlogから再取得して最新化。完了(クローズ)への移動・新規起票・ステータス変化を取り込む → 下「2. 最新化」。
- **新しい課題が増えた / 要約が必要**: 「2. 最新化」のあと「3. 要約の更新」で新規分だけ要約。
- **分類や色だけ直す**（BUG_OVERRIDE・環境判定など）: 取得不要。`python generate.py` だけで即再生成（「5. 分類の手直し」）。
- **未起票リストの増減**: `generate.py` の `unfiled` を編集して再生成（「6. 未起票リスト」）。

最後は必ず「7. コミット & 公開」。

---

## 2. 最新化（Backlogから再取得 ＝ 完了の再読込もこれ）

```bash
cd tools/backlog-board
python generate.py <BACKLOG_API_KEY> --refresh
```

- 全ステータス（**完了含む**）を取得し直して `cache.json` を上書き、HTMLを再生成する。
- 完了に移った課題は自動で「完了」タブへ移動。ステータス変化（未対応→対応中等）も反映。
- 新規課題は要約が無いので、モーダルは本文抽出のフォールバックになる。要約を付けるなら次へ。
- 実行時に `WARN: 要約未生成 N件` が出たら新規分が未要約。「3.」を実施。

---

## 3. 要約の更新（新規課題の要約を作る）

`summaries.json` に未収録の課題だけを抽出 → サブエージェントで要約 → マージ、の流れ。

```bash
cd tools/backlog-board
python prep_summaries.py split        # 未要約だけ chunk_0.json ... に分割（全部作り直すなら split --all）
```

分割された各 `chunk_K.json` を、**サブエージェント（tech_writer / content_writer / general-purpose を並列）** に渡して `sum_K.json` を出力させる。各エージェントへのプロンプトは次を使う（成果物にペルソナを混ぜない＝CLAUDE.md ルール#1）:

> あなたはBacklog課題の要約担当です。`<このフォルダの絶対パス>/chunk_K.json`（UTF-8 JSON配列）を読んでください。各要素は {key, summary(件名), status, type, description(本文), latest_comments(最新コメント)}。
> 各課題について、非エンジニアのPMでもひと目で内容が分かる日本語の要約を作成:
> - 2〜4文。簡潔・具体的に。「何の課題か(対象画面/機能)」「問題点 or やりたいこと」「(本文/コメントから読み取れる場合のみ)現状・原因・対応方針」。
> - description と latest_comments に書かれた事実のみを根拠にし、書かれていないことは創作しない（不明は書かない）。
> - 件名の言い換えで終わらせず中身を要約。箇条書き不可・文章で。絵文字/マーカー/ペルソナ口調は禁止。
> 出力: `<このフォルダの絶対パス>/sum_K.json` に {"課題キー": "要約文", ...} のJSONのみを書き込む。入力の全keyを必ず含める。

```bash
python prep_summaries.py merge        # sum_*.json を summaries.json に統合（一時ファイルは自動削除）
python generate.py                    # キャッシュから即再生成（要約反映）
```

---

## 4. 仕分けルール（generate.py が機械適用）

### 大分類（タブ）
- **新機能系** ＝ Backlog種別「新機能開発 / 仕様メモ / 仕様整理」
- **不具合系** ＝ Backlog種別「運用バグ修正 / 既存品質改善」
- ただし種別が仕様メモ/仕様整理でも、**中身を読んで実態がバグ/不具合のもの**は `BUG_OVERRIDE`（generate.py）で不具合系へ補正。補正行には `実態判定` バッジが付く。種別バッジ自体は Backlog 実値のまま。
- **未起票** ＝ Backlogに無い指摘（`unfiled` リスト）。
- **完了** ＝ ステータス「完了」。中は 新機能系/不具合系 のサブタブ。

### 進捗（サブタブ）
- **未対応** ＝ ステータス「未対応」「仕様確認中」（着手前）
- **対応中** ＝ それ以外の進行中（処理中 / 処理済み / DEV:〜 / STG:〜）

### 不具合の環境色（行の左帯＋バッジ）
判定の優先順（generate.py `detect_env`）:
1. 件名の明示タグ `[production]`/`【production】` → **本番(赤)**、`[stg]`/`【stg】` → **STG(アンバー)**、`[dev]`/`【dev】`/`【DEV不具合】` → **DEV(インディゴ)**
2. ステータス接頭辞 `DEV：…`→DEV、`STG：…`→STG
3. 本文キーワード `production`/`本番環境`→本番、`stg`→STG、`dev環境`→DEV
4. どれも無ければ **環境不明(グレー)**（無理に色を付けない＝捏造しない）

> 件名タグを最優先にしているのは、stgのバグが本文で「本番(production)」に言及して誤判定されるのを防ぐため（例: 138）。

---

## 5. 分類の手直し（取得不要・即反映）

`generate.py` を編集して `python generate.py`（引数なし＝キャッシュ使用）で再生成。

- **実態バグの追加/除外**: `BUG_OVERRIDE` の集合にキーを足す/削る。
- **環境を手で確定**: `ENV_OVERRIDE = {"SPDAD2026-99": "DEV", ...}` に書く（自動判定を上書き。値は `本番`/`STG`/`DEV`/`その他`）。環境不明の課題を中身確認して割り当てる時に使う。

---

## 6. 未起票リスト

`generate.py` の `unfiled = [...]` を直接編集（id・件名・箇所・調査メモ）。起票されたら該当項目を削除し、通常の課題として Backlog から取り込まれる。

---

## 7. コミット & 公開

```bash
cd <repo root>
git add backlog_unresolved_SPDAD2026_20260616.html tools/backlog-board
git commit -m "..."   # コミット文にペルソナ名を入れない（CLAUDE.md ルール#1 / PreToolUseフックでブロック）
git push origin main
```

- GitHub Pages（main直下配信）に push 後 30秒〜数分で反映。ブラウザは **Ctrl+F5** で強制再読込。
- 公開URLは固定: https://abroadumedashota.github.io/SPPED-AD-TEST/backlog_unresolved_SPDAD2026_20260616.html

---

## 8. 注意

- このボードは**内部のBacklog課題本文・コメントを公開Pagesに載せる**。ユーザー承知のうえでの公開運用（github.io正本方針）。機微情報を載せたくない課題が出たら相談する。
- Backlog API: `repinc.backlog.com` / プロジェクトID `162886` / キーは引数のみ（リポジトリに置かない）。
- 既知の前提: PC表示優先。要約は事実ベース（捏造禁止）。
