#!/usr/bin/env python3
"""admin_architecture.json の参照が現行コードと合っているか検査する。

コードを直すと evidence の file:line がすぐ古くなる。コミット前にこれを通し、
範囲外の行番号が出たら該当箇所を直してから build.py で HTML を作り直す。

    python docs/architecture/check_refs.py

検査すること:
  1. ノード・エッジ・フローの必須項目と id の整合（未知の node / edge を指していないか）
  2. metadata.statistics の件数が実数と合っているか
  3. evidence などに書かれた file:line が実在ファイルの行数の範囲内か
  4. 到達16画面の共通シェルが揃っているか（script/link の並び・必須要素）
"""
import json
import pathlib
import re
import sys

# 到達16画面（index.html から到達できる範囲）
SCREENS = [
    "index.html", "user-management.html", "user-detail.html",
    "survey-management.html", "survey-detail.html", "billing-management.html",
    "invoice-management.html", "coupon-management.html", "calendar-management.html",
    "operator-management.html", "performance-management.html", "audit-log.html",
    "data-entry/index.html", "data-entry/form.html",
    "reconciliation/index.html", "reconciliation/detail.html",
]
# サイドバーを持たない全画面作業モード
NO_SIDEBAR = {"data-entry/form.html", "reconciliation/detail.html"}

ASSET = re.compile(r'<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"')

ROOT = pathlib.Path(__file__).resolve().parents[2]
JSON_PATH = ROOT / "docs" / "architecture" / "admin_architecture.json"

REQUIRED_NODE = ["id", "name", "type", "description", "responsibilities",
                 "filePaths", "technologies", "inputs", "outputs", "dependencies"]
REQUIRED_EDGE = ["source", "target", "relationship", "protocol", "description"]
REF = re.compile(r"([\w./぀-ヿ一-鿿-]*?[\w-]+\.(?:js|html|py|json|md)):"
                 r"((?:\d+)(?:\s*[-,]\s*\d+)*)")
# file:line のすぐ後ろに付く「（pDlPick）」のような但し書き
NOTE = re.compile(r"^\s*[（(]([^）)]{1,60})[）)]")
# 但し書きから拾う識別子。「inline script なし」のような散文を識別子と誤認しないよう、
# 大文字・ハイフン・ドットのどれかを含む「コードらしい」語だけを対象にする
IDENT = re.compile(r"[A-Za-z_$][\w$.-]{2,}")
CODEISH = re.compile(r"[A-Z]|[-.]")


def collect_strings(obj, out):
    if isinstance(obj, dict):
        for v in obj.values():
            collect_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_strings(v, out)
    elif isinstance(obj, str):
        out.append(obj)


def check_shell(problems: list) -> int:
    """16画面の共通シェルが揃っているか。1枚だけ差し替え漏れ、を検知する。"""
    admin = ROOT / "03_admin"
    signatures = {}
    for rel in SCREENS:
        p = admin / rel
        if not p.is_file():
            problems.append(f"シェル検査: {rel} が無い")
            continue
        html = p.read_text(encoding="utf-8")
        # 相対パスの深さは画面の位置で変わるため正規化してから比べる
        assets = tuple(a.replace("../", "") for a in ASSET.findall(html))
        signatures.setdefault(assets, []).append(rel)

        if 'id="header-placeholder"' not in html:
            problems.append(f"シェル検査: {rel} に #header-placeholder が無い")
        if not re.search(r'<main[^>]*id="main-content"[^>]*data-page-min-lv="\d"', html):
            problems.append(f"シェル検査: {rel} の main に id/data-page-min-lv が揃っていない")

        has_sidebar = 'id="sidebar-placeholder"' in html
        if rel in NO_SIDEBAR and has_sidebar:
            problems.append(f"シェル検査: {rel} は全画面作業モードのはずだが #sidebar-placeholder がある")
        if rel not in NO_SIDEBAR and not has_sidebar:
            problems.append(f"シェル検査: {rel} に #sidebar-placeholder が無い")
        if 'id="footer-placeholder"' in html:
            problems.append(f"シェル検査: {rel} に #footer-placeholder がある（到達16画面はフッターを出さない）")

    if len(signatures) > 1:
        problems.append("シェル検査: script/link の並びが画面ごとに食い違っている")
        for assets, screens in sorted(signatures.items(), key=lambda kv: -len(kv[1])):
            problems.append(f"  [{len(screens)}枚] {', '.join(screens)}")
            problems.append(f"       {' | '.join(assets)}")
    return len(signatures)


