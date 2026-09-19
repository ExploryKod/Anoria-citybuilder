// Jest can't parse raw CSS (no CSS transform configured, and doesn't need
// one — no test exercises actual styling). Any `.css` import anywhere in a
// test's module graph (e.g. a UI library pulled in transitively, like
// js-toast-notifier's own stylesheet) resolves to this empty stub instead.
export default {};
