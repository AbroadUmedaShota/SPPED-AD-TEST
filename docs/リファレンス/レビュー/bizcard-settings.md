# Bizcard Settings Screen Review

## 1. データ化スピードプランのDOM ID不整合
- **内容**: `renderDataConversionSpeeds` は `id="dataConversionSpeedSelection"` を持つ要素にスピードプランカードを描画する設計ですが、テンプレートでは `id="workPlanSelection"` が使用されています。そのためレンダラーがDOMを取得できず、スピードプランのカード（単価表示など）が描画されません。
- **根拠**: テンプレート側のID指定とJS側の取得先の不一致。`initBizcardSettings` と `bizcardSettingsRenderer` が `dataConversionSpeedSelection` を参照している一方で、HTMLは `workPlanSelection` を定義しています。【F:02_dashboard/src/bizcardSettings.js†L191-L531】【F:02_dashboard/src/ui/bizcardSettingsRenderer.js†L55-L112】【F:02_dashboard/bizcardSettings.html†L60-L110】
- **影響**: 期待したスピードプランカードが表示されず、単価や付随情報がUIに出ないため利用者が料金を確認できません。さらに、後述の値不整合を誘発し、見積もり計算にも波及しています。
- **提案**: テンプレートのIDを `dataConversionSpeedSelection` に変更するか、JS側の取得IDを `workPlanSelection` に統一してください。加えて、レンダラーが動作した際に `updateFullUI` の `normalPlan` 参照が破綻しないよう、`document.querySelector('input[name="dataConversionSpeed"][value="normal"]')` など値ベースの参照へ更新することを推奨します。

## 2. スピード値の命名不一致による見積もり計算の破綻
- **内容**: テンプレートのラジオボタン値が `value="super-express"` / `value="ondemand"` であるのに対し、見積もり計算が参照する `SPEED_OPTIONS` のキーは `superExpress` / `onDemand` です。`handleFormChange` はラジオの値をそのまま `state.settings.dataConversionSpeed` に格納するため、該当オプションを選択すると `calculateEstimate` が速度設定を解決できず、単価・納期が0のままになります。
- **根拠**: ラジオの値と速度オプションのキーが一致していないこと、`calculateEstimate` が `SPEED_OPTIONS[selectedSpeed]` で解決していることが確認できます。【F:02_dashboard/bizcardSettings.html†L73-L109】【F:02_dashboard/src/bizcardSettings.js†L358-L377】【F:02_dashboard/src/services/bizcardCalculator.js†L15-L52】
- **影響**: 「超特急」「オンデマンド」プランを選んだ場合に見積もり金額が常に¥0、納期が初期値（通常プラン相当）のままとなる重大な計算誤りです。請求見込みが過小表示され、ユーザーや営業判断を誤らせます。
- **提案**: スピードラジオの `value` を `superExpress` / `onDemand` など `SPEED_OPTIONS` と一致する形へ修正してください。上記DOM ID不整合を解消してレンダラー側に委譲すれば、キー整合性も一括管理できます。
