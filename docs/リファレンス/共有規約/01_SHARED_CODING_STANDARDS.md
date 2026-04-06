# Shared Coding Standards

共有リポジトリで開発会社と揃える最低限の実装規約です。社内向けの企画・体制・価格・法務資料は別 private 管理とし、この文書は shared repo で必要なルールに限定します。

## 1. JavaScript ライブラリ

### 1.1. 日付ピッカー (`flatpickr`)

- 日付入力には `flatpickr` を標準ライブラリとして使用します。
- `flatpickr.localize(flatpickr.l10ns.ja);` を必ず実行します。
- `wrap: true` を使用する場合は、親要素に ID を付け、`input` に `data-input`、トリガーに `data-toggle` を付与します。
- 基本の `dateFormat` は `"Y-m-d"` とします。

```html
<div id="startDatePickerWrapper" class="input-group flex-1 relative">
  <input type="text" class="input-field pr-10" placeholder=" " readonly data-input>
  <label class="input-label">開始日</label>
  <button type="button" class="absolute right-3 top-1/2" data-toggle>
    <span class="material-icons text-xl">calendar_today</span>
  </button>
</div>
```

```javascript
flatpickr.localize(flatpickr.l10ns.ja);

const endDatePicker = flatpickr('#endDatePickerWrapper', {
  wrap: true,
  dateFormat: 'Y-m-d',
});

const startDatePicker = flatpickr('#startDatePickerWrapper', {
  wrap: true,
  dateFormat: 'Y-m-d',
  onChange(selectedDates, dateStr) {
    endDatePicker.set('minDate', dateStr);
  },
});
```

### 1.2. 並び替え (`Sortable.js`)

- ドラッグアンドドロップによる順序変更は `Sortable.js` を標準とします。
- 順序変更後は UI と保存データの順序が一致することを確認します。

## 2. HTML 構造

- セマンティック要素 (`header`, `nav`, `main`, `section`, `aside`, `footer`) を優先します。
- 意味のない `div` の多重ネストは避けます。
- コメントは非自明な意図や動的挙動の説明に限定します。

## 3. UI/UX

### 3.1. 検索のデバウンス

- 入力都度実行される検索や絞り込みにはデバウンスを導入します。
- `02_dashboard/src/utils.js` の `debounce` を優先利用します。

```javascript
import { debounce } from './utils.js';

searchInput.addEventListener('input', debounce(searchFunction, 300));
```

### 3.2. 通知

- 保存完了や軽微なエラーは `alert()` ではなくトースト通知を優先します。
- 破壊的操作の確認は共通モーダルを優先し、ブラウザ標準の `confirm()` は極力避けます。

## 4. ドキュメント境界

- shared repo に残すのは画面仕様、実装参照、最低限の運用手順のみです。
- 企画、体制、価格、契約、会議、社内判断は shared repo に持ち込まず private 管理とします。
