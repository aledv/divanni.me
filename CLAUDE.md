# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static personal website (divanni.me) — a single-page portfolio/CV (`index.html`). There is no build step and no package manager: this is plain HTML/CSS/JS served as-is by nginx.

## Architecture

- `index.html` — the entire site content (about, experience, certifications, courses, education, contact). Styled with Bootstrap 4 (CDN) + Devicon (CDN) + local `css/style.css` and `css/media.css` (responsive breakpoints) and `css/animate.css`/`css/font-awesome.min.css` (vendored). `js/main.js` drives a small GSAP (TweenMax, CDN) glitch-filter animation on the contact button; jQuery is referenced but commented out/unused in current markup.
- All third-party libraries are loaded from CDNs at runtime; only Bootstrap-era icons/fonts/animate.css are vendored locally under `css/`, `fonts/`, `img/`.
- Fonts: Space Grotesk (headings: `.titleText`, `.textAbout`, `.tagline`, `.repo-name`...; 500/600/700) and Inter (all other text; 400/500/600) are self-hosted as WOFF2 in `fonts/Inter` and `fonts/SpaceGrotesk` (latin subset from @fontsource, SIL OFL licence copied next to them), `@font-face` with `font-display: swap` in `css/style.css`, main weights preloaded in `index.html`; no Google Fonts requests (smoke test checks). The signature keeps SINERGICA (`.signature`, weight 400). The old Helvetica Neue faces are gone.
- Umami analytics is embedded via `<script>` tag in `index.html` pointed at `umami.divanni.me`.
- `robots.txt` and `sitemap.xml` at the repo root support indexing; `index.html` also carries Open Graph/Twitter meta tags and a `Person` JSON-LD block.

## Portfolio

`#portfolio` section after the two-column block (`.split`: left column `position:sticky`, so it scrolls away together with the right one at the end; stacked below 768px). Cards are rendered by `js/main.js` from `data/repos.json`, which is generated, not edited by hand: `python3 tools/update_portfolio.py` (needs `gh`; filters forks/archived/private and the `EXCLUDE` list in the script (now empty), descriptions kept in English; fields `stars`, `forks`, `watchers`: watchers = `subscribers_count`, one extra API call per repo, the list's watchers_count is just the stars; the JS tolerates a repos.json without forks/watchers). Regenerate and commit when repos change (the repo copy is for dev and tests). **In production `data/repos.json` does not come from the image**: the maintainer's private infrastructure repo mounts a data folder on `/usr/share/nginx/html/data` and refreshes it nightly with a script that mirrors `tools/update_portfolio.py` (same fields, same `EXCLUDE`). If the `repos.json` format or the `EXCLUDE` list changes, tell the maintainer so that script is updated too. `tools/` is in `.dockerignore`. On desktop (>=768px) a tsParticles canvas (`#particles-portfolio`, `js/particles-init.js`, slim bundle vendored in `js/vendor/`, MIT licence next to it; ESLint ignores `js/vendor/`) sits behind the tiles; off for reduced motion and on mobile, paused by an IntersectionObserver when the Portfolio is off screen. To upgrade: replace the vendored file and its name in `index.html` and `js/particles-init.js`. Desktop layout (>=768px, `css/media.css`): the header (`.portfolio-head`: avatar, PORTFOLIO, subtitle) is `position: sticky; top: 0` with a white background and a short gradient fade below it, so tiles never show through; the tiles (3 per row, automatic row height: the tallest card sets it, so nothing can overflow; text sizes are `clamp()`s of the viewport height in `css/media.css`, keep them there) scroll natively in the page. The particles canvas covers the whole section. Mobile has no sticky header. Card icons are local SVGs in `img/lang/` (no font/CDN dependency); `REPO_IMAGES` in `js/main.js` overrides the icon by repo name (oracle-ai-vector-lab -> Devicon oracle-original, viewBox cropped to the wordmark, drawn wide via `WIDE_IMAGES`); the smoke test checks that every icon named in `js/main.js` exists. nginx serves css/js as `immutable` for 30 days: after editing `css/*.css` or `js/*.js` run `python3 tools/bump_assets.py` (sets `?v=<hash>` in `index.html`; the smoke test fails if stale).

Fixed social footer (`.portfolio-footer`, LinkedIn/Docker Hub/Telegram/X as colour Simple Icons SVGs `img/icons/brand-*.svg`, no GitHub): shown by an IntersectionObserver in `js/main.js` only while `#portfolio` is on screen; `.portfolio` has `--foot` extra bottom padding so the last row stays clear. Home panel (`.divImg`): flex column with one `--gap` (`clamp(14px, 2.6svh, 28px)`) between avatar, signature, tagline, button, PORTFOLIO link and icons, centred vertically; the em margins on `.signature`, `.tagline`, `.portfolio-link` and the negative top margin of `.img` remove the empty space inside their boxes so the *visible* gaps are equal (measured by ink, ±3px; re-measure if fonts or sizes change). On phones: avatar size is `clamp(.., 100svh - 340px, ..)` and `.header-left` has `min-height: 450px`, so the social icons (white via CSS filter) stay inside the dark panel.

Scrolling: **no automation**, everything is native (wheel, trackpad, keys, scrollbar). `js/main.js` (first block, own try/catch) only smooth-scrolls to `#portfolio` when the "Portfolio" link in the home panel is clicked. No wheel/key listeners, no `preventDefault`, no snap, no `?debug`. Do not reintroduce them (the user asked to remove them). Test: Playwright chromium+webkit at 1280x720, 1440x900, 1920x1080, 390x844: wheel from the home to the end must be monotonic, the header stays at `top: 0` while the tiles scroll, nothing else moves.

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
