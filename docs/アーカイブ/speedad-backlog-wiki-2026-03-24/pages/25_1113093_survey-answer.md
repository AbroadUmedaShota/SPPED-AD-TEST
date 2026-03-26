# ・アンケート設問_回答画面

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1113093`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-07-25T00:32:36Z`
- created: `2025-07-22T07:11:03Z`

## Original Content
##DB
[LINK](https://repinc.backlog.com/wiki/SPDAD/%E3%82%A2%E3%83%B3%E3%82%B1%E3%83%BC%E3%83%88%E8%A8%AD%E5%95%8F_%E7%B7%A8%E9%9B%86%E7%94%BB%E9%9D%A2/edit)
こちら参照。
画面生成処理も基本的には同じ構造になっています。

## 1. 画面読み込み時の処理（389～1315行目）

### 概要

- アンケート情報・設問情報をAjaxで取得し、設問種別ごとにUIを動的生成します。

### 主な処理内容・コード例

#### 1.1 アンケート情報・設問データの取得

```
$.ajax({
    url: '/questionnaire_ajax',
    type: 'POST',
    async: false,
    headers: { 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
    data: {
        'case_flag': '1',
        'survey_id': $("#survey_id").val()
    }
})
.done(function(data) {
    data = data.split(",::");
    // タイトル・説明文を <p> で囲んで表示
    $("#survey_name").html(data[0].split(/\n/).map(line => `<p>${$("<div>").text(line).html()}</p>`).join(""));
    $("#survey_description").html(data[1].split(/\n/).map(line => `<p>${$("<div>").text(line).html()}</p>`).join(""));
    // 設問数に応じてedit-boxを複製・削除
    // 設問タイトル・種別・各種UI値セット
    // ...
});
```

#### 1.2 設問種別ごとのUIセット（抜粋）

- **no1_フリーアンサー**
    - 単一行/複数行切り替え、min/max文字数制限
    - `textarea.bo`または`input[type="text"].bo`を生成
    - 例:
      ```
      if(data3[1]=="no1"){
        // 複数行と単一行の切り替え
        if(data3[3]==1){
            $(this).find('textarea.bo').each(function() {
                var val = $(this).val();
                var $input = $('<input type="text" class="bo" placeholder="回答欄">').val(val);
                $(this).replaceWith($input);
            });
        }
        // 文字数制限
        $(this).find('input[type="text"], textarea').each(function() {
            $(this).attr('minlength', minLength);
            $(this).attr('maxlength', maxLength);
        });
      }
      ```

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
