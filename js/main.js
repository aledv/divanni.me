/**
 * Created by Alessandro Di Vanni on 1/1/2015.
 */
/* global gsap -- loaded from the jsDelivr CDN in index.html before this script */

// Desktop page snap: at the end of the right column the next downward gesture jumps to the Portfolio (one
// viewport-high stage), an upward gesture from its first rows jumps back. Inside the stage the tile rows move
// one row per gesture (the #repo-window scroll position). Normal scrolling elsewhere is untouched.
// Every move is a JS-driven animation (not native smooth scroll, which any wheel/inertia event can cancel),
// wheel events are swallowed while it runs and until trackpad inertia has died out, and a watchdog finishes
// a move if the page or the rows ever rest between two stable positions. ?debug=1 shows a small status box.
try {
    (function() {
        var desktop = window.matchMedia('(min-width: 768px)');
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        var split = document.querySelector('.split');
        var portfolio = document.getElementById('portfolio');
        var win = document.getElementById('repo-window');
        var navUp = document.getElementById('repo-up');
        var navDown = document.getElementById('repo-down');
        var TOL = 4;            // px
        var TAKE = 500;         // px before the end of the column where wheel scrolling is done by us
        var SNAP_MS = 650;      // duration of a snap
        var STEP_MS = 450;      // duration of a one-row move
        var LINK_MS = 950;      // duration of the scroll started by the Portfolio link
        var QUIET = 250;        // ms without wheel events that ends a gesture (trackpad inertia)
        var QUIET_MAX = 4000;   // ms, upper bound of the inertia absorption after a snap
        var animating = false;
        var rafId = 0;
        var quietUntil = 0;
        var quietHard = 0;
        var lastWheel = 0;
        var lastScroll = 0;
        var lastDown = true;    // direction of the last gesture, used to finish an interrupted snap
        var pointerDown = false;
        var lastEvent = '-';
        var lastK = 0;          // row position of the window (0 = rows 1-2)

        if (!split || !portfolio || !win) {
            return;
        }

        function positions() {
            var end = split.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
            var top = portfolio.getBoundingClientRect().top + window.scrollY;
            return { end: end, top: top };
        }

        function startQuiet() {
            var now = Date.now();
            quietUntil = now + QUIET;
            quietHard = now + QUIET_MAX;
        }

        function stopAnimation() {
            cancelAnimationFrame(rafId);
            animating = false;
        }

        // Moves a value from -> to (apply writes it); instant when ms is 0 or with reduced motion.
        // Always ends exactly on `to`.
        function animate(from, to, ms, apply, why) {
            stopAnimation();
            lastEvent = 'go ' + Math.round(to) + ' (' + why + ')';
            if (!ms || reduced.matches || Math.abs(to - from) < 1) {
                apply(to);
                startQuiet();
                return;
            }
            animating = true;
            var t0 = performance.now();
            (function frame(now) {
                var t = Math.min(1, (now - t0) / ms);
                var k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                apply(t < 1 ? from + (to - from) * k : to);
                if (t < 1) {
                    rafId = requestAnimationFrame(frame);
                } else {
                    animating = false;
                    startQuiet();
                }
            }(t0));
        }

        function animateTo(y, ms, why) {
            animate(window.scrollY, y, ms, function(v) {
                window.scrollTo({ top: v, behavior: 'auto' });
            }, why);
        }

        // rows of tiles in the window: one step = distance between two rows; 3 tiles per row, 2 rows visible
        function rowStep() {
            var cards = win.querySelectorAll('.repo-card');
            return cards.length > 3 ? cards[3].offsetTop - cards[0].offsetTop : 0;
        }

        function maxRow() {
            return Math.max(0, Math.ceil(win.querySelectorAll('.repo-card').length / 3) - 2);
        }

        // chevrons: only where there is more in that direction (k = target row)
        function updateNav(k) {
            if (navUp && navDown) {
                navUp.hidden = k <= 0;
                navDown.hidden = k >= maxRow();
            }
        }

        function stepTo(k) {
            var row = Math.max(0, Math.min(maxRow(), k));
            lastK = row;
            updateNav(row);
            animate(win.scrollTop, row * rowStep(), STEP_MS, function(v) {
                win.scrollTop = v;
            }, 'row ' + row);
        }

        // Tolerances and a clamp instead of exact positions: fractional scroll offsets (display scaling),
        // large or line-based wheel deltas and OS smooth scrolling can all skip over the exact end of the column.
        // delta = expected scroll distance in px; 0 for keys. Returns true when the event was handled.
        function handle(down, delta) {
            lastDown = down;
            if (!desktop.matches) {
                return false;
            }
            var p = positions();
            var y = window.scrollY;
            if (y >= p.top - TOL) {
                // on the Portfolio stage: one row per gesture; up from the first rows goes back to the column
                var step = rowStep();
                var k = step ? Math.round(win.scrollTop / step) : 0;
                if (down) {
                    if (k < maxRow()) {
                        stepTo(k + 1);
                    } else {
                        lastEvent = 'last row';
                    }
                } else if (k > 0) {
                    stepTo(k - 1);
                } else {
                    animateTo(p.end, SNAP_MS, 'up');
                }
                return true;
            }
            if (down) {
                if (y >= p.end - TOL) {
                    win.scrollTop = 0;
                    lastK = 0;
                    animateTo(p.top, SNAP_MS, 'down');
                    return true;
                }
                if (delta > 0 && y + delta >= p.end - TOL) {
                    animateTo(p.end, 0, 'clamp');   // stop exactly at the end of the column: the next gesture snaps
                    return true;
                }
            } else if (y > p.end + TOL) {
                animateTo(p.end, SNAP_MS, 'up');    // from between the column and the stage
                return true;
            }
            return false;
        }

        function wheelPixels(e) {
            if (e.deltaMode === 1) {
                return e.deltaY * 40;
            }
            return e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
        }

        window.addEventListener('wheel', function(e) {
            var now = Date.now();
            lastWheel = now;
            if (e.ctrlKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }
            if (desktop.matches && (animating || now < quietUntil)) {
                // a snap is running or trackpad inertia is still arriving: nothing may scroll the page
                quietUntil = animating ? now + QUIET : Math.min(now + QUIET, quietHard);
                e.preventDefault();
                lastEvent = 'swallow';
                return;
            }
            lastEvent = 'wheel ' + Math.round(e.deltaY);
            if (e.deltaY > 0 && desktop.matches) {
                // In the last stretch of the column we scroll ourselves, clamped to the end: native scrolling
                // (compositor, momentum) could overshoot and we would then have to move the page backwards.
                var p = positions();
                var y = window.scrollY;
                if (y >= p.end - TAKE && y < p.end - TOL) {
                    var target = Math.min(p.end, y + wheelPixels(e));
                    window.scrollTo({ top: target, behavior: 'auto' });
                    lastDown = true;
                    if (target >= p.end - 0.5) {
                        startQuiet();   // the rest of this gesture must not run into the snap
                    }
                    e.preventDefault();
                    return;
                }
            }
            if (handle(e.deltaY > 0, wheelPixels(e))) {
                startQuiet();
                e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('scroll', function() {
            lastScroll = Date.now();
        }, { passive: true });

        // Watchdog: whenever the page rests between the end of the column and the Portfolio (anything that
        // interrupted a snap: late wheel, scrollbar drag, restored scroll position...), finish the snap in the
        // direction of the last gesture, so the page always ends on one of the two stable positions.
        window.addEventListener('pointerdown', function() { pointerDown = true; });
        window.addEventListener('pointerup', function() { pointerDown = false; });
        window.addEventListener('pointercancel', function() { pointerDown = false; });
        setInterval(function() {
            var now = Date.now();
            if (!animating && rowStep()) {
                updateNav(Math.round(win.scrollTop / rowStep()));
            }
            if (!desktop.matches || animating || pointerDown || now - lastScroll < 120 || now - lastWheel < 120) {
                return;
            }
            var p = positions();
            var y = window.scrollY;
            if (y > p.end + TOL && y < p.top - TOL) {
                animateTo(lastDown ? p.top : p.end, SNAP_MS, 'watchdog');
            } else if (y >= p.top - TOL && rowStep()) {
                // the rows rest between two positions (e.g. the browser scrolled the window to a focused tile)
                var pos = win.scrollTop / rowStep();
                if (Math.abs(pos - Math.round(pos)) * rowStep() > TOL) {
                    stepTo(lastDown ? Math.ceil(pos) : Math.floor(pos));
                }
            }
        }, 200);

        [navUp, navDown].forEach(function(btn, i) {
            if (btn) {
                btn.addEventListener('click', function() {
                    if (!animating && rowStep()) {
                        lastDown = i === 1;
                        stepTo(Math.round(win.scrollTop / rowStep()) + (i === 1 ? 1 : -1));
                    }
                });
            }
        });

        window.addEventListener('resize', function() {
            win.scrollTop = lastK * rowStep();
        });

        // "Portfolio" link in the first panel: smooth scroll instead of the instant anchor jump
        var link = document.querySelector('.portfolio-link');
        if (link) {
            link.addEventListener('click', function(e) {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
                    return;
                }
                e.preventDefault();
                lastDown = true;
                if (desktop.matches) {
                    if (window.scrollY < positions().top - TOL) {
                        win.scrollTop = 0;
                        lastK = 0;
                    }
                    animateTo(positions().top, LINK_MS, 'link');
                } else {
                    window.scrollTo({ top: portfolio.getBoundingClientRect().top + window.scrollY, behavior: reduced.matches ? 'auto' : 'smooth' });
                }
                if (window.location.hash !== '#portfolio') {
                    history.pushState(null, '', '#portfolio');
                }
            });
        }

        window.addEventListener('keydown', function(e) {
            if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
                return;
            }
            var down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
            var up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
            if (!down && !up) {
                return;
            }
            if (desktop.matches && animating) {
                e.preventDefault();
                return;
            }
            if (handle(down, e.key === 'ArrowDown' || e.key === 'ArrowUp' ? 40 : Math.round(window.innerHeight * 0.875))) {
                e.preventDefault();
            }
        });

        if (/[?&]debug=1\b/.test(window.location.search)) {
            var box = document.createElement('pre');
            box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;margin:0;padding:6px 8px;' +
                'font:11px/1.4 monospace;color:#0f0;background:rgb(0 0 0 / 80%);pointer-events:none';
            document.body.appendChild(box);
            setInterval(function() {
                var p = positions();
                var y = window.scrollY;
                var zone = y > p.end + TOL && y < p.top - TOL ? 'MID' : (Math.abs(y - p.end) <= TOL ? 'end' : (Math.abs(y - p.top) <= TOL ? 'portfolio-top' : (y > p.top ? 'in-portfolio' : 'free')));
                box.textContent = 'scrollY ' + y.toFixed(1) + '\nend    ' + p.end.toFixed(1) + '\ntop    ' + p.top.toFixed(1) +
                    '\nzone   ' + zone + '\nanim   ' + animating + '\nquiet  ' + (Date.now() < quietUntil) +
                    '\ndown   ' + lastDown + '\nrows   ' + (rowStep() ? (win.scrollTop / rowStep()).toFixed(2) : '-') + '/' + maxRow() + '\nlast   ' + lastEvent;
            }, 100);
        }
    }());
} catch {
    // the page works without the snap
}

var isSafari = /constructor/i.test(window.HTMLElement);


if (isSafari) {
    document.getElementsByTagName('html')[0].classList.add('safari');
}

initPortfolio();

if (window.gsap) {
    initBt6();
}


// Button 6
function initBt6() {
    var bt = document.querySelectorAll('#component-10')[0];
    var turbVal = { val: 0.000001 };
    var turb = document.querySelectorAll('#filter-glitch-2 feTurbulence')[0];
    var btTl = gsap.timeline({ paused: true, onUpdate: function() {
        turb.setAttribute('baseFrequency', '0.00001 ' + turbVal.val); // Firefox bug is value is 0
    },
        onStart: function() {
            bt.style.filter = 'url(#filter-glitch-2)';
        },
        onComplete: function() {
            bt.style.filter = 'none';
        }});

    btTl.to(turbVal, { duration: 0.2, val: 0.06 });
    btTl.to(turbVal, { duration: 0.2, val: 0.000001 });

    bt.addEventListener('mouseover', function() {
        btTl.restart();
    });

}

// Portfolio: cards from the static data/repos.json (regenerated by tools/update_portfolio.py)
function initPortfolio() {
    var grid = document.getElementById('repo-grid');

    fetch('data/repos.json')
        .then(function(res) {
            return res.json();
        })
        .then(function(repos) {
            repos.forEach(function(repo) {
                grid.appendChild(repoCard(repo));
            });
        })
        .catch(function() {
            grid.textContent = 'Repositories unavailable, see github.com/aledv';
        });
}

function el(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text) {
        node.textContent = text;
    }
    return node;
}

