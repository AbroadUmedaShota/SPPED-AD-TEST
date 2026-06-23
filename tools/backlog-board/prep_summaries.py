# -*- coding: utf-8 -*-
"""
要約(summaries.json)の生成補助。詳細は README.md「3. 要約の更新」。

  python prep_summaries.py split        # summaries.json に未収録の課題だけを chunk_*.json に分割
  python prep_summaries.py split --all   # 全課題を分割（要約を作り直したい時）
  python prep_summaries.py merge        # sum_*.json を summaries.json にマージ

split 後、各 chunk_K.json を README のプロンプトでサブエージェントに要約させ sum_K.json を出力させる。
最後に merge で summaries.json へ統合 → generate.py で再生成。
"""
import sys, os, json, math, glob

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache.json")
SUMS = os.path.join(HERE, "summaries.json")
CHUNK_SIZE = 24

def load(p, default):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default

mode = sys.argv[1] if len(sys.argv) > 1 else ""

if mode == "split":
    only_new = "--all" not in sys.argv
    raw = load(CACHE, [])
    sums = load(SUMS, {})
    targets = [r for r in raw if (not only_new) or (r["key"] not in sums)]
    if not targets:
        print("対象なし（summaries.json は最新）。--all で全件作り直し可。")
        sys.exit(0)
    recs = []
    for r in targets:
        cm = "\n".join("[%s %s] %s" % (c.get("d", ""), c.get("n", ""), c.get("t", "")) for c in r.get("comments", []))
        recs.append({"key": r["key"], "summary": r["summary"], "status": r["status"], "type": r["type"],
                     "description": r["description"][:2500], "latest_comments": cm[:1200]})
    # 既存 chunk_*/sum_* を掃除
    for f in glob.glob(os.path.join(HERE, "chunk_*.json")) + glob.glob(os.path.join(HERE, "sum_*.json")):
        os.remove(f)
    n = max(1, math.ceil(len(recs) / CHUNK_SIZE))
    per = math.ceil(len(recs) / n)
    for i in range(n):
        ch = recs[i * per:(i + 1) * per]
        if ch:
            json.dump(ch, open(os.path.join(HERE, "chunk_%d.json" % i), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
            print("chunk_%d.json: %d件" % (i, len(ch)))
    print("対象 %d件 / %dチャンク。各 chunk を要約して sum_K.json を出力させ、merge してください。" % (len(recs), n))

elif mode == "merge":
    sums = load(SUMS, {})
    files = sorted(glob.glob(os.path.join(HERE, "sum_*.json")))
    if not files:
        print("sum_*.json が見つかりません。"); sys.exit(1)
    added = 0
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        for k, v in d.items():
            if str(v).strip():
                sums[k] = v; added += 1
    json.dump(sums, open(SUMS, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("merged %d件 → summaries.json（総数 %d）" % (added, len(sums)))
    for f in glob.glob(os.path.join(HERE, "chunk_*.json")) + files:
        os.remove(f)
    print("chunk_*/sum_* を掃除しました。")

else:
    print(__doc__)
