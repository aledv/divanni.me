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
    var count = Math.max(60, Math.min(220, Math.round(window.innerWidth * window.innerHeight / 9000)));
    var options = {
        fullScreen: { enable: false },
        fpsLimit: 40,
        detectRetina: false,
        background: { color: 'transparent' },
        particles: {
            number: { value: count, density: { enable: false } },
            paint: { color: { value: '#044dd1' }, fill: { enable: true, opacity: 0.7 } },
            size: { value: { min: 2, max: 4 } },
            links: { enable: true, distance: 110, color: '#044dd1', opacity: 0.3, width: 1.2 },
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
}());
