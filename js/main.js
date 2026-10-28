/**
 * Created by Alessandro Di Vanni on 1/1/2015.
 */
/* global gsap -- loaded from the jsDelivr CDN in index.html before this script */

// Scrolling is always native. The only script here: smooth scroll to the Portfolio when the "Portfolio" link in
// the first panel is clicked. Nothing listens to wheel or key events or moves the page by itself.
try {
    (function() {
        var portfolio = document.getElementById('portfolio');
        var link = document.querySelector('.portfolio-link');
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (!portfolio || !link) {
            return;
        }
        link.addEventListener('click', function(e) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
                return;
            }
            e.preventDefault();
            window.scrollTo({ top: portfolio.getBoundingClientRect().top + window.scrollY, behavior: reduced.matches ? 'auto' : 'smooth' });
            if (window.location.hash !== '#portfolio') {
                history.pushState(null, '', '#portfolio');
            }
        });
    }());
} catch {
    // the page works without it
}

// The fixed social footer is shown only while the Portfolio is on screen.
try {
    (function() {
        var portfolio = document.getElementById('portfolio');
        var footer = document.getElementById('portfolio-footer');

        if (!portfolio || !footer || !('IntersectionObserver' in window)) {
            return;
        }
        new IntersectionObserver(function(entries) {
            footer.classList.toggle('is-visible', entries[0].isIntersecting);
            syncMask();
        }, { rootMargin: '0px 0px -50% 0px' }).observe(portfolio);

        // Desktop: when the Portfolio is scrolled to its start, the footer fills the space between the last fully
        // visible row of tiles and the bottom of the window (min 52px, max 160px), icons centred in it.
        var root = document.documentElement;
        var desktop = window.matchMedia('(min-width: 768px)');

        function syncFooterHeight() {
            if (!desktop.matches) {
                root.style.removeProperty('--foot-h');
                return;
            }
            var cards = portfolio.querySelectorAll('.repo-card');
            if (!cards.length) {
                return;
            }
            var viewport = window.innerHeight;
            var start = portfolio.getBoundingClientRect().top + window.scrollY;
            var last = null;
            cards.forEach(function(card) {
                var bottom = card.getBoundingClientRect().bottom + window.scrollY - start;
                if (bottom <= viewport && (last === null || bottom > last)) {
                    last = bottom;
                }
            });
            var height = last === null ? 52 : Math.round(Math.min(160, Math.max(52, viewport - last)));
            if (root.style.getPropertyValue('--foot-h') !== height + 'px') {
                root.style.setProperty('--foot-h', height + 'px');
            }
            syncMask();
        }

        // Header and footer are transparent (the particles show through): the tiles are masked out of the header and
        // footer zones, with a short fade, by a mask on their container. It is in the container's own coordinates, so
        // it is recomputed on every scroll.
        var container = portfolio.querySelector('.container');
        var head = portfolio.querySelector('.portfolio-head');
        var FADE = 14;

        function syncMask() {
            if (!container) {
                return;
            }
            var box = container.getBoundingClientRect();
            var top = desktop.matches && head ? head.getBoundingClientRect().bottom - box.top : 0;
            var bottom = footer.classList.contains('is-visible') ? footer.getBoundingClientRect().top - box.top : box.height;
            var stops = [];
            if (top > 0) {
                stops.push('transparent 0', 'transparent ' + top + 'px', '#000 ' + (top + FADE) + 'px');
            } else {
                stops.push('#000 0');
            }
            if (bottom < box.height) {
                stops.push('#000 ' + bottom + 'px', 'transparent ' + (bottom + FADE) + 'px', 'transparent 100%');
            } else {
                stops.push('#000 100%');
            }
            var value = top > 0 || bottom < box.height ? 'linear-gradient(to bottom, ' + stops.join(', ') + ')' : 'none';
            container.style.webkitMaskImage = value;
            container.style.maskImage = value;
        }

        window.addEventListener('scroll', syncMask, { passive: true });
        window.addEventListener('resize', syncMask);

        syncFooterHeight();
        window.addEventListener('resize', syncFooterHeight);
        window.addEventListener('load', syncFooterHeight);
        if ('ResizeObserver' in window) {
            new ResizeObserver(syncFooterHeight).observe(portfolio);
        }
    }());
} catch {
    // the page works without it
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
