/**
 * help/FAQ 事実チェック記入表 共有バックエンド (Google Apps Script Web App)
 *
 * 役割:
 *   事実チェック記入表（docs/help_faq_棚卸し/事実チェック_記入表.html）は、
 *   各レビュアーの「確認後の内容 / 判定 / 判定メモ」を、この GAS 経由で
 *   同一スプレッドシートへ保存・共有する。複数人が同じ判定を見られる。
 *   ※ glossary_gas/Code.gs と同じ仕組み（JSONP取得・ops上書き）。
 *
 * --- セットアップ ---
 * 1. Google スプレッドシートを新規作成（記入表専用。台帳DBとは別でよい）。
 *    URL の /d/【ここ】/edit からスプレッドシートIDを控える。
 * 2. https://script.google.com で新規プロジェクト → この Code.gs を貼り付け。
 * 3. 下の SPREADSHEET_ID を控えたIDに書き換える。
 * 4. デプロイ → 新しいデプロイ → 種類:ウェブアプリ
 *      - 次のユーザーとして実行: 自分
 *      - アクセスできるユーザー: 全員（匿名含む）
 * 5. 発行された /exec URL を控える。
 * 6. 事実チェック_記入表.html の冒頭 `var GAS_WEB_APP_URL = '__GAS_URL__';`
 *    の '__GAS_URL__' を、その URL に差し替える。
 * 7. コード更新時は「デプロイを管理 → 編集 → 新バージョン → デプロイ」（URLは不変）。
 *
 * --- エンドポイント ---
 * GET  /exec?callback=cb   → cb({ ok:true, data:{ "<id>":{adopt,memo,judge,status,editor,updatedAt}, ... } })
 * POST /exec  body(JSON文字列, Content-Type:text/plain):
 *      { ops:[ {id, adopt, memo, judge, status, editor}, ... ] }
 *      → { ok:true, updated, inserted }
 *   adopt=確認後の内容 / memo=判定メモ / judge=判定(○/△/×/要確認) / status=未使用 / editor=記入者
 */

var SPREADSHEET_ID = '1boTDALRBhl1-YZlWo9l8SuXy7NpC7-Q7KAlh8NW2zSU';   // ← 記入表用スプシのID
var SHEET_NAME = 'factcheck_decisions';
var HEADERS = ['ID', '確認後の内容', '判定メモ', '判定', '対応ステータス', '記入者', '更新日時'];
var COL_COUNT = HEADERS.length;

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, COL_COUNT).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOut_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';
  if (callback && !/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback)) callback = '';
  try {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var data = {};
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, COL_COUNT).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var id = String(row[0] == null ? '' : row[0]).trim();
        if (!id) continue;
        var updatedAt = '';
        if (row[6] instanceof Date && !isNaN(row[6].getTime())) updatedAt = row[6].toISOString();
        data[id] = {
          adopt:  row[1] == null ? '' : String(row[1]),
          memo:   row[2] == null ? '' : String(row[2]),
          judge:  row[3] == null ? '' : String(row[3]),
          status: row[4] == null ? '' : String(row[4]),
          editor: row[5] == null ? '' : String(row[5]),
          updatedAt: updatedAt
        };
      }
    }
    return jsonOut_({ ok: true, data: data, fetchedAt: new Date().toISOString() }, callback);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) }, callback);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var gotLock = false;
  try {
    gotLock = lock.tryLock(10000);
    if (!gotLock) return jsonOut_({ ok: false, error: 'busy' });

    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var body = raw ? JSON.parse(raw) : {};
    var ops;
    if (body && body.ops && body.ops.length != null) ops = body.ops;
    else if (body && body.id) ops = [body];
    else ops = [];

    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var idToRow = {};
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var k = String(ids[i][0] == null ? '' : ids[i][0]).trim();
        if (k) idToRow[k] = i + 2;
      }
    }

    var now = new Date(), updated = 0, appended = [];
    for (var j = 0; j < ops.length; j++) {
      var op = ops[j] || {};
      var id = String(op.id == null ? '' : op.id).trim();
      if (!id) continue;
      var adopt  = op.adopt  == null ? '' : String(op.adopt);
      var memo   = op.memo   == null ? '' : String(op.memo);
      var judge  = op.judge  == null ? '' : String(op.judge);
      var status = op.status == null ? '' : String(op.status);
      var editor = op.editor == null ? '' : String(op.editor);
      if (idToRow[id]) {
        sheet.getRange(idToRow[id], 2, 1, 6).setValues([[adopt, memo, judge, status, editor, now]]);
        updated++;
      } else {
        appended.push([id, adopt, memo, judge, status, editor, now]);
      }
    }
    if (appended.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, appended.length, COL_COUNT).setValues(appended);
    }
    return jsonOut_({ ok: true, updated: updated, inserted: appended.length });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    if (gotLock) lock.releaseLock();
  }
}
