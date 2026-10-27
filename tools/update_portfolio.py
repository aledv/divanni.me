#!/usr/bin/env python3
"""Regenerate data/repos.json (the Portfolio section) from the GitHub API.

Usage:
    python3 tools/update_portfolio.py

Needs the GitHub CLI (`gh`) logged in. One extra API call per repo: `watchers` is subscribers_count, which
only the repo detail has (watchers_count of the list is just the stars).
Keeps public, non-fork, non-archived repos of USER, minus the EXCLUDE list, sorted by stars (desc) then name.
Descriptions are kept as on GitHub.
The site stays static: it only reads data/repos.json, never the GitHub API.
"""

import json
import subprocess
import sys
from pathlib import Path

USER = "aledv"
EXCLUDE = set()  # repo names to leave out
OUT = Path(__file__).resolve().parent.parent / "data" / "repos.json"


def subscribers(name):
    out = subprocess.run(
        ["gh", "api", f"repos/{USER}/{name}", "--jq", ".subscribers_count"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return int(out.strip() or 0)


def main():
    raw = subprocess.run(
        ["gh", "api", "--paginate", f"users/{USER}/repos?per_page=100&type=owner"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    # --paginate prints one JSON array per page, back to back
    decoder = json.JSONDecoder()
    repos, pos = [], 0
    while pos < len(raw):
        page, pos = decoder.raw_decode(raw, pos)
        repos += page
        while pos < len(raw) and raw[pos].isspace():
            pos += 1

    items = [
        {
            "name": r["name"],
            "description": r["description"] or "",
            "language": r["language"] or "",
            "topics": r.get("topics", []),
            "stars": r["stargazers_count"],
            "forks": r["forks_count"],
            "watchers": subscribers(r["name"]),
            "url": r["html_url"],
        }
        for r in repos
        if not r["fork"] and not r["archived"] and not r["private"] and r["name"] not in EXCLUDE
    ]
    items.sort(key=lambda r: (-r["stars"], r["name"].lower()))
    OUT.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(items)} repos -> {OUT.relative_to(OUT.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
