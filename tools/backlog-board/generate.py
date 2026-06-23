# -*- coding: utf-8 -*-
"""
SPDAD2026 課題ボード ジェネレータ。
使い方は同ディレクトリの README.md を参照（ルールブック）。

  python generate.py <BACKLOG_API_KEY> --refresh   # Backlogから再取得してHTML生成（完了の再読込もこれ）
  python generate.py                                # cache.json から即時再生成（オフライン・色/分類だけ直した時）

出力: リポジトリ直下の backlog_unresolved_SPDAD2026_20260616.html（公開URLを固定するためファイル名は変えない）
"""
import sys, os, json, html, re, urllib.request, urllib.parse, time, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(HERE, "cache.json")
SUMS = os.path.join(HERE, "summaries.json")
OUTFILE = os.path.join(REPO, "backlog_unresolved_SPDAD2026_20260616.html")  # 公開URL固定のため不変

base = "https://repinc.backlog.com/api/v2/"
BASE = "https://repinc.backlog.com/view/"
pid = 162886  # SPDAD2026
UPDATED = datetime.date.today().isoformat()

argv = sys.argv[1:]
REFRESH = "--refresh" in argv
key = next((a for a in argv if not a.startswith("-")), "")

def get(path, params):
    params = list(params) + [("apiKey", key)]
    url = base + path + "?" + urllib.parse.urlencode(params)
    for a in range(4):
        try:
            return json.load(urllib.request.urlopen(url, timeout=40))
        except Exception:
            if a == 3:
                raise
            time.sleep(1.5)

def fetch_comments(k):
    try:
        cs = get("issues/%s/comments" % k, [("count", 20), ("order", "desc")])
    except Exception:
        return []
    out = []
    for c in cs:
        content = (c.get("content") or "").strip()
        if content:
            out.append({"n": (c.get("createdUser") or {}).get("name", ""),
                        "d": (c.get("created") or "")[:10],
                        "t": content[:600]})
        if len(out) >= 2:
            break
    return out

