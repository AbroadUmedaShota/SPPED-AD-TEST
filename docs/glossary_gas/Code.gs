/**
 * SPEED AD 用語棚卸 共有バックエンド (Google Apps Script Web App)
 *
 * 役割:
 *   フロント側 HTML (glossary 用語棚卸ユーザー側) は従来 localStorage に
 *   採用/メモ/更新者を保存していたが、PC をまたいだ共有ができなかった。
 *   本 GAS をシート連携 API として挟むことで、複数人レビューを同一スプレッド
 *   シート上で同期する。
 *
 * --- セットアップ手順 ---
 *
 * 1. Google スプレッドシートを新規作成し、シート名を `decisions` に変更。
 *    1 行目 (A1〜E1) に次のヘッダーを入力する:
 *      A1: ID
 *      B1: 採用
 *      C1: メモ
 *      D1: 更新者
 *      E1: 更新日時
 *    URL 内 (https://docs.google.com/spreadsheets/d/【ここ】/edit) の
 *    スプレッドシート ID を控える。
 *
 * 2. https://script.google.com を開き、新規プロジェクトを作成。
 *    本ファイル (Code.gs) の内容を全部貼り付ける。
 *
 * 3. 下記 `SPREADSHEET_ID` 定数を、手順 1 で控えた ID に書き換える。
 *
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類: ウェブアプリ
 *      - 次のユーザーとして実行: 自分
 *      - アクセスできるユーザー: 全員 (匿名含む)
 *    でデプロイ。
 *
 * 5. 表示された Web App URL (https://script.google.com/macros/s/.../exec) を控える。
 *
 * 6. フロント HTML 側の `GAS_WEB_APP_URL` 定数に、その URL を貼り付ける。
 *
 * 7. 以降コードを更新したいときは:
 *    「デプロイを管理」→ 該当デプロイの編集 → バージョン: 新しいバージョン → デプロイ。
 *    URL は変わらないので HTML 側の差し替えは不要。
 *
 * --- エンドポイント仕様 ---
 *
 * GET  /exec
 *   レスポンス: {
 *     ok: true,
 *     data: {
 *       "G-0001": { adopt, memo, editor, updatedAt },
 *       "G-0002": { ... },
 *       ...
 *     },
 *     fetchedAt: "<ISO8601>"
 *   }
 *
 * POST /exec
 *   リクエストボディ (JSON 文字列):
 *     { ops: [ { id, adopt, memo, editor }, ... ] }
 *   または単一オブジェクト:
 *     { id, adopt, memo, editor }    // 内部で [body] にラップ
 *
 *   Content-Type は `text/plain` で送信すること。
 *   (application/json だと CORS プリフライト OPTIONS が発生し GAS では受けられない)
 *
 *   レスポンス: { ok: true, updated, inserted }
 *   失敗時:     { ok: false, error: "<message>" }
 *   ロック競合: { ok: false, error: "busy" }
 */

var SPREADSHEET_ID = '1cL4_uoEUbypGB9amgPHrg6FsdwNqTzT4jh4h29_Smbs';
var SHEET_NAME = 'decisions';

/**
 * シートを開く。存在しなければ作成してヘッダーを書き込む。
 */
function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([['ID', '採用', 'メモ', '更新者', '更新日時']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * JSON レスポンス生成ヘルパー。callback パラメタがあれば JSONP で返す。
 * GAS Web App の 302 リダイレクトに CORS ヘッダーが付かない既知の制約を
 * 回避するため、GET は JSONP で受ける運用にしている。
 */
function jsonOut_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET: 全行を ID キーの map で返す。?callback=xxx 付きなら JSONP。
 */
function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';
  // JSONP 関数名のサニタイズ（英数_$.のみ許可）
  if (callback && !/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback)) callback = '';
  try {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var data = {};
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var id = String(row[0] == null ? '' : row[0]).trim();
        if (!id) continue;
        var updatedAtCell = row[4];
        var updatedAt = '';
        // E 列が日付なら ISO 文字列化、それ以外は空文字
        if (updatedAtCell instanceof Date && !isNaN(updatedAtCell.getTime())) {
          updatedAt = updatedAtCell.toISOString();
        }
        data[id] = {
          adopt: row[1],
          memo: row[2] == null ? '' : String(row[2]),
          editor: row[3] == null ? '' : String(row[3]),
          updatedAt: updatedAt
        };
      }
    }
    return jsonOut_({ ok: true, data: data, fetchedAt: new Date().toISOString() }, callback);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) }, callback);
  }
}

/**
 * POST: ops 配列を反映。既存 ID は上書き、未知 ID は末尾に追記。
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var gotLock = false;
  try {
    gotLock = lock.tryLock(10000);
    if (!gotLock) {
      return jsonOut_({ ok: false, error: 'busy' });
    }

    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var body = raw ? JSON.parse(raw) : {};
    var ops;
    if (body && body.ops && body.ops.length != null) {
      ops = body.ops;
    } else if (body && body.id) {
      // 単一オペレーションを 1 要素配列にラップ
      ops = [body];
    } else {
      ops = [];
    }

    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();

    // 既存 ID → 行番号 (1-origin) のマップ
    var idToRow = {};
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var k = String(ids[i][0] == null ? '' : ids[i][0]).trim();
        if (k) idToRow[k] = i + 2;
      }
    }

    var now = new Date();
    var updated = 0;
    var appended = [];

    for (var j = 0; j < ops.length; j++) {
      var op = ops[j] || {};
      var id = String(op.id == null ? '' : op.id).trim();
      if (!id) continue;
      var adopt = op.adopt == null ? '' : op.adopt;
      var memo = op.memo == null ? '' : String(op.memo);
      var editor = op.editor == null ? '' : String(op.editor);

      if (idToRow[id]) {
        sheet.getRange(idToRow[id], 2, 1, 4).setValues([[adopt, memo, editor, now]]);
        updated++;
      } else {
        appended.push([id, adopt, memo, editor, now]);
      }
    }

    // 追記分はまとめて 1 回で書き込み
    if (appended.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, appended.length, 5).setValues(appended);
    }

    return jsonOut_({ ok: true, updated: updated, inserted: appended.length });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    if (gotLock) {
      lock.releaseLock();
    }
  }
}