def main() -> int:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    problems = []
    shell_groups = check_shell(problems)

    node_ids = {n["id"] for n in data["nodes"]}
    edge_ids = {e["id"] for e in data["edges"] if "id" in e}

    for n in data["nodes"]:
        problems += [f'node {n.get("id")}: 必須項目 {k} がない' for k in REQUIRED_NODE if k not in n]
        problems += [f'node {n["id"]}: 未知の dependency {x}'
                     for x in n.get("dependencies", []) if x not in node_ids]
    for e in data["edges"]:
        problems += [f'edge {e.get("id")}: 必須項目 {k} がない' for k in REQUIRED_EDGE if k not in e]
        problems += [f'edge {e.get("id")}: 未知の {s} {e.get(s)}'
                     for s in ("source", "target") if e.get(s) not in node_ids]
    for f in data["flows"]:
        for s in f.get("steps", []):
            if s.get("node") and s["node"] not in node_ids:
                problems.append(f'flow {f["id"]} step{s.get("order")}: 未知の node {s["node"]}')
            if s.get("edge") and s["edge"] not in edge_ids:
                problems.append(f'flow {f["id"]} step{s.get("order")}: 未知の edge {s["edge"]}')

    stats = data["metadata"]["statistics"]
    for key, actual in [("nodes", len(data["nodes"])), ("edges", len(data["edges"])),
                        ("flows", len(data["flows"]))]:
        if stats.get(key) != actual:
            problems.append(f'metadata.statistics.{key}={stats.get(key)} だが実数は {actual}')

    # file:line 参照
    by_name: dict[str, list[pathlib.Path]] = {}
    for p in ROOT.rglob("*"):
        if p.suffix in (".js", ".html", ".py", ".json", ".md") and p.is_file():
            rel = p.relative_to(ROOT).as_posix()
            if "node_modules" in rel or rel.startswith(".git/"):
                continue
            by_name.setdefault(p.name, []).append(p)

    strings: list[str] = []
    collect_strings(data, strings)
    lines_of: dict[pathlib.Path, list[str]] = {}
    checked = 0
    anchored = 0
    for s in strings:
        for m in REF.finditer(s):
            ref, nums = m.group(1), m.group(2)
            target = ROOT / ref
            if not target.is_file():
                cands = by_name.get(pathlib.Path(ref).name, [])
                if len(cands) != 1:
                    continue          # 同名が複数 or 不明。プロジェクト外の記述として見送る
                target = cands[0]
            if target not in lines_of:
                lines_of[target] = target.read_text(encoding="utf-8").splitlines()
            body = lines_of[target]
            found = [int(n) for n in re.findall(r"\d+", nums)]
            checked += len(found)
            for n in found:
                if n > len(body):
                    problems.append(
                        f'{ref}:{n} は範囲外'
                        f'（{target.relative_to(ROOT).as_posix()} は全 {len(body)} 行）')
            if any(n > len(body) for n in found):
                continue

            # 行番号が範囲内でも、コードが動けば別のものを指すようになる。
            # 「（pDlPick）」のような但し書きがあれば、その識別子が実際にその行にあるか見る
            note = NOTE.match(s[m.end():])
            if not note:
                continue
            idents = [t for t in IDENT.findall(note.group(1)) if CODEISH.search(t)]
            if not idents:
                continue
            lo, hi = min(found), max(found)
            window = "\n".join(body[lo - 1:hi])
            anchored += 1
            if not any(t in window for t in idents):
                where = f'{lo}' if lo == hi else f'{lo}-{hi}'
                problems.append(
                    f'{ref}:{where} に「{note.group(1)}」が見当たらない'
                    f'（行がずれた可能性。実際の中身: {body[lo - 1].strip()[:56]}）')

    print(f"ノード {len(data['nodes'])} / エッジ {len(data['edges'])} / フロー {len(data['flows'])}"
          f" / file:line 参照 {checked} 件（うち中身まで照合 {anchored} 件）"
          f" / 到達16画面のシェル{'一致' if shell_groups == 1 else f'{shell_groups}種'} を検査")
    if problems:
        print("問題:")
        for p in sorted(set(problems)):
            print(f"  {p}")
        return 1
    print("問題なし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
