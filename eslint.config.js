// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Design-export reference material (incl. a stale nested app copy) — not source.
    ignores: ["dist/*", "context/Budget app analysis (3)/**"],
  }
]);
