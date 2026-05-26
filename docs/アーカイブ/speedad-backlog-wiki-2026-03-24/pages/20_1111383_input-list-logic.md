# ・オペレーターの名刺情報入力の可否判定ロジック_一覧

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1111383`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-07-25T04:29:05Z`
- created: `2025-07-16T02:42:18Z`

## Original Content
#名刺情報入力一覧画面(data_input_list) 処理まとめ

##概要

data_input_listは、管理画面で名刺入力グループごとの入力件数や表示・非表示制御を行う処理です。
名刺入力グループ（最大8つ）ごとに、入力可能な件数や表示フラグを計算し、ビューに渡します。
基本的にはソースコードみながら次項以降を確認してください

###・関連するテーブル
survey:アンケートデータ
answerテーブル：回答データ
input_business_cards：名刺情報登録テーブル。1つの answer_id に対して、item_type ごとに1件ずつ、OCR＋オペレーター3名分の入力で 最大64件（=16項目×4入力者） 登録される。
m_business_card_groups：名刺情報グループ分け（名刺はグループ1、姓名はグループ2など項目ごとにグループ分け。1~8固定
名刺情報登録テーブルサンプルデータ
[input_business_cards_0723.csv][628957]

###・一覧表示の条件
各グループ毎に対象ステータスのアンケートに回答した物の中から、OCR入力のある(input_business_cards.created_by==0)回答情報から
自分は入力していない AND 他オペレーターが3回入力していない AND (OCRとオペレーター1~3で入力内容が一致していない)
物をカウント
メールアドレス以外は、メールアドレスが入力一致状態の物のみカウントする(下記URLより仕様追加)
 [LINK](https://repinc.backlog.com/view/SPDAD-36) 


###1. ログインユーザー情報の取得
管理者IDからログインユーザー情報（Adminuser）を取得。

```
$user = Adminuser::where('id', Auth::guard('admin')->id())->first();
```

###2. 名刺入力グループの初期化
名刺入力グループ（MBusinessCardGroup）を全件取得。
各グループごとに入力件数配列・表示フラグ配列を初期化。

```
$m_business_card_groups = MBusinessCardGroup::get();
$input_business_array = []; // 件数格納用
$input_business_flag = [];  // 表示フラグ用
foreach ($m_business_card_groups as $m_business_card_group) {
    $input_business_array[$m_business_card_group->id] = 0;
}
```

###3. 対象アンケートの取得
ステータスが「会期中(2)」または「データ化中(3)」のアンケート（Survey）を取得。

```
$surveys = Survey::where('status', 2)->orWhere('status', 3)->get();
```

###グループごとにループ処理開始

###4. メールアドレス入力完了フラグの取得（グループ1専用）
グループ1（メールアドレス）のみ、is_input_enabled = falseの回答IDを取得し、$input_email_flagに格納。
メールアドレスが入力一致で無い物はカウントしないので先に処理

```
// 1（メールアドレス）を入力しないと2以降が入力可能状態にならない
// is_input_enabled = FALSEの物が入力完了状態なのでそちらのIDを取得
if ($m_business_card_group->id == 1) {
    $answers_oks = DB::table('input_business_cards')
        ->leftJoin('answer', 'input_business_cards.answer_id', '=', 'answer.id')
        ->leftJoin('survey', 'answer.survey_id', '=', 'survey.id')
        ->select('answer_id', 'item_type')
        ->where('is_input_enabled', false)
        ->where('created_by', 0)
        ->where('test_flag', 0)
        ->where('business_card_group_id', 1)
        ->whereIn('survey.status', [2, 3])
        ->groupBy('answer_id', 'item_type')
        ->get();
    foreach ($answers_oks as $answers_ok) {
        array_push($input_email_flag, $answers_ok->answer_id);
    }
}
```

###5. 各グループごとの入力件数のカウント
各グループごとに、入力可能な回答IDを抽出し、入力件数をカウント。
グループ2～6は、グループ1が入力完了している回答のみ対象。
自分が入力していないものだけカウント。

```
$answers_count = DB::table('input_business_cards')
    ->leftJoin('answer', 'input_business_cards.answer_id', '=', 'answer.id')
    ->leftJoin('survey', 'answer.survey_id', '=', 'survey.id')
    ->select('answer_id', 'item_type')
    ->where('test_flag', 0)
    ->where('business_card_group_id', $m_business_card_group->id)
    ->whereIn('survey.status', [2, 3])
    ->whereNull('corrected_data')
    ->groupBy('answer_id', 'item_type')
    ->havingRaw('COUNT(answer_id) <= 3')
    ->havingRaw('COUNT(DISTINCT BINARY submitted_data) = COUNT(submitted_data)')
    ->get();
foreach ($answers_count as $answer) {
    if (in_array($answer->answer_id, $input_flag)) {
        // 既にカウント済み
    } elseif (in_array($answer->answer_id, $input_email_flag) && $m_business_card_group->id >= 2) {
        // グループ2～6：メールアドレス入力済みのみ
        $input_business_cards_count = Input_business_cards::where('answer_id', $answer->answer_id)
            ->where('business_card_group_id', $m_business_card_group->id)
            ->where('created_by', Auth::guard('admin')->id())
            ->count();
        if ($input_business_cards_count == 0) {
            $count++;
            array_push($input_flag, $answer->answer_id);
        }
    } elseif ($m_business_card_group->id == 1) {
        // グループ1：自分が入力していないもの
        $input_business_cards_count = Input_business_cards::where('answer_id', $answer->answer_id)
            ->where('business_card_group_id', $m_business_card_group->id)
            ->where('created_by', Auth::guard('admin')->id())
            ->count();
        if ($input_business_cards_count == 0) {
            $count++;
            array_push($input_flag, $answer->answer_id);
        }
    }
}
$input_business_array[$m_business_card_group->id] = $count;
```

※// 既にカウント済みについて。Aさんの名刺データ1件につきitem_type1つにつき最大4種類のデータが存在するため

###6. グループごとの表示・非表示フラグ設定
入力可能件数が0なら非表示（99）、1件以上なら表示（0）。

```
foreach ($m_business_card_groups as $m_business_card_group) {
    if ($input_business_array[$m_business_card_group->id] == 0) {
        $input_business_flag[$m_business_card_group->id] = 99;
    } else {
        $input_business_flag[$m_business_card_group->id] = 0;
    }
}
```

###7. セッションの初期化
セッションdata_inputを空に初期化。後々どのグループを入力中かに利用
DBへの格納やブラウザの戻るボタンなどで戻ったり、URL直接アクセスなどの整合性を保つために利用。
画面読み込みで初期化を行う

###8. ビューへのデータ渡し
件数配列・表示フラグ配列をビューadmin.data_input_listへ渡す。
Blade側で表示フラグが0の場合は該当のグループを表示。99の場合はグレーアウトし、クリック不可にする。

## Attachments
- 未取得 attachment: `input_business_cards_0723.csv` (attachmentId=`628957`, size=`5438`)

## sharedFiles
- sharedFiles なし