# ---- load from cache or fetch (全ステータス＝完了含む) ----
if REFRESH or not os.path.exists(CACHE):
    if not key:
        sys.exit("ERROR: 初回または --refresh 時は Backlog APIキーを引数で渡してください。")
    params = [("projectId[]", pid), ("count", 100)]
    allissues = []
    offset = 0
    while True:
        chunk = get("issues", params + [("offset", offset)])
        allissues += chunk
        if len(chunk) < 100:
            break
        offset += 100
    raw = []
    for it in allissues:
        k = it["issueKey"]
        raw.append({"key": k, "summary": it["summary"], "status": it["status"]["name"],
                    "type": (it.get("issueType") or {}).get("name", ""),
                    "cats": [c["name"] for c in it.get("category", [])],
                    "created": (it.get("created") or "")[:10],
                    "updated": (it.get("updated") or "")[:10],
                    "description": it.get("description") or "",
                    "comments": fetch_comments(k)})
    json.dump(raw, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    print("fetched & cached:", len(raw))
else:
    raw = json.load(open(CACHE, encoding="utf-8"))
    print("loaded from cache:", len(raw))

# ---- abstract extraction（要約フォールバック用。正規の要約は summaries.json）----
PRIO = ["概要", "発生", "現状", "目的", "対応", "依頼", "確認", "期待", "実際", "影響", "再現", "完了", "スコープ", "背景", "内容"]
hdr = re.compile(r'^\s*(?:#{1,4}\s+|h[1-4]\.\s*|■\s*)(.+?)\s*$')

def extract(desc):
    if not desc:
        return ""
    lines = desc.replace("\r", "").split("\n")
    secs = []
    title = None
    buf = []
    def push():
        if title is not None or buf:
            secs.append((title, list(buf)))
    for l in lines:
        m = hdr.match(l)
        if m:
            push()
            title = m.group(1).strip()
            buf = []
        else:
            buf.append(l)
    push()
    titled = [(t, b) for (t, b) in secs if t]
    out = []
    if titled:
        for t, b in titled:
            if any(kw in t for kw in PRIO):
                body = " ".join([x.strip() for x in b if x.strip()])
                if body:
                    out.append("【%s】%s" % (t, body[:160]))
            if sum(len(x) for x in out) > 700:
                break
        if not out:
            for t, b in titled[:2]:
                body = " ".join([x.strip() for x in b if x.strip()])
                out.append("【%s】%s" % (t, body[:160]))
    if not out:
        flat = " ".join([x.strip() for x in lines if x.strip()])
        return flat[:320]
    return "\n".join(out)

issues = []
for r in raw:
    desc = r["description"]
    issues.append({"key": r["key"], "summary": r["summary"], "status": r["status"],
                   "type": r["type"], "cats": r["cats"], "created": r["created"], "updated": r["updated"],
                   "abstract": extract(desc), "body": desc[:2000], "body_trunc": len(desc) > 2000,
                   "comments": r["comments"]})

feature_types = {"新機能開発", "仕様メモ", "仕様整理"}
mikaitou = {"未対応", "仕様確認中"}
status_order = ["未対応", "仕様確認中", "処理中", "処理済み",
    "DEV：反映済／REP確認中", "DEV：REP確認済／AB確認待ち", "DEV：AB確認済／STG反映待ち",
    "STG：REP確認済／AB確認待ち", "STG：AB確認済／本番反映待ち", "完了"]

def sidx(s):
    return status_order.index(s) if s in status_order else 99

def keynum(k):
    try:
        return int(k.split("-")[1])
    except Exception:
        return 0

# 中身確認で「実態はバグ/不具合」と判定した課題（種別は仕様メモ/仕様整理だが不具合系へ補正）。
# 追加・削除は README の手順どおりキーを足し引きする。
BUG_OVERRIDE = {
    "SPDAD2026-115", "SPDAD2026-116", "SPDAD2026-117", "SPDAD2026-118", "SPDAD2026-120",
    "SPDAD2026-121", "SPDAD2026-122", "SPDAD2026-123", "SPDAD2026-124", "SPDAD2026-125",
    "SPDAD2026-126", "SPDAD2026-127", "SPDAD2026-128", "SPDAD2026-129", "SPDAD2026-132",
    "SPDAD2026-133", "SPDAD2026-151", "SPDAD2026-152", "SPDAD2026-153", "SPDAD2026-154",
    "SPDAD2026-158",
}
# 環境を手動で確定したい課題（自動判定を上書き）。例: "SPDAD2026-99": "DEV"
ENV_OVERRIDE = {}

def detect_env(d):
    if d["key"] in ENV_OVERRIDE:
        return ENV_OVERRIDE[d["key"]]
    s = d["summary"]; body = d.get("body", ""); st = d["status"]; slow = s.lower()
    # 1. 件名の明示タグを最優先
    if re.search(r'[\[【]\s*production\s*[\]】]', slow):
        return "本番"
    if re.search(r'[\[【]\s*stg\s*[\]】]', slow):
        return "STG"
    if re.search(r'[\[【]\s*dev', slow) or "dev不具合" in slow or "ＤＥＶ" in s:
        return "DEV"
    # 2. ステータスの接頭辞
    if st.startswith("DEV"):
        return "DEV"
    if st.startswith("STG"):
        return "STG"
    # 3. 本文キーワード
    text = s + " " + body; low = text.lower()
    if "production" in low or "本番環境" in text:
        return "本番"
    if "stg" in low:
        return "STG"
    if "dev環境" in low or "【dev" in low:
        return "DEV"
    return "その他"

for d in issues:
    if d["key"] in BUG_OVERRIDE:
        d["cat"] = "不具合系"
        d["override"] = True
    elif d["type"] in feature_types:
        d["cat"] = "新機能系"
        d["override"] = False
    else:
        d["cat"] = "不具合系"
        d["override"] = False
    d["done"] = (d["status"] == "完了")
    d["bucket"] = "未対応" if d["status"] in mikaitou else "対応中"
    d["env"] = detect_env(d) if d["cat"] == "不具合系" else ""

active = [d for d in issues if not d["done"]]
done = [d for d in issues if d["done"]]
feat = [d for d in active if d["cat"] == "新機能系"]
bug = [d for d in active if d["cat"] == "不具合系"]

# ---------- rewritten summaries ----------
sums = {}
if os.path.exists(SUMS):
    sums = json.load(open(SUMS, encoding="utf-8"))
missing_sum = [d["key"] for d in issues if d["key"] not in sums]
if missing_sum:
    print("WARN: 要約未生成 %d件（abstractで代替）: %s" % (len(missing_sum), ", ".join(missing_sum[:10]) + (" …" if len(missing_sum) > 10 else "")))

# ---------- modal data ----------
modal = {}
for d in issues:
    modal[d["key"]] = {"k": d["key"], "sm": d["summary"], "st": d["status"], "ty": d["type"],
                        "c": d["created"], "u": d["updated"], "cat": d["cats"],
                        "ab": sums.get(d["key"]) or d["abstract"], "bd": d["body"] + ("\n…（以下省略）" if d["body_trunc"] else ""),
                        "cm": d["comments"], "url": BASE + d["key"]}

unfiled = [
    {"id": "UNF-1", "label": "スピードレビューが無課金アカウントだと押下できない（プレミアム限定機能のチップ表示あり）", "place": "Dashboard", "cat": "不具合系",
     "note": "<b>コメント照合済</b>: プレミアム制御を議論する <a href='%sSPDAD2026-114' target='_blank'>-114</a>・<a href='%sSPDAD2026-8' target='_blank'>-8</a> のコメントに『詳細分析』ボタン（SPEEDレビュー内サブ機能）がプレミアム＝ポップアップ表示、との仕様記載あり。ただし<b>SPEEDレビュー本体を無課金で押下不可にする</b>挙動は未記載。意図仕様かを確認のうえ起票推奨。" % (BASE, BASE)},
    {"id": "UNF-2", "label": "QRダウンロード押下→画像が別タブ表示（自動ダウンロードされるべき）", "place": "Dashboard", "cat": "不具合系",
     "note": "<b>コメント照合済</b>: 「QR」はコメント上 <a href='%sSPDAD2026-94' target='_blank'>-94</a>（アクション列ボタンの文言/配置整理）にのみ登場し、DL挙動とは別件。自動DL/別タブ表示の課題は無し。名刺画像DL不可系（162/156/164）も別機能。" % BASE},
    {"id": "UNF-3", "label": "公開中のお客様のお声（THK）の導線が残っている", "place": "プレミアム登録画面", "cat": "不具合系",
     "note": "<b>コメント照合済</b>: <a href='%sSPDAD2026-147' target='_blank'>-147</a> のコメントで『導入事例カードをsupport管理データに統一』済だが対象は<b>ログイン前画面</b>。プレミアム登録画面のお客様のお声(THK)導線は別で、<a href='%sSPDAD2026-165' target='_blank'>-165</a>(stgリンク残存)にも含まれない。" % (BASE, BASE)},
    {"id": "UNF-4", "label": "名刺データ保存が名刺データ「アップロード」表記になっている", "place": "回答画面", "cat": "不具合系",
     "note": "<b>コメント照合済</b>: 名刺撮影モーダルの保存/アップロード仕様は <a href='%sSPDAD2026-29' target='_blank'>-29</a> のコメントで議論あり（保存後ボタン非活性化など）。ただし『アップロード表記を保存に直す』という是正指摘は未記載。<a href='%sSPDAD2026-121' target='_blank'>-121</a> は保存失敗バグで別件。" % (BASE, BASE)},
]
for u in unfiled:
    modal[u["id"]] = {"unf": True, "sm": u["label"], "place": u["place"], "note": u["note"]}

# ---------- HTML rendering ----------
def esc(s):
    return html.escape(s, quote=True)

def datatext(d):
    return esc(" ".join([d["key"], d["summary"], d["status"], d["type"]] + d["cats"]).lower())

def rows(items):
    items = sorted(items, key=lambda d: (sidx(d["status"]), -keynum(d["key"])))
    out = []
    envcls = {"本番": " r-prod", "STG": " r-stg", "DEV": " r-dev", "その他": " r-other"}
    envbadge = {"本番": '<span class="env env-prod">本番</span> ',
                "STG": '<span class="env env-stg">STG</span> ',
                "DEV": '<span class="env env-dev">DEV</span> ',
                "その他": '<span class="env env-other">環境不明</span> '}
    for d in items:
        env = d.get("env", "")
        rowcls = envcls.get(env, "")
        prod = envbadge.get(env, "")
        ovr = '<span class="ovr">実態判定</span>' if d.get("override") else ""
        cats = " ".join('<span class="cat-tag">%s</span>' % esc(c) for c in d["cats"])
        out.append(
            '<tr class="issue%s" data-key="%s" data-created="%s" data-updated="%s" data-text="%s">'
            '<td class="k"><span class="keylink">%s</span></td>'
            '<td class="dt">%s</td><td class="dt">%s</td>'
            '<td class="s"><span class="badge">%s</span></td>'
            '<td class="t"><span class="ty">%s</span>%s</td>'
            '<td class="sm">%s%s</td></tr>' % (
                rowcls,
                d["key"], d["created"], d["updated"], datatext(d),
                d["key"], d["created"], d["updated"],
                esc(d["status"]), esc(d["type"]), ovr,
                prod, esc(d["summary"]) + ((" " + cats) if cats else "")))
    return "\n".join(out)

def table(items):
    if not items:
        return '<p class="none">該当なし</p>'
    return ('<table><thead><tr><th>キー</th><th>登録日</th><th>更新日</th><th>ステータス</th><th>種別</th><th>件名</th></tr></thead><tbody>'
            + rows(items) + '</tbody></table>')

def subpanel(spkey, items, active_cls):
    return '<div class="subpanel%s" data-subpanel="%s">%s</div>' % (active_cls, spkey, table(items))

def panel_with_buckets(pkey, items, active_panel, color):
    mk = [d for d in items if d["bucket"] == "未対応"]
    tc = [d for d in items if d["bucket"] == "対応中"]
    h = ['<div class="panel%s" data-panel="%s" style="border-top:3px solid %s">' % (" active" if active_panel else "", pkey, color)]
    h.append('<div class="subbar">')
    h.append('<button class="subtab active" data-sub="mk">未対応 <span class="cnt">%d</span></button>' % len(mk))
    h.append('<button class="subtab" data-sub="tc">対応中 <span class="cnt">%d</span></button>' % len(tc))
    h.append('</div>')
    h.append(subpanel("mk", mk, " active"))
    h.append(subpanel("tc", tc, ""))
    h.append('</div>')
    return "\n".join(h)

def panel_done(items, color):
    df_ = [d for d in items if d["cat"] == "新機能系"]
    db = [d for d in items if d["cat"] == "不具合系"]
    h = ['<div class="panel" data-panel="done" style="border-top:3px solid %s">' % color]
    h.append('<div class="subbar">')
    h.append('<button class="subtab active" data-sub="dfeat">新機能系 <span class="cnt">%d</span></button>' % len(df_))
    h.append('<button class="subtab" data-sub="dbug">不具合系 <span class="cnt">%d</span></button>' % len(db))
    h.append('</div>')
    h.append(subpanel("dfeat", df_, " active"))
    h.append(subpanel("dbug", db, ""))
    h.append('</div>')
    return "\n".join(h)

def panel_unfiled(color):
    h = ['<div class="panel" data-panel="unfiled" style="border-top:3px solid %s">' % color]
    h.append('<p class="legend2">先のチェック依頼6項目のうち、既存課題に見当たらなかったもの（本文＋全コメント照合）。①規約リンクが古い・⑤プレミアム登録の利用規約がsupport配下でない、は起票済み（165/130/131）で「不具合系」タブに含まれる。<br>※未起票項目は日付を持たないため日付フィルタ対象外（キーワード検索は対象）。クリックで詳細表示。</p>')
    h.append('<table><thead><tr><th>箇所</th><th>内容</th></tr></thead><tbody>')
    for u in unfiled:
        dtext = esc((u["place"] + " " + u["label"]).lower())
        h.append('<tr class="issue" data-key="%s" data-nodate="1" data-text="%s"><td class="s"><span class="badge place">%s</span></td><td class="sm"><b>%s</b></td></tr>' % (u["id"], dtext, esc(u["place"]), esc(u["label"])))
    h.append('</tbody></table></div>')
    return "\n".join(h)

def cnt(items, b):
    return len([d for d in items if d["bucket"] == b])

cards = ('<div class="cards">'
    '<div class="card feat"><div class="n">%d</div><div class="l">新機能系</div><div class="sub">未対応 %d / 対応中 %d</div></div>'
    '<div class="card bug"><div class="n">%d</div><div class="l">不具合系</div><div class="sub">未対応 %d / 対応中 %d</div></div>'
    '<div class="card un"><div class="n">%d</div><div class="l">未起票</div><div class="sub">今回チェック分</div></div>'
    '<div class="card done"><div class="n">%d</div><div class="l">完了</div><div class="sub">クローズ済</div></div>'
    '<div class="card tot"><div class="n">%d</div><div class="l">全課題</div><div class="sub">完了含む</div></div>'
    '</div>') % (len(feat), cnt(feat, "未対応"), cnt(feat, "対応中"),
                 len(bug), cnt(bug, "未対応"), cnt(bug, "対応中"),
                 len(unfiled), len(done), len(issues))

toolbar = ('<div class="toolbar">'
    '<div class="tb-row"><input type="search" id="q" placeholder="🔍 キーワード検索（キー / 件名 / 種別 / ステータス / カテゴリ）"></div>'
    '<div class="tb-row">'
    '<label>日付: <select id="datefield"><option value="updated">更新日</option><option value="created">登録日</option></select></label>'
    '<label>From <input type="date" id="from"></label>'
    '<label>To <input type="date" id="to"></label>'
    '<button id="clear" type="button">クリア</button>'
    '<span class="viscount">表示中 <b id="viscount">%d</b> / %d 件（完了除く）</span>'
    '</div></div>') % (len(active), len(active))

tabbar = ('<div class="tabbar">'
    '<button class="tab active" data-tab="feat" style="--c:#2563eb">新機能系 <span class="cnt">%d</span></button>'
    '<button class="tab" data-tab="bug" style="--c:#dc2626">不具合系 <span class="cnt">%d</span></button>'
    '<button class="tab" data-tab="unfiled" style="--c:#7c3aed">未起票 <span class="cnt">%d</span></button>'
    '<button class="tab" data-tab="done" style="--c:#0f766e">完了 <span class="cnt">%d</span></button>'
    '</div>') % (len(feat), len(bug), len(unfiled), len(done))

panels = (panel_with_buckets("feat", feat, True, "#2563eb")
          + panel_with_buckets("bug", bug, False, "#dc2626")
          + panel_unfiled("#7c3aed")
          + panel_done(done, "#0f766e"))

legend = ('<div class="legend">'
    '<b>仕分けルール</b><br>'
    '■ 大分類 — <b>新機能系</b>＝種別「新機能開発／仕様メモ／仕様整理」｜ <b>不具合系</b>＝種別「運用バグ修正／既存品質改善」。'
    'ただし種別が仕様メモ/仕様整理でも<b>中身を確認して実態がバグ/不具合のもの</b>は不具合系へ補正（その行に <span class="ovr">実態判定</span> を付与）。種別バッジはBacklog実値のまま。<br>'
    '■ 進捗 — <b>未対応</b>＝<code>未対応</code>・<code>仕様確認中</code>（着手前）｜ <b>対応中</b>＝それ以外の進行中（<code>処理中</code>／<code>処理済み</code>／<code>DEV:〜</code>／<code>STG:〜</code>）｜ <b>完了</b>＝<code>完了</code><br>'
    '■ 不具合の環境色 — <span class="env env-prod">本番</span> 赤帯＝production｜ <span class="env env-stg">STG</span> アンバー帯＝stg｜ <span class="env env-dev">DEV</span> インディゴ帯＝dev｜ <span class="env env-other">環境不明</span> グレー帯＝タグ/本文から環境を特定できないもの。判定は件名タグ→ステータス→本文の優先順。<b>行クリックで要約モーダル</b>。</div>')

modal_html = ('<div id="overlay" class="overlay"><div class="modalbox" role="dialog">'
    '<button id="mclose" class="mclose">×</button>'
    '<div id="mbody"></div></div></div>')

CSS = r'''
*{box-sizing:border-box}
body{font-family:"Segoe UI","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;margin:0;background:#f4f6f9;color:#1f2937;line-height:1.6}
header{background:linear-gradient(135deg,#0f766e,#0e7490);color:#fff;padding:22px 32px}
header h1{margin:0 0 6px;font-size:22px}
header .meta{font-size:13px;opacity:.9}
.wrap{max-width:1240px;margin:0 auto;padding:16px 32px 90px}
.toolbar{position:sticky;top:0;z-index:60;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin:14px 0 8px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.tb-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:4px 0}
.tb-row label{font-size:13px;color:#475569;display:flex;align-items:center;gap:6px}
#q{flex:1;min-width:260px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
#datefield,#from,#to{padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px}
#clear{padding:7px 14px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;cursor:pointer;font-size:13px}
#clear:hover{background:#eef2f7}
.viscount{margin-left:auto;font-size:13px;color:#475569}
.viscount b{color:#0f766e;font-size:15px}
.legend{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin:12px 0;font-size:13px}
.legend b{color:#0f766e}
.legend code{background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:12px}
.cards{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0 18px}
.card{flex:1;min-width:150px;background:#fff;border-radius:12px;padding:14px 18px;border:1px solid #e5e7eb;border-top:4px solid #94a3b8}
.card .n{font-size:30px;font-weight:700;line-height:1}
.card .l{font-size:14px;font-weight:600;margin-top:4px}
.card .sub{font-size:12px;color:#6b7280;margin-top:4px}
.card.feat{border-top-color:#2563eb}.card.bug{border-top-color:#dc2626}
.card.un{border-top-color:#7c3aed}.card.done{border-top-color:#0f766e}.card.tot{border-top-color:#475569}
.tabbar{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0;padding-bottom:0;border-bottom:3px solid #e2e8f0}
.tab{background:#e9eef3;border:1px solid #d8dee6;border-bottom:none;border-radius:10px 10px 0 0;padding:11px 22px;font-size:14px;font-weight:700;color:#7b8794;cursor:pointer;position:relative;top:3px;transition:background .12s,color .12s,top .12s}
.tab:hover{background:#dde4ec;color:#475569}
.tab .cnt{display:inline-block;min-width:20px;font-size:12px;background:#cfd8e3;color:#475569;border-radius:999px;padding:0 7px;margin-left:5px;font-weight:700}
.tab.active{background:var(--c);color:#fff;border-color:var(--c);top:0;box-shadow:0 -4px 10px rgba(0,0,0,.10)}
.tab.active .cnt{background:rgba(255,255,255,.30);color:#fff}
.panel{display:none;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:18px 22px 24px}
.panel.active{display:block;box-shadow:0 4px 14px rgba(0,0,0,.06)}
.subbar{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 16px}
.subtab{background:#fff;border:1.5px solid #cbd5e1;border-radius:999px;padding:7px 18px;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;transition:.12s}
.subtab:hover{border-color:#94a3b8;background:#f8fafc}
.subtab .cnt{font-size:12px;color:#94a3b8;margin-left:4px;font-weight:700}
.subtab.active{background:#0f172a;border-color:#0f172a;color:#fff;box-shadow:0 2px 6px rgba(15,23,42,.25)}
.subtab.active .cnt{color:#cbd5e1}
.subpanel{display:none}
.subpanel.active{display:block}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{position:sticky;top:var(--toolbarH,96px);z-index:40;box-shadow:0 2px 4px rgba(0,0,0,.07)}
th{text-align:left;background:#eef2f7;color:#475569;font-weight:700;padding:9px 10px;border-bottom:2px solid #d8dee6;font-size:12px}
td{padding:8px 10px;border-bottom:1px solid #eef2f7;vertical-align:top}
tr.issue{cursor:pointer}
tr.issue:hover{background:#eff6ff}
tr.fhide{display:none}
td.k{white-space:nowrap;font-weight:600}
.keylink{color:#0e7490}
tr.issue:hover .keylink{text-decoration:underline}
td.dt{white-space:nowrap;color:#64748b;font-size:12px;font-variant-numeric:tabular-nums}
td.s{white-space:nowrap}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:#eef2f7;color:#475569;white-space:nowrap}
.ty{display:inline-block;font-size:11px;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#64748b;white-space:nowrap}
.env{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;color:#fff;margin-right:4px}
.env-prod{background:#dc2626}
.env-stg{background:#f59e0b}
.env-dev{background:#6366f1}
.env-other{background:#cbd5e1;color:#475569}
.r-prod{background:#fef2f2}
.r-prod:hover{background:#fee2e2}
.r-prod td:first-child{border-left:3px solid #dc2626}
.r-stg{background:#fff7ed}
.r-stg:hover{background:#ffedd5}
.r-stg td:first-child{border-left:3px solid #f59e0b}
.r-dev{background:#eef2ff}
.r-dev:hover{background:#e0e7ff}
.r-dev td:first-child{border-left:3px solid #6366f1}
.r-other{background:#f8fafc}
.r-other:hover{background:#f1f5f9}
.r-other td:first-child{border-left:3px solid #cbd5e1}
.ovr{display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#92400e;margin-left:4px;border:1px solid #fde68a}
.cat-tag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;background:#ecfeff;color:#0e7490;margin-left:4px}
.place{background:#ede9fe;color:#6d28d9}
.none{color:#9ca3af;font-size:13px;padding:10px}
.legend2{font-size:12px;color:#6b7280;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px 14px;margin:0 0 14px}
.overlay{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100;padding:40px 16px;overflow:auto}
.overlay.show{display:block}
.modalbox{max-width:760px;margin:0 auto;background:#fff;border-radius:14px;padding:26px 30px 30px;position:relative;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.mclose{position:absolute;top:12px;right:16px;border:none;background:none;font-size:26px;line-height:1;color:#94a3b8;cursor:pointer}
.mclose:hover{color:#334155}
.m-key{font-size:12px;color:#0e7490;font-weight:700}
.m-title{font-size:18px;font-weight:700;margin:4px 0 12px;padding-right:24px}
.m-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.m-meta span{font-size:12px;background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:999px}
.m-sec{font-size:13px;font-weight:700;color:#0f766e;margin:16px 0 6px;border-left:4px solid #0f766e;padding-left:8px}
.m-abs{font-size:13px;white-space:pre-wrap;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;color:#1f2937}
.m-body{font-size:12.5px;white-space:pre-wrap;color:#334155;max-height:320px;overflow:auto;background:#fff;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin-top:6px}
.m-cmt{font-size:12.5px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-top:8px;white-space:pre-wrap}
.m-cmt .h{font-size:11px;color:#92400e;font-weight:700;margin-bottom:4px}
.m-open{display:inline-block;margin-top:16px;background:#0e7490;color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600}
.m-open:hover{background:#0f766e}
details{margin-top:6px}
summary{cursor:pointer;font-size:12.5px;color:#0e7490}
footer{text-align:center;color:#9ca3af;font-size:12px;padding:20px}
'''

JS = r'''
const q=document.getElementById('q'),df=document.getElementById('datefield'),
fromEl=document.getElementById('from'),toEl=document.getElementById('to'),
viscount=document.getElementById('viscount');
function recount(){
  document.querySelectorAll('.panel').forEach(panel=>{
    let ptotal=0;const sps=panel.querySelectorAll('.subpanel');
    if(sps.length){
      sps.forEach(sp=>{
        const v=sp.querySelectorAll('tr.issue:not(.fhide)').length;ptotal+=v;
        const b=panel.querySelector('.subtab[data-sub="'+sp.dataset.subpanel+'"] .cnt');
        if(b)b.textContent=v;
      });
    } else {
      ptotal=panel.querySelectorAll('tr.issue:not(.fhide)').length;
    }
    const tb=document.querySelector('.tab[data-tab="'+panel.dataset.panel+'"] .cnt');
    if(tb)tb.textContent=ptotal;
  });
}
function applyFilter(){
  const term=q.value.trim().toLowerCase(),field=df.value,f=fromEl.value,t=toEl.value;
  document.querySelectorAll('tr.issue').forEach(tr=>{
    let ok=true;
    if(term && !(tr.dataset.text||'').includes(term)) ok=false;
    if(ok && (f||t) && tr.dataset.nodate!=='1'){
      const d=field==='created'?tr.dataset.created:tr.dataset.updated;
      if(!d) ok=false; else { if(f&&d<f)ok=false; if(t&&d>t)ok=false; }
    }
    tr.classList.toggle('fhide',!ok);
  });
  recount();
  let act=0;
  document.querySelectorAll('.panel[data-panel="feat"] tr.issue:not(.fhide),.panel[data-panel="bug"] tr.issue:not(.fhide)').forEach(()=>act++);
  viscount.textContent=act;
}
q.addEventListener('input',applyFilter);
df.addEventListener('change',applyFilter);
fromEl.addEventListener('change',applyFilter);
toEl.addEventListener('change',applyFilter);
document.getElementById('clear').addEventListener('click',()=>{q.value='';fromEl.value='';toEl.value='';df.value='updated';applyFilter();});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelector('.panel[data-panel="'+b.dataset.tab+'"]').classList.add('active');
}));
document.querySelectorAll('.subbar').forEach(bar=>{
  bar.querySelectorAll('.subtab').forEach(b=>b.addEventListener('click',()=>{
    const panel=bar.closest('.panel');
    panel.querySelectorAll('.subtab').forEach(x=>x.classList.remove('active'));
    panel.querySelectorAll('.subpanel').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    panel.querySelector('.subpanel[data-subpanel="'+b.dataset.sub+'"]').classList.add('active');
  }));
});
const overlay=document.getElementById('overlay'),mbody=document.getElementById('mbody');
function el(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function openModal(key){
  const d=DATA[key];if(!d)return;
  let h='';
  if(d.unf){
    h+='<div class="m-key">未起票（今回チェック分）</div>';
    h+='<div class="m-title">'+el(d.sm)+'</div>';
    h+='<div class="m-meta"><span>箇所: '+el(d.place)+'</span></div>';
    h+='<div class="m-sec">調査メモ</div><div class="m-abs">'+d.note+'</div>';
  } else {
    h+='<div class="m-key">'+el(d.k)+'</div>';
    h+='<div class="m-title">'+el(d.sm)+'</div>';
    h+='<div class="m-meta"><span>'+el(d.st)+'</span><span>'+el(d.ty)+'</span><span>登録 '+el(d.c)+'</span><span>更新 '+el(d.u)+'</span>'+(d.cat&&d.cat.length?'<span>'+el(d.cat.join(' / '))+'</span>':'')+'</div>';
    h+='<div class="m-sec">要約</div><div class="m-abs">'+(d.ab?el(d.ab):'<span style="color:#94a3b8">本文なし</span>')+'</div>';
    if(d.cm&&d.cm.length){
      h+='<div class="m-sec">最新コメント</div>';
      d.cm.forEach(c=>{h+='<div class="m-cmt"><div class="h">'+el(c.n)+' / '+el(c.d)+'</div>'+el(c.t)+'</div>';});
    }
    if(d.bd){h+='<details><summary>本文全文を表示</summary><div class="m-body">'+el(d.bd)+'</div></details>';}
    h+='<a class="m-open" href="'+d.url+'" target="_blank">Backlogで開く ↗</a>';
  }
  mbody.innerHTML=h;
  overlay.classList.add('show');
}
document.querySelectorAll('tr.issue[data-key]').forEach(tr=>{
  tr.addEventListener('click',()=>openModal(tr.dataset.key));
});
document.getElementById('mclose').addEventListener('click',()=>overlay.classList.remove('show'));
overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.classList.remove('show');});
function setToolbarH(){
  const tb=document.querySelector('.toolbar');
  if(tb)document.documentElement.style.setProperty('--toolbarH',(tb.offsetHeight-1)+'px');
}
setToolbarH();
window.addEventListener('resize',setToolbarH);
recount();
'''

DATA_JSON = json.dumps(modal, ensure_ascii=False).replace("</", "<\\/")

HTML = (
'<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
'<meta name="viewport" content="width=device-width,initial-scale=1">'
'<title>SPDAD2026 課題ボード</title><style>' + CSS + '</style></head><body>'
'<header><h1>SPEEDAD 2026 — 課題ボード</h1>'
'<div class="meta">対象: SPDAD2026 ｜ 全' + str(len(issues)) + '課題（完了含む） ｜ 最終更新: ' + UPDATED + ' ｜ 出典: Backlog (repinc.backlog.com) ｜ 未起票判定は本文＋全コメント照合</div></header>'
'<div class="wrap">'
+ toolbar + cards + legend + tabbar + panels +
'</div>'
'<footer>行クリックで要約モーダル。モーダル内「Backlogで開く」で原課題へ。仕分けは Backlog の種別/ステータス＋中身判定です（tools/backlog-board/README.md）。</footer>'
+ modal_html +
'<script>const DATA=' + DATA_JSON + ';</script>'
'<script>' + JS + '</script>'
'</body></html>')

open(OUTFILE, "w", encoding="utf-8").write(HTML)
print("written:", OUTFILE)
print("issues", len(issues), "active", len(active), "done", len(done), "feat", len(feat), "bug", len(bug), "unfiled", len(unfiled))
