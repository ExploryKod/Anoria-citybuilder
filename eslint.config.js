import noUnsanitized from 'eslint-plugin-no-unsanitized';

/**
 * ESLint here is a security barrier, not a style linter: it has one job, refusing an innerHTML (or insertAdjacentHTML, document.write...) that is given a value that was not
 * escaped. `pnpm lint:security` runs it, and `deploy/deploy.sh` runs it before it builds and publishes (see CLAUDE.md, "What a player types ... is text and never markup").
 *
 * What the rule lets through: a constant string, a template that interpolates nothing, and what goes through the escaping of `src/presentation/dom/shell/safeHtml.js`
 * (the `html` tagged template, `escapeHtml(...)`). Anything else is an error. The way out of an error is the DOM (textContent, createElement, replaceChildren), or `html` for a
 * static layout that carries a few values. A `// eslint-disable-next-line no-unsanitized/property -- reason` is a decision to be read in review, never a habit.
 */
// `raw(...)` is how the code says "this markup is a constant of mine (an icon, a layout)": it is greppable, and a review reads each one.
const escape = { taggedTemplates: ['html'], methods: ['escapeHtml', 'raw'] };

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'public/**', 'tests/**', 'e2e/**', 'server/**', 'scripts/**', 'android/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: ['src/**/*.js', '*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    // The generated files carry directives of another linter's rules: they are not this barrier's business.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      'no-unsanitized/method': ['error', { escape }],
      'no-unsanitized/property': ['error', { escape }],
    },
  },
];