// Local SVG icons (devicon v2.16.0, MIT; generic.svg is ours): no font or CDN needed
var LANG_IMAGES = {
    'Python': 'python-original',
    'Shell': 'bash-original',
    'JavaScript': 'javascript-original',
    'HTML': 'html5-original',
    'CSS': 'css3-original',
    'Java': 'java-original',
    'PHP': 'php-original',
    'Dockerfile': 'docker-original'
};
// by repo name, wins over the language: GitHub lists oracle-ai-vector-lab as Shell
var REPO_IMAGES = {
    'oracle-ai-vector-lab': 'oracle-original'
};
// wordmarks, not square: drawn wide (the Oracle file has its viewBox cropped to the wordmark)
var WIDE_IMAGES = {
    'oracle-original': true
};
var TOPIC_IMAGES = {
    'kubernetes': 'kubernetes-plain'
};
// Shell has no distinctive logo: for those repos the topic says more
var SHELL_TOPIC_IMAGES = {
    'raspberry-pi': 'raspberrypi-original'
};

function repoIcon(repo) {
    var topics = repo.topics || [];
    var byTopic = repo.language === 'Shell' ? Object.assign({}, TOPIC_IMAGES, SHELL_TOPIC_IMAGES) : TOPIC_IMAGES;
    var topic = topics.filter(function(t) {
        return byTopic[t];
    })[0];
    var name = REPO_IMAGES[repo.name] || (topic ? byTopic[topic] : LANG_IMAGES[repo.language] || 'generic');
    var icon = el('img', 'repo-icon');

    if (WIDE_IMAGES[name]) {
        icon.className += ' repo-icon-wide';
    }
    icon.src = 'img/lang/' + name + '.svg';
    icon.alt = repo.language || 'Repository';
    return icon;
}

