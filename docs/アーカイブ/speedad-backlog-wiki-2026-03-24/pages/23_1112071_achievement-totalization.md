# ・オペレーター実績作成処理（AchievementTotalization）

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1112071`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-07-25T08:01:45Z`
- created: `2025-07-17T07:48:57Z`

## Original Content
##概要
このクラスは「現在の月のオペレーター実績（名刺入力件数・正答数・スキップ数・報酬額）」を集計し、
報酬履歴テーブル（reward_histories）に保存するバッチ処理です。
実績画面のパフォーマンス向上のため、1時間ごとに集計しキャッシュとして利用します。

###その他
1時間に1回、オペレーターごとの名刺入力実績を集計し、報酬履歴テーブルに保存します。
グループ4以外は正答数×単価でカウントします。
グループ4（住所系）は3項目すべて正答の場合のみ正答数・報酬をカウントします。
既存レコードがあれば更新、なければ新規作成します。
ここでのユーザー＝名刺情報入力を行った人になります。
名刺情報入力を行った人の報酬を計算する為のプログラムです。
 [成績結果画面イメージ](https://docs.google.com/spreadsheets/d/1IY_ZI8SMbXjQ7s2aPJPIFx1GRkA3du05/edit?gid=1926242608#gid=1926242608) 

###1. 1. 月次集計の起動
Karnel側からCarbonImmutable::now()を渡し、
コンストラクタで対象年月（CarbonImmutable $currentYearMonth）を受け取る。
※バッチ実行時の月を取得
__invoke()で集計処理を実行


```
public function __construct(private CarbonImmutable $currentYearMonth) {}
public function __invoke() { ... }
```



###2. 集計対象期間の決定
月初・月末の日付を取得し、集計対象期間とする。

```
$startOfMonth = $this->currentYearMonth->startOfMonth()->format('Y-m-d H:i:s');
$endOfMonth = $this->currentYearMonth->endOfMonth()->format('Y-m-d H:i:s');
$yearMonth = $this->currentYearMonth->format('Y-m');
```

###3. ユーザーごとの入力実績集計
input_business_cardsテーブルから、ユーザー・グループ・項目ごとに
入力件数（count）
正答数（correct_count）
スキップ数（skip_count） を集計。

```
$userAchievements = Input_business_cards::select(
    'created_by as user_id',
    'business_card_group_id',
    'item_type',
    DB::raw('count(*) as count'), 
    DB::raw("COUNT(CASE WHEN corrected_data IS NOT NULL AND is_corrected = 1 AND corrected_data != '' THEN 1 END) as correct_count"),
    DB::raw('sum(is_skipped) as skip_count'),
)
    ->where('created_by', '>', 1) // 0:OCR, 1:DBは除外
    ->whereBetween('updated_at', [$startOfMonth, $endOfMonth])
    ->groupBy('created_by', 'business_card_group_id', 'item_type')
    ->get();
```

以下で照合結果がnull AND 空白でもない(値が入力されている)　AND 照合結果が正しい入力情報を抽出

```
corrected_data IS NOT NULL AND is_corrected = 1 AND corrected_data != ''
```


###4. グループ4（住所系）の特別集計
グループ4（郵便番号・住所1・住所2）は「3項目すべて正答」の場合のみ正答数としてカウント。
サブクエリで「同一answer_idで3項目すべて正答」の件数をユーザーごとに集計。

```
$group4 = $this->getGroup4($startOfMonth, $endOfMonth, $userAchievements->pluck('user_id')->unique()->values()->toArray());
```

###5. 報酬レートの取得
報酬レート（compensation_rates）を全件取得し、各項目タイプごとに適用。

###6. 実績データの保存・更新
ユーザー・グループ・項目ごとに
入力件数
正答数（グループ4は特別集計値）
スキップ数
報酬額（正答数×レート、グループ4は3項目正答数×レート） をreward_historiesテーブルに保存（既存レコードがあれば更新、なければ新規作成）。

```
foreach ($userAchievements as $userAchievement) {
    // ...（userId, groupId, itemType, count, correctCount, skipCount, rate取得）
    $rewardHistory = RewardHistory::where('user_id', $userId)
        ->where('year_month', $yearMonth)
        ->where('business_card_group_id', $groupId)
        ->where('item_type', $itemType)
        ->first();
    if ($rewardHistory) {
        // 更新
        $rewardHistory->input_count = $count;
        $rewardHistory->correct_count = ($groupId==4) ? ($group4->get($userId)?->complete_address_count ?? 0) : $correctCount;
        $rewardHistory->skip_count = $skipCount;
        $rewardHistory->business_card_group_id = $groupId;
        $rewardHistory->item_type = $itemType;
        $rewardHistory->reward = $this->getReward($itemType, $correctCount, $rate, $group4->get($userId));
        $rewardHistory->save();
    } else {
        // 新規作成
        $rewardHistory = new RewardHistory();
        $rewardHistory->user_id = $userId;
        $rewardHistory->year_month = $yearMonth;
        $rewardHistory->input_count = $count;
        $rewardHistory->correct_count = ($groupId==4) ? ($group4->get($userId)?->complete_address_count ?? 0) : $correctCount;
        $rewardHistory->skip_count = $skipCount;
        $rewardHistory->business_card_group_id = $groupId;
        $rewardHistory->item_type = $itemType;
        $rewardHistory->reward = $this->getReward($itemType, $correctCount, $rate, $group4->get($userId));
        $rewardHistory->save();
    }
}
```

###7. グループ4の正答数集計ロジック（getGroup4）
郵便番号・住所1・住所2の3項目すべてが正答の場合のみカウント。
サブクエリでcreated_by・answer_idごとに3項目正答を抽出し、ユーザーごとに合計。

```
private function getGroup4($startOfMonth, $endOfMonth, $userIds = [])
{
    $group4Id = ...;
    $completeAddressCount = Input_business_cards::select(
        'created_by as user_id',
        DB::raw('COUNT(*) as complete_address_count')
    )
        ->fromSub(function ($query) use ($startOfMonth, $endOfMonth, $group4Id, $userIds) {
            $query->select('created_by', 'answer_id')
                ->from('input_business_cards')
                ->whereIn('item_type', ['postal_code', 'address1', 'address2'])
                ->where('business_card_group_id', $group4Id)
                ->whereIn('created_by', $userIds)
                ->whereNotNull('corrected_data')
                ->where('is_corrected', 1)
                ->where('is_skipped', 0)
                ->whereBetween('updated_at', [$startOfMonth, $endOfMonth])
                ->groupBy('created_by', 'answer_id')
                ->havingRaw('COUNT(DISTINCT item_type) = 3');
        }, 'complete_addresses')
        ->groupBy('created_by')
        ->get()
        ->keyBy('user_id');
    return $completeAddressCount;
}
```

###8. 報酬額の計算（getReward）
グループ4以外は「正答数×レート」
グループ4は「3項目正答数×レート」

```
private function getReward($itemType, $correctCount, $rate, $group4Status)
{
    $GROUP4 = ['postal_code', 'address1', 'address2'];
    if(!in_array($itemType, $GROUP4)) {
        $reward = $correctCount * $rate;
    } else {
        $reward = ($group4Status != null && $group4Status->complete_address_count >= 1)
            ? $group4Status->complete_address_count * $rate
            : 0;
    }
    return $reward;
}
```

###9.出力ログ
処理開始時：Log::info('Achievement totalization completed for start');
処理終了時：Log::info('Achievement totalization completed for ' . $this->currentYearMonth);

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
