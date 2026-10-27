import js from "@eslint/js";
import globals from "globals";

export default [
  // Vendored third-party library: not ours to lint.
  { ignores: ["js/vendor/**"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
];
