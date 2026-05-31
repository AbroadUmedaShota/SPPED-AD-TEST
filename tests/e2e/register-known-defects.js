/**
 * 既知の不具合（stg実機観測 BUG-ADM-01〜05）をバグレポートDB（defect_observations）へ登録する。
 *   node tests/e2e/register-known-defects.js
 * GAS_WEB_APP_URL（.env）必須。source_type=AI観測 / verification_status=未検証 で登録し、
 * 人手トリアージ（promoteObservationToCase / linkBacklogIssue）は 09_bug-reporting で行う。
 * appendObservation は追記のため、重複登録を避けて実行は1回のみ。
 */
require('dotenv').config();
const { gasPost } = require('./helpers/gas');

const RUN = 'KNOWN-BUGS-ADMIN-20260531';
const defects = [
  { id: 'BUG-ADM-01', case_id: 'STG-ADM-01', screen: '利用者管理', note: '一覧の一部行(ID48-50)にDB接続エラー文字列(SQLSTATE[HY000][1045])がデータ値として表示' },
  { id: 'BUG-ADM-02', case_id: 'STG-ADM-06-01', screen: '請求書管理', note: 'ページロード時に「エラーが発生しました」アラートが2回発生' },
  { id: 'BUG-ADM-03', case_id: 'STG-ADM-01-04', screen: '利用者管理', note: '一覧の「編集」が新規タブで本番(speed-ad.com)ログインを開く（stg→prodクロス環境）' },
  { id: 'BUG-ADM-04', case_id: 'STG-ADM-PERM-02', screen: '管理者全体', note: '【重大】Lv2がメニュー非表示の全10管理画面に直URL到達（利用者165件/請求79件等）。アクセス制御がサーバ側で未強制' },
  { id: 'BUG-ADM-05', case_id: 'STG-ADM-PERM-01', screen: 'オペレーター実績確認', note: 'Lv1がメニュー非表示の/admin/achievementsに直URL到達（メニューと実アクセスの不一致）' },
];

(async () => {
  if (!process.env.GAS_WEB_APP_URL) {
    console.error('GAS_WEB_APP_URL が未設定です（.env を確認）。');
    process.exit(1);
  }
  for (const d of defects) {
    const res = await gasPost('appendObservation', {
      observation: {
        observation_id: `${d.id}-OBS`,
        case_id: d.case_id,
        source_type: 'AI観測',
        source_role: 'E2E(stg)観測',
        agent_run_id: RUN,
        verification_status: '未検証',
        note: `[${d.id}/${d.screen}] ${d.note}`,
      },
      evidence: [],
    });
    console.log(d.id, JSON.stringify(res).slice(0, 140));
  }
})();