// GitHub Octicons (MIT), 16px
var ICON_FORK = 'M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z';
var ICON_EYE = 'M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z';

var ICON_GITHUB = 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

function svgIcon(path) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var shape = document.createElementNS(ns, 'path');

    svg.setAttribute('viewBox', '0 0 16 16');
    shape.setAttribute('d', path);
    svg.appendChild(shape);
    return svg;
}

// badge with an inline SVG icon and a count; nothing when the count is missing (older repos.json)
function repoStat(path, count, noun) {
    var badge = el('span', 'repo-stars repo-stat');
    var svg = svgIcon(path);

    if (typeof count !== 'number') {
        return document.createDocumentFragment();
    }
    svg.setAttribute('aria-hidden', 'true');
    badge.appendChild(svg);
    badge.appendChild(document.createTextNode(String(count)));
    badge.title = count + ' ' + noun + (count === 1 ? '' : 's');
    badge.setAttribute('aria-label', badge.title);
    return badge;
}

function repoCard(repo) {
    var card = el('a', 'repo-card');
    card.href = repo.url;
    card.target = '_blank';
    card.rel = 'noopener';

    var head = el('div', 'repo-head');
    head.appendChild(repoIcon(repo));
    var stats = el('div', 'repo-stats');
    stats.appendChild(el('span', 'repo-stars', '\u2605 ' + repo.stars));
    stats.lastChild.title = repo.stars + (repo.stars === 1 ? ' star' : ' stars');
    stats.lastChild.setAttribute('aria-label', stats.lastChild.title);
    stats.appendChild(repoStat(ICON_FORK, repo.forks, 'fork'));
    stats.appendChild(repoStat(ICON_EYE, repo.watchers, 'watcher'));
    head.appendChild(stats);
    card.appendChild(head);

    card.appendChild(el('h3', 'repo-name', repo.name));
    card.appendChild(el('p', 'repo-desc', repo.description));

    var topics = el('div', 'repo-topics');
    (repo.topics || []).slice(0, 4).forEach(function(topic) {
        topics.appendChild(el('span', 'repo-topic', topic));
    });
    card.appendChild(topics);

    var meta = el('div', 'repo-meta');
    meta.appendChild(el('span', 'repo-lang', repo.language));
    var link = el('span', 'repo-link');
    var mark = svgIcon(ICON_GITHUB);
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', repo.name + ' on GitHub');
    link.title = repo.name + ' on GitHub';
    link.appendChild(mark);
    meta.appendChild(link);
    card.appendChild(meta);
    return card;
}
