# ・アンケート設問_編集画面

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1112446`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-07-23T02:01:23Z`
- created: `2025-07-18T04:22:16Z`

## Original Content

##DB
survey:アンケートデータテーブル
survey_detail：アンケート設問データテーブル

survey_detail構造

| 項目名 | 使用用途 |
| ------------- | ------------- |
| id   | 主キー  |
| survey_id  | アンケートID  |
| question_no | アンケートに対して何番目の設問かの連番  |
| type |アンケート種別(1～13が入る)  |
| text | 	設問文(タイトル)  |
| image_path   |使用していない  |
| required_flag  | 回答必須フラグ（0:任意回答、1:回答必須）  |
| selection_text  | 回答選択肢。typeにより格納方法が変わるので下記参照  |
| answer_max_count   | マルチアンサー用最大選択数  |


サンプルデータ(question_no、required_flagは共通なので省く)
※初期実装時に設問削除・変更あったため、noとtypeの値がズレています。
ズレに関してはQuestionControllerのtype_change関数を参照してください

- no1_フリーアンサー（自由記述）
type：3
text：その他、ご意見・ご要望があれば、ご記入ください

- no2_シングルアンサー（単一選択）
type：1
text：弊社ブースにお立ち寄り頂いた目的をお選びください
selection_text：製品Aの導入を検討,xxx製品Bの導入を検討,xxx製品Cの導入を検討,xxx情報収集,xxxその他

- no3_マルチアンサー（複数選択）
type：2
text：弊社ブースにお立ち寄り頂いた目的をお選びください（複数選択可）
selection_text：製品Aの導入を検討,xxx製品Bの導入を検討,xxx製品Cの導入を検討,xxx情報収集,xxxその他
answer_max_count：5

- no5_マトリックス(sa)
type：7
text：導入のご検討にあたり重要視しているポイントをお知らせください
selection_text：導入のコスト,mt1split:維持管理のコスト,mt1split:導入までのスピード,mt1split:導入による業務効率化,mt1split:他システムとの連携,mt1split:アフターフォロー,非常に重要視している,mt2split:重要視している,mt2split:確認・比較はしている,mt2split:あまり重要としていない

- no6_マトリックス(ma)
type：8
text：弊社からご案内する希望の情報をお選びください（複数選択可）
selection_text：導入のコスト,mt1split:維持管理のコスト,mt1split:導入までのスピード,非常に重要視している,mt2split:重要視している,mt2split:確認・比較はしている

- no7_日付・時間
type：6
text：今日は何月何日ですか？
selection_text：1,1(0は無効。1は有効)

- no8_手書きスペース
type：9
text：スタッフ使用欄
selection_text：300(canvasの高さ)

- no9_数値回答
type：10
text：質問文
selection_text：0,xxxx1,xxxx1,xxxx人(最小,最大,整数・小数点(0:整数、1:小数点),単位)

- no10_ドロップダウンリスト回答
type：11
text：ドロップダウンテスト
selection_text：リスト1,xxxリスト2,xxxリスト3,xxxリスト4,xxx導入予定なし

- no11_説明カード
type：12
text：説明カードのタイトル
selection_text：説明カードの説明文(改行可能)

- no12_尺度/評定尺度
type：13
text：質問文
selection_text：全くそう思わ,xxxx非常にそう思う,xxxx7(左文字,右文字,尺度(3,5,7))

##1. 画面読み込み時の処理（184～937行目）
概要
アンケート編集画面の初期表示時に、アンケート情報・設問情報をAjaxで取得し、各設問の編集UIを動的に生成します。
主な処理内容・コード例
1.1 アンケート情報・設問データの取得
/questionnaire_ajax の処理（QuestionController.php）
必要な情報を成型しview側に値を返す

```
public function questionnaire_ajax(Request $request)
{
    $survey = Survey::where('id', $_POST['survey_id'])->first();
    $survey_detail_html = '';
    $survey_details = Survey_detail::where('survey_id', $_POST['survey_id'])->get();
    $i = 0;
    foreach ($survey_details as $survey_detail) {
        $survey_detail_html .= $survey_detail['question_no'].',:sur'.QuestionController::type_change2($survey_detail['type']).',:sur'.$survey_detail['text'].',:sur'.$survey_detail['answer_max_count'].',:sur'.$survey_detail['selection_text'].',:sur'.$survey_detail['required_flag'].',:brsur';
        $i++;
    }
    // 回答用のフラグ
    $kaiki_flag = 0;
    if (date('Y-m-d') > $survey['survey_finish_date']) {
        $kaiki_flag = 1;
    }
    // 編集用のフラグ
    $kaiki_flag2 = 0;
    if (date('Y-m-d') >= $survey['survey_start_date']) {
        $kaiki_flag2 = 1;
    }
    echo $survey['survey_title'].',::'.$survey['survey_description'].',::'.$survey['capture_card_flag'].',::'.$survey_detail_html.',::'.$i.',::'.$kaiki_flag.',::'.$kaiki_flag2.',::'.$survey['data_plan'].',::'.$survey['data_speed_plan'].',::'.$survey['capture_card_flag'].',::'.$survey['data_flag'].',::'.$survey['survey_start_date'].',::'.$survey['survey_finish_date'].',::'.$survey['survey_memo'].',::'.$survey['survey_name'].',::'.$survey['continuous_solution'];
}
```

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
