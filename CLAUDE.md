# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static personal website (divanni.me) — a single-page portfolio/CV (`index.html`). There is no build step and no package manager: this is plain HTML/CSS/JS served as-is by nginx.

## Architecture

- `index.html` — the entire site content (about, experience, certifications, courses, education, contact). Styled with Bootstrap 4 (CDN) + Devicon (CDN) + local `css/style.css` and `css/media.css` (responsive breakpoints) and `css/animate.css`/`css/font-awesome.min.css` (vendored). `js/main.js` drives a small GSAP (TweenMax, CDN) glitch-filter animation on the contact button; jQuery is referenced but commented out/unused in current markup.
- All third-party libraries are loaded from CDNs at runtime; only Bootstrap-era icons/fonts/animate.css are vendored locally under `css/`, `fonts/`, `img/`.
- Umami analytics is embedded via `<script>` tag in `index.html` pointed at `umami.divanni.me`.
- `robots.txt` and `sitemap.xml` at the repo root support indexing; `index.html` also carries Open Graph/Twitter meta tags and a `Person` JSON-LD block.

## Portfolio

`#portfolio` section after the two-column block (`.split`: left column `position:sticky`, so it scrolls away together with the right one at the end; stacked below 768px). Cards are rendered by `js/main.js` from `data/repos.json`, which is generated, not edited by hand: `python3 tools/update_portfolio.py` (needs `gh`; filters forks/archived/private and the `EXCLUDE` list in the script (now empty), descriptions kept in English; fields `stars`, `forks`, `watchers`: watchers = `subscribers_count`, one extra API call per repo, the list's watchers_count is just the stars; the JS tolerates a repos.json without forks/watchers). Regenerate and commit when repos change (the repo copy is for dev and tests). **In production `data/repos.json` does not come from the image**: the maintainer's private infrastructure repo mounts a data folder on `/usr/share/nginx/html/data` and refreshes it nightly with a script that mirrors `tools/update_portfolio.py` (same fields, same `EXCLUDE`). If the `repos.json` format or the `EXCLUDE` list changes, tell the maintainer so that script is updated too. `tools/` is in `.dockerignore`. On desktop (>=768px) a tsParticles canvas (`#particles-portfolio`, `js/particles-init.js`, slim bundle vendored in `js/vendor/`, MIT licence next to it; ESLint ignores `js/vendor/`) sits behind the tiles; off for reduced motion and on mobile, paused by an IntersectionObserver when the Portfolio is off screen. To upgrade: replace the vendored file and its name in `index.html` and `js/particles-init.js`. Desktop layout (>=768px, `css/media.css`): 3 columns, the first screen is exactly one viewport (heading + 3x2 tiles at full size, all rows have the same height computed from `--vh`, `--pad`, `--head`, `--gap`); with more than 6 repos the section grows and the rest is reached by normal scrolling. The particles canvas covers the whole section. Card icons are local SVGs in `img/lang/` (no font/CDN dependency); `REPO_IMAGES` in `js/main.js` overrides the icon by repo name (oracle-ai-vector-lab -> Devicon oracle-original, viewBox cropped to the wordmark, drawn wide via `WIDE_IMAGES`); the smoke test checks that every icon named in `js/main.js` exists. nginx serves css/js as `immutable` for 30 days: after editing `css/*.css` or `js/*.js` run `python3 tools/bump_assets.py` (sets `?v=<hash>` in `index.html`; the smoke test fails if stale).

Page snap (desktop >=768px, `js/main.js`, first block, in its own try/catch): at the end of the right column the next downward gesture animates (rAF, not native smooth scroll) to the top of the Portfolio; inside the Portfolio scrolling is normal, and an upward gesture goes back to the column only when the Portfolio is exactly at its top (upward wheels are clamped to that top first, like the column end). Wheels are scrolled by the script in the last 500px before the column end (clamped, never overshoots, never moves backwards), swallowed during the animation and while trackpad inertia arrives, and a watchdog finishes any rest position between the column end and the Portfolio top (never inside the Portfolio). The "Portfolio" link uses the same animation. `?debug=1` shows a status box. Only synthetic wheels were tested (Playwright chromium+webkit); real macOS inertia needs a manual check after changes.

## Deployment

The site is served by nginx inside a Docker container — the repo root is copied to `/usr/share/nginx/html` (see `Dockerfile`), excluding non-site files listed in `.dockerignore`.

- CI (`.github/workflows/image.yml`): every push to `main` runs `./lint.sh`, then `python3 tests/smoke_test.py`; if both pass, it builds a multi-arch image (`linux/arm64`, `linux/amd64`) and pushes `ghcr.io/aledv/divanni-me:<short sha>` and `:latest`. The nginx base in the `Dockerfile` is pinned by digest.
- Production runs that image pinned by `tag@digest`; the deployment itself (host, proxy, data folder) lives in the maintainer's private infrastructure repo and is **not** done from this repo or by project sessions.
- The repo's `docker-compose.yml` is for local tests only (`./build.sh --force && docker compose up -d`, then `http://127.0.0.1:8102/`, `docker compose down` when done).

Flow for project sessions: work on `main`; run `./lint.sh` and `python3 tests/smoke_test.py` locally; push and wait for the `test-and-image` Action to go green (`gh run watch`). If it fails, nothing is published. Then report the commit and the image tag (`ghcr.io/aledv/divanni-me:<short sha>`) to the router session, which deploys it and runs `python3 tests/smoke_test.py --url https://divanni.me/`.

This is a **public repository**: never commit hostnames, IP addresses, paths or other details of the maintainer's infrastructure, secrets, or personal data that is not already on the published page. Commit as `aledv <882334+aledv@users.noreply.github.com>`.

## Local development

There is no dev server or build tooling in this repo. To preview changes, open `index.html` directly in a browser, or serve the directory with any static file server (e.g. `python3 -m http.server`) and edit HTML/CSS/JS in place — refresh to see changes.

## Testing

```bash
python3 tests/smoke_test.py                                # serve the repo locally and check it
python3 tests/smoke_test.py --url https://divanni.me/      # check the public site (or http://127.0.0.1:8102/ for a local compose test)
```

Standard library only. Checks main pages return 200, every local asset referenced by `index.html` and the local CSS exists, `#anchors` resolve, the HTML is well formed, and `sitemap.xml`/JSON-LD are valid. Exit code 0 = pass. CI runs it on every push; run it locally before pushing and against https://divanni.me/ after deploying. Note: `fonts/FontAwesome/` files are literally named `...?v=4.7.0` (requested via `%3F` in the CSS); don't rename them.

## Linting

```bash
npm ci        # once: htmlhint, stylelint, ESLint (pinned in package-lock.json)
./lint.sh     # all linters; non-zero exit if any fails
```

Also needs `uv` (runs `ruff` and `yamllint` via `uvx`, versions pinned in `lint.sh`) and Docker (`hadolint`, `shellcheck` images, pinned in `lint.sh`). CI runs it first and it is blocking: lint fails → no tests, no image, no deploy.

- HTML `index.html` → htmlhint (defaults). CSS `css/style.css`, `css/media.css` → stylelint (`stylelint.config.mjs`). JS `js/` → ESLint (`eslint.config.mjs`; `gsap` is a CDN global declared in `js/main.js`). Python `tests/` → ruff check + format (`ruff.toml`). YAML → yamllint `--strict` (`.yamllint.yml`). `Dockerfile` → hadolint. `build.sh`, `lint.sh` → ShellCheck.
- Vendored CSS (`css/*.min.css`, `css/animate.css`) is excluded. Disabled rules are justified inline in the configs: stylelint `selector-class-pattern` and `no-descending-specificity` off, `media-feature-range-notation: prefix` (keep `(max-width: …)` for Safari < 16.4); yamllint `truthy` keys and `document-start`.
- Fix findings in the code rather than disabling rules; a new exclusion needs a reason next to it. CSS/HTML lint fixes must stay rendering-neutral.
- Layout of the logo/date/title entries: each is a `.entry` CSS grid (logo + date on row 1, text on a new row), no floats or `<br>` spacing. Check layout changes in WebKit too (Playwright `webkit`, device "iPhone 13"): Safari iOS differs from Chromium at 390px.
- Tooling files (`node_modules`, `package*.json`, `lint.sh`, linter configs) are in `.dockerignore`; keep new ones out of the image too.
