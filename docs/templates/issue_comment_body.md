### Implementation Proposal

本Issueを解決するため、以下の計画で実装を進めます。

#### 1. **事前調査のまとめ**
- 現在の実装は `02_dashboard/src/speed-review.js` 内の `renderTimeSeriesChart` 関数にあります。
- 固定で 0〜23時の配列を作成し (`const hours = Array(24).fill(0);`)、Chart.jsの `type: 'bar'` で描画しています。
- これを動的な範囲の配列生成と、`type: 'line'` への変更が必要です。

**変更対象ファイル:**
- `02_dashboard/src/speed-review.js`

#### 2. **プロジェクト目標への貢献**
- ユーザーにとって重要な「回答が集中している時間帯」をより直感的に、無駄な空白なく表示することで、分析の効率を向上させます。

#### 3. **変更の概要**
- `renderTimeSeriesChart` 関数を改修します。
- データの `answeredAt` から最小時刻（時）と最大時刻（時）を抽出します。
- X軸のラベル（`labels`）とデータ配列（`data`）を、[最小時刻 〜 最大時刻+1] の範囲で生成します。
- Chart.jsの構成を更新し、チャートタイプを `bar` から `line` に変更します。
    - 折れ線グラフ化に伴い、`tension` (曲線具合) や `fill` (塗りつぶし) オプションも調整し、見やすいデザインにします。

#### 4. **各ファイルの具体的な作業内容**
- `02_dashboard/src/speed-review.js`:
    - `renderTimeSeriesChart` 関数内:
        - データが空の場合は処理をスキップまたはクリア。
        - 全データの `answeredAt` をスキャンし、`minHour` と `maxHour` を特定。
        - 配列のサイズを `maxHour - minHour + 2` (終了時刻+1まで) で計算。
        - ループで該当時間帯のカウントを集計。
        - Chart初期化時の `type` を `'line'` に変更。
        - `datasets` の設定を折れ線グラフ用に調整（`borderColor`, `backgroundColor` (fill用), `tension` など）。

#### 5. **完了の定義 (Definition of Done)**
- [ ] グラフが「折れ線グラフ」になっていること。
- [ ] X軸の開始が「最初の回答時間（時）」になっていること。
- [ ] X軸の終了が「最後の回答時間（時）＋1」になっていること。
- [ ] 1件のみのデータや、同時間帯のみのデータでも正しく描画されること。
- [ ] `WEEKLY_CHANGELOG.md` に変更を記録する。

---
承認いただける場合は、本コメントに "Approve" と返信するか、CLIで承認の旨をお伝えください。