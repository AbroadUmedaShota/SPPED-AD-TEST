# ・オペレーターの名刺情報入力の可否判定ロジック_入力(名刺情報入力画面ロジック)

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1111547`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-10-30T04:01:49Z`
- created: `2025-07-16T06:33:32Z`

## Original Content
# 名刺情報入力画面(data_input_screen) 処理まとめ

## 概要
data_input_screenは、管理者が名刺情報をグループごとに入力・保存する画面です。
初期表示、入力データ取得、入力内容の保存、スキップ・作業終了などの流れをまとめます。
基本的にはソースコードみながら次項以降を確認してください

### ・関連するテーブル
survey:アンケートデータ
answerテーブル：回答データ
input_business_cards：名刺情報登録テーブル(item_typeにより1項目ずつ登録。オペレーター3人分とOCR含め16×4で最大64件登録)
m_business_card_groups：名刺情報グループ分け（名刺はグループ1、姓名はグループ2など項目ごとにグループ分け。1~8固定

### ・入力の条件
各グループ毎に対象ステータスのアンケートに回答した物の中から、OCR入力のある(input_business_cards.created_by==0)回答情報から
1.自分は入力していない
2.他オペレーターが3回入力していない
3.OCRとオペレーター1~3で入力内容が一致していない
上記条件を満たすもの物をカウント
メールアドレス以外は、メールアドレスが入力一致状態の物のみカウントする
名刺の表示順は名刺データ化予定日(survey.data_complete_date)が近い物から表示する。

### 1. 初期読み込み：data_input_screen
ルート：/admin/data_input_screen?id={グループID}
コントローラ：AdminController::data_input_screen
認証チェック後、グループIDをセッションdata_inputに保存。
ユーザー名・グループIDをビューadmin.data_input_screenへ渡して表示。


### 2. 画面読み込み時の処理：data_input_screen_ajax
概要
JSで画面表示時にAjaxで/admin/data_input_screen_ajaxを呼び出し、入力対象データを取得。
コントローラ：AdminController::data_input_screen_ajax
主な処理：
セッションからグループID取得
メールアドレス入力済み回答IDの取得（グループ1のみ）
入力対象データの抽出（グループ2～6はグループ1が入力済みのもののみ対象）
自分が入力していないものだけ抽出
占有ロックを取得し、他ユーザーと重複入力を防止
名刺画像パスや回答ID、入力済み項目情報を配列で返却

```
入力前に以下で他の人が入力していないか(占有していないか)の確認を行う
if ((new BusinessCardGroupEditLockHas)($answer->answer_id . '_' . $m_business_card_group_id, $user) != 1) {

入力開始前に以下で占有ロックをかける。
// 占有ロック開始
$is = (new BusinessCardGroupEditLock)($answer->answer_id . '_' . $m_business_card_group_id, $user);
```


### 3. 入力時の処理（JS）：saveInputAndIncrementCount
概要
入力フォームで「確定」ボタンを押すと、入力内容をAjaxでサーバーに送信し、保存。
主な処理（script_data_input.js）：
入力内容を一時保存
フォーム内容をシリアライズし、/admin/data_input_createにPOST送信
保存後、次の名刺データを取得・表示
画面の名刺画像や入力欄を更新
経過時間のリセット・再計測

### 4. 入力時の処理（PHP）：data_input_create → input_business_cards_create
AdminController::data_input_create
JSから送信された入力内容を受け取り、DBに保存。
グループ・項目ごとに分岐し、必要な項目のみinput_business_cards_createを呼び出して保存。
入力完了後、占有ロックを解除。
次の入力データを返却（data_input_screen_ajaxを再実行）。

```
public function data_input_create(Request $request)
{
    $user = Adminuser::where('id', Auth::guard('admin')->id())->first();
    switch ($request->m_business_card_group_id) {
        case '1':
            self::input_business_cards_create($request->answer_id, $request->m_business_card_group_id, 'email', $request->email, $request->is_skipped, $request->skip_reason, $request->skipped_reason_detail);
            break;
        case '2':
            if ($request->lastname_disabled == 0) {
                self::input_business_cards_create($request->answer_id, $request->m_business_card_group_id, 'first_name', $request->lastname, $request->is_skipped, $request->skip_reason, $request->skipped_reason_detail);
            }
            if ($request->firstname_disabled == 0) {
                self::input_business_cards_create($request->answer_id, $request->m_business_card_group_id, 'last_name', $request->firstname, $request->is_skipped, $request->skip_reason, $request->skipped_reason_detail);
            }
            break;
        // ...（グループ3～8も同様に分岐）
    }
    // 占有解除
    (new BusinessCardGroupEditLockPull)($request->answer_id . '_' . $request->session()->get('data_input'), $user);
    return self::data_input_screen_ajax($request);
}
```

AdminController::input_business_cards_create
入力内容をInput_business_cardsテーブルに新規レコードとして保存。
スキップ時はsubmitted_dataをnullに。
2件以上同じ内容が入力された場合は一致とみなし、is_input_enabledをfalseにし、input_match_dataを保存。
メールアドレスが一致した場合は、他項目も自動で一致状態にする。
主要項目（グループ1～6）がすべて一致した場合、corrected_dataを更新し、Answerテーブルも更新。
スキップが3回以上の場合はis_escalatedをtrueに。
3回入力された場合は自動で一致状態に。

```
public function input_business_cards_create($answer_id, $business_card_group_id, $item_type, $submitted_data, $is_skipped, $skip_reason, $skipped_reason_detail)
{
    if ($is_skipped == true) {
        $submitted_data = null;
    } elseif (! isset($submitted_data)) {
        $submitted_data = '';
    }
    $input_business_cards = Input_business_cards::create([
        'answer_id' => $answer_id,
        'business_card_group_id' => $business_card_group_id,
        'item_type' => $item_type,
        'submitted_data' => $submitted_data,
        'created_by' => Auth::guard('admin')->id(),
        'updated_by' => Auth::guard('admin')->id(),
        'is_skipped' => $is_skipped,
        'skip_reason' => $skip_reason,
        'skipped_reason_detail' => $skipped_reason_detail,
    ]);
    // ...（一致判定・自動確定・スキップ判定などのロジックが続く）
}
```

登録処理後、data_input_createの最終処理で次の名刺データを取得する。
// 占有解除
    (new BusinessCardGroupEditLockPull)($request->answer_id . '_' . $request->session()->get('data_input'), $user);
    return self::data_input_screen_ajax($request);

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
