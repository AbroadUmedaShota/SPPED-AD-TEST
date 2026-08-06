#!/usr/bin/env python3
"""admin_architecture.json を _template.html へ埋め込んで admin_architecture.html を作る。

JSON と HTML の内容が食い違わないよう、HTML は必ずこのスクリプトで生成する。
テンプレートを直接編集したら、再度これを実行して HTML を作り直す。

    python docs/architecture/build.py
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
SRC_JSON = HERE / "admin_architecture.json"
SRC_HTML = HERE / "_template.html"
OUT_HTML = HERE / "admin_architecture.html"
MARKER = "/*__ARCH_DATA__*/"


def main() -> None:
    data = json.loads(SRC_JSON.read_text(encoding="utf-8"))
    # JSON をそのまま <script> に置くと </script> や </ で早期終了しうるので退避する
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    template = SRC_HTML.read_text(encoding="utf-8")
    if MARKER not in template:
        raise SystemExit(f"{SRC_HTML.name} に {MARKER} がない")

    OUT_HTML.write_text(template.replace(MARKER, payload), encoding="utf-8")
    print(
        f"{OUT_HTML.name} を生成: "
        f"{len(data['nodes'])} nodes / {len(data['edges'])} edges / {len(data['flows'])} flows / "
        f"{OUT_HTML.stat().st_size:,} bytes"
    )


if __name__ == "__main__":
    main()
