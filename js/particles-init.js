/* global tsParticles, loadSlim -- vendored in js/vendor/ (tsParticles slim 4.4.0), loaded before this script */

// Decorative particles behind the Portfolio tiles only. Off for reduced motion and narrow screens;
// animates only while the Portfolio is on screen.
(function () {
    var host = document.getElementById('particles-portfolio');
    var section = document.getElementById('portfolio');
    if (!host || !section || typeof tsParticles === 'undefined' || typeof loadSlim === 'undefined') {
        return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !window.matchMedia('(min-width: 768px)').matches) {
        return;
    }
    var grid = document.getElementById('repo-grid');

    // started once the tiles exist: the section can be taller than the window, the dots follow its area
    function start() {
        var area = section.offsetWidth * section.offsetHeight;
        var count = Math.max(120, Math.min(800, Math.round(area / 4500)));
        var options = {
            fullScreen: { enable: false },
            fpsLimit: 40,
            detectRetina: false,
            background: { color: 'transparent' },
            particles: {
                number: { value: count, density: { enable: false } },
                paint: { color: { value: '#044dd1' }, fill: { enable: true, opacity: 0.8 } },
                size: { value: { min: 2, max: 4 } },
                links: { enable: true, distance: 110, color: '#044dd1', opacity: 0.45, width: 1.2 },
                move: { enable: true, speed: 0.5, outModes: { default: 'bounce' } }
            },
            interactivity: {
                // the canvas ignores the pointer (tiles stay clickable), so listen on the window
                detectsOn: 'window',
                events: { onHover: { enable: true, mode: 'repulse' }, onClick: { enable: false } },
                modes: { repulse: { distance: 100, duration: 0.4, speed: 0.6, factor: 40, maxSpeed: 3 } }
            }
        };
        loadSlim(tsParticles)
            .then(function () {
                return tsParticles.load({ id: 'particles-portfolio', options: options });
            })
            .then(function (container) {
                if (!container || !('IntersectionObserver' in window)) {
                    return;
                }
                new IntersectionObserver(function (entries) {
                    if (entries[0].isIntersecting) {
                        container.play();
                    } else {
                        container.pause();
                    }
                }).observe(section);
            })
            .catch(function () {
                // decorative only: fail silently
            });
    }

    if (!grid || grid.children.length) {
        start();
    } else {
        new MutationObserver(function (changes, observer) {
            observer.disconnect();
            start();
        }).observe(grid, { childList: true });
    }
}());
