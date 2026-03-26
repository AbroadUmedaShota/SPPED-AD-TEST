# ・オペレーターの入室判定（同時入力禁止の排他制御について）

> 注意: これはプロトタイプ期の旧資料です。現行運用の正本ではありません。機微情報を含む可能性があります。

## Metadata
- wikiId: `1111789`
- projectId: `153515`
- source: `SPDAD/Home`
- updated: `2025-07-25T01:41:46Z`
- created: `2025-07-17T02:18:26Z`

## Original Content
##概要
名刺入力・照合などの画面で、同じデータを複数ユーザーが同時編集しないように「編集ロック（占有）」を行う仕組みです。
ロックはキャッシュ（Cache）で管理し、一定時間（200秒）で自動解除されます。

###各処理タイミング一覧表

|    | 名刺情報入力画面 | 名刺情報照合画面 |
|---------------------|------------------|------------------|
| 編集ロック処理      | 名刺情報取得時     | 名刺情報取得時     |
| 編集ロック中かを判定| 名刺情報取得時のロック処理前     | 名刺情報取得時のロック処理前     |
| 編集ロック解除      | 入力,スキップ,終了時     | 照合,エスカレ,終了時     |


###1. 編集ロック処理（占有開始処理）
クラス
App\\UseCases\\BusinessCardGroup\\BusinessCardGroupEditLock

役割
指定キー（例：{answer_id}_{group_id}）で編集ロックを設定する。
既に他ユーザーがロックしている場合は何もしない。
ロックは200秒間有効。

```
public function __invoke($key, Adminuser $adminUser): void
{
    // 既にロックがかかっていれば何もしない
    if((new BusinessCardGroupEditLockHas())($key, $adminUser)) {
        return;
    }
    Cache::put($key, $adminUser->id, self::UNLOCK_SECONDS);
}
```

###2. 編集ロック中かを判定
クラス
App\\UseCases\\BusinessCardGroup\\BusinessCardGroupEditLockHas

役割
指定キーがキャッシュに存在するか確認。
ロックが自分自身なら「ロックされていない」と判定（自分は編集可能）。
他ユーザーがロックしていれば「ロック中」と判定。
```
public function __invoke($key, Adminuser $adminUser): bool
{
    $has = Cache::has($key);

    // 自分がロックしている場合はロックされていないとみなす
    if ($has && filter_var(Cache::get($key), FILTER_VALIDATE_INT) === $adminUser->id) {
        return false;
    }

    return $has;
}
```

###3. 編集ロック解除
クラス
App\\UseCases\\BusinessCardGroup\\BusinessCardGroupEditLockPull

役割
指定キーのロックが自分自身ならキャッシュから削除（ロック解除）。
他ユーザーのロックは解除できない。

```
public function __invoke($key, Adminuser $adminUser)
{
    if (Cache::has($key) && filter_var(Cache::get($key), FILTER_VALIDATE_INT) === $adminUser->id) {
        return Cache::pull($key);
    }
}
```


###使用しているロックキー
入力画面：{answer_id}_{group_id}
照合画面：matching_{answer_id}

###備考
Laravel chacheを利用しているので複数台サーバ構成にする場合は設計の見直しが必要。
※一般に知られているように、名刺画像などもS3の利用に変更などが必要になります。

## Attachments
- 添付なし

## sharedFiles
- sharedFiles なし
