/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  // Vendored third-party CSS (Bootstrap, Font Awesome, animate.css): not ours to lint.
  ignoreFiles: ["css/*.min.css", "css/animate.css"],
  rules: {
    // Keep classic `(max-width: …)` media queries: range syntax `(width <= …)` needs Safari 16.4+.
    "media-feature-range-notation": "prefix",
    // Class names are shared with index.html and js/main.js (BEM-ish `button--6`, camelCase `titleText`);
    // renaming them for a naming convention is churn with visual risk and no benefit.
    "selector-class-pattern": null,
    // Legacy hand-written cascade relies on source order; reordering rules to satisfy this
    // would risk visual changes for no functional gain.
    "no-descending-specificity": null,
  },
};
