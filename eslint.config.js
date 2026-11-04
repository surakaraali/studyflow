// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno (jsr:/npm: imports); they are checked with `deno check`.
    ignores: ['dist/*', '.expo/**', 'supabase/functions/**'],
  },
]);
