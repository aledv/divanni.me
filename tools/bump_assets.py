#!/usr/bin/env python3
"""Set ?v=<content hash> on the local CSS/JS referenced by index.html.

nginx serves css/js with `Cache-Control: immutable` for 30 days, so a changed file needs a new URL.
Usage: python3 tools/bump_assets.py   (run after editing css/*.css or js/*.js; tests/smoke_test.py checks it)
"""

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = re.compile(r'((?:href|src)="((?:css|js)/[^"?]+\.(?:css|js)))(?:\?v=[0-9a-f]+)?"')


def version(path):
    return hashlib.sha1((ROOT / path).read_bytes()).hexdigest()[:8]


def main():
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    new = REF.sub(lambda m: f'{m.group(1)}?v={version(m.group(2))}"', html)
    if new != html:
        index.write_text(new, encoding="utf-8")
        print("index.html updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
