#!/usr/bin/env python3
"""Smoke test for the divanni.me static site. Standard library only.

Usage:
    python3 tests/smoke_test.py                          # serve the repo locally and test it
    python3 tests/smoke_test.py --url http://127.0.0.1:8102/   # test a running deployment

Checks:
  - main pages (/, robots.txt, sitemap.xml) return 200
  - every local asset referenced by index.html and by the local CSS (url(...)) returns 200
  - in-page anchors (#id) point to existing ids
  - index.html is well formed (balanced tags, no duplicate ids, doctype, lang, one <title>)
  - sitemap.xml is valid XML and JSON-LD blocks are valid JSON
Exit code 0 if all checks pass, 1 otherwise.
"""

import argparse
import functools
import hashlib
import http.server
import json
import re
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["", "robots.txt", "sitemap.xml"]

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
# Elements whose end tag may be omitted in valid HTML
OPTIONAL_END = {"p", "li", "dt", "dd", "tr", "td", "th", "option", "thead", "tbody", "tfoot"}

failures = []


def fail(msg):
    failures.append(msg)
    print(f"FAIL  {msg}")


def ok(msg):
    print(f"ok    {msg}")


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = {}
        self.refs = []  # (attr, value)
        self.titles = 0
        self.has_doctype = False
        self.html_lang = None
        self.jsonld = []
        self._in_jsonld = False
        self.errors = []

    def handle_decl(self, decl):
        if decl.lower().startswith("doctype html"):
            self.has_doctype = True

    def _attrs(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] = self.ids.get(a["id"], 0) + 1
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append((key, a[key].strip()))
        if tag == "html":
            self.html_lang = a.get("lang")
        if tag == "title":
            self.titles += 1
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in_jsonld = True
            self.jsonld.append("")

    def handle_starttag(self, tag, attrs):
        self._attrs(tag, attrs)
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self._attrs(tag, attrs)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == "script":
            self._in_jsonld = False
        # implicitly close optional-end elements
        while self.stack and self.stack[-1][0] != tag and self.stack[-1][0] in OPTIONAL_END:
            self.stack.pop()
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            opened = (
                f"<{self.stack[-1][0]}> opened at line {self.stack[-1][1]}" if self.stack else "any open tag"
            )
            self.errors.append(f"line {self.getpos()[0]}: </{tag}> does not match {opened}")

    def handle_data(self, data):
        if self._in_jsonld:
            self.jsonld[-1] += data


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # connection errors etc.
        return None, str(e).encode()


def is_local(ref):
    return not re.match(r"^([a-z][a-z0-9+.-]*:|//|#)", ref, re.I)


def css_refs(css_text):
    for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", css_text):
        ref = m.group(1).strip()
        if is_local(ref):
            yield ref


def start_local_server():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", help="base URL of a running site (default: serve the repo locally)")
    args = ap.parse_args()

    server = None
    if args.url:
        base = args.url if args.url.endswith("/") else args.url + "/"
    else:
        server, base = start_local_server()
    print(f"Testing {base}\n")

    # 1. Main pages
    bodies = {}
    for page in PAGES:
        status, body = fetch(base + page)
        bodies[page] = body
        (ok if status == 200 else fail)(f"GET /{page} -> {status}")

    html = bodies[""].decode("utf-8", errors="replace")
    if not html:
        fail("index page is empty, skipping content checks")
        return finish(server)

    # 2. HTML well-formedness
    p = SiteParser()
    p.feed(html)
    p.close()
    for err in p.errors:
        fail(f"HTML: {err}")
    unclosed = [t for t in p.stack if t[0] not in OPTIONAL_END]
    for tag, line in unclosed:
        fail(f"HTML: <{tag}> opened at line {line} is never closed")
    for i, n in p.ids.items():
        if n > 1:
            fail(f"HTML: duplicate id '{i}' ({n} times)")
    if not p.has_doctype:
        fail("HTML: missing <!DOCTYPE html>")
    if not p.html_lang:
        fail("HTML: <html> has no lang attribute")
    if p.titles != 1:
        fail(f"HTML: expected exactly one <title>, found {p.titles}")
    if not p.errors and not unclosed:
        ok("index.html is well formed")

    titles = re.findall(r'class="titleText">([^<]+)</span>', html)
    for section in ("Experience", "Certification", "Courses", "Education", "Contact"):
        (ok if section in titles else fail)(f"section '{section}' present")

    (ok if "portfolio" in p.ids else fail)("section 'Portfolio' present")
    status, body = fetch(base + "data/repos.json")
    try:
        repos = json.loads(body)
        bad = [
            r for r in repos if not all(k in r for k in ("name", "description", "language", "stars", "url"))
        ]
        if status != 200 or not repos or bad:
            fail(f"data/repos.json: status {status}, {len(repos)} repos, {len(bad)} incomplete")
        else:
            ok(f"data/repos.json valid ({len(repos)} repos)")
    except ValueError as e:
        fail(f"data/repos.json is invalid: {e}")

    for block in p.jsonld:
        try:
            json.loads(block)
            ok("JSON-LD block is valid JSON")
        except ValueError as e:
            fail(f"JSON-LD block is invalid: {e}")

    try:
        ET.fromstring(bodies["sitemap.xml"])
        ok("sitemap.xml is valid XML")
    except ET.ParseError as e:
        fail(f"sitemap.xml is invalid XML: {e}")

    # nginx caches css/js as immutable: the ?v= in index.html must match the file content
    # (fix with: python3 tools/bump_assets.py)
    for ref in re.findall(r'(?:href|src)="((?:css|js)/[^"]+\.(?:css|js)\?v=[0-9a-f]+)"', html):
        path, v = ref.split("?v=")
        want = hashlib.sha1((ROOT / path).read_bytes()).hexdigest()[:8]
        (ok if v == want else fail)(
            f"{path} cache-busting version {'ok' if v == want else 'stale: run tools/bump_assets.py'}"
        )

    # 3. Anchors and local assets referenced by index.html
    for _, ref in p.refs:
        if ref.startswith("#") and len(ref) > 1 and ref[1:] not in p.ids:
            fail(f"anchor {ref} has no matching id")

    assets = sorted({urllib.parse.urljoin(base, ref) for _, ref in p.refs if is_local(ref)})
    # 4. Assets referenced from local stylesheets
    for css_url in [a for a in assets if a.split("?")[0].endswith(".css")]:
        status, body = fetch(css_url)
        if status == 200:
            for ref in css_refs(body.decode("utf-8", errors="replace")):
                assets.append(urllib.parse.urljoin(css_url, ref))

    # strip query/fragment; a percent-encoded '?' (%3F) is part of the path, as the
    # browser requests it (fonts/FontAwesome files are literally named "...?v=4.7.0")
    urls = sorted({re.split(r"[?#]", u)[0] for u in assets})
    for url in urls:
        status, _ = fetch(url)
        if status != 200:
            fail(f"asset {url[len(base) - 1 :]} -> {status}")
    ok(f"checked {len(urls)} local assets")

    return finish(server)


def finish(server):
    if server:
        server.shutdown()
    print()
    if failures:
        print(f"{len(failures)} check(s) FAILED")
        return 1
    print("All checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
