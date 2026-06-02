#!/usr/bin/env python3
"""Local development HTTP server with path rewriting for the support subdomain.

In production, the ``support`` subdomain is served with ``05_support/`` as the
document root, so HTML files under ``05_support/`` reference assets via
absolute paths such as ``/assets/...`` and ``/common/...``. When the whole
repository is served from its root (e.g. ``python -m http.server``), those
absolute paths resolve to the repository root and return 404.

This wrapper rewrites a small set of top-level paths to their
``/05_support/...`` equivalents so support pages render correctly during local
development.

WARNING: This script is for local development only. Do NOT use it in
production -- production hosting must provide the real subdomain document
root.
"""

from __future__ import annotations

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

DEFAULT_PORT = 8765
BIND_HOST = "127.0.0.1"

# Top-level path prefixes that should be transparently served from
# ``05_support/`` during local development.
REWRITE_PREFIXES = (
    "assets",
    "common",
    "news",
    "help",
    "faq",
    "bug-report",
    "plans",
)


class SupportRewriteHandler(SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler that rewrites support subdomain paths."""

    def translate_path(self, path: str) -> str:
        """Rewrite ``/<prefix>/...`` to ``/05_support/<prefix>/...`` then delegate.

        Query string and fragment are stripped before matching so that paths
        like ``/assets/css/style.css?v=1`` are still detected. Paths that
        already start with ``/05_support/`` are left untouched to avoid double
        rewriting.
        """
        # Strip query/fragment for prefix detection.
        path_only = urlsplit(path).path

        if not path_only.startswith("/05_support/"):
            stripped = path_only.lstrip("/")
            head = stripped.split("/", 1)[0] if stripped else ""
            if head in REWRITE_PREFIXES:
                rewritten = "/05_support/" + stripped
                # Preserve any query/fragment that the base class might
                # otherwise re-parse from the original ``path``.
                path = rewritten

        return super().translate_path(path)


def parse_port(argv: list[str]) -> int:
    """Return the port from argv[1] or :data:`DEFAULT_PORT` when absent."""
    if len(argv) < 2:
        return DEFAULT_PORT
    try:
        return int(argv[1])
    except ValueError:
        print(f"Invalid port '{argv[1]}', falling back to {DEFAULT_PORT}.")
        return DEFAULT_PORT


def main(argv: list[str]) -> None:
    """Start the development server bound to :data:`BIND_HOST`."""
    port = parse_port(argv)
    server = ThreadingHTTPServer((BIND_HOST, port), SupportRewriteHandler)
    print(f"Dev server listening on http://{BIND_HOST}:{port}/")
    print("Rewriting prefixes -> /05_support/: " + ", ".join(REWRITE_PREFIXES))
    print("LOCAL DEVELOPMENT ONLY. Do not use in production.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down dev server.")
        server.server_close()


if __name__ == "__main__":
    main(sys.argv)
