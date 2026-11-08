/**
 * The rare place where markup must be a string (a template with a lot of static structure and a few values): values are escaped by default, markup has to be asked for.
 * Prefer the DOM (createElement, textContent, replaceChildren) whenever a value is a name or a text somebody typed; this is for static layouts that carry a few figures or labels.
 *
 *   element.innerHTML = html`<li data-name="${name}">${name}</li>`;   // `name` is escaped, in the text and in the attribute
 *   element.innerHTML = html`<ul>${items.map((item) => html`<li>${item}</li>`)}</ul>`;   // a nested html`` is markup already: it is not escaped twice
 *   html`<span>${raw(TRASH_ICON)}</span>`;   // raw(): markup that is a constant of the code, never a value that came from outside
 */

/** The beginnings of the markup-looking values already said, so the console tells each once. */
const warnedMarkup = new Set();

const ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' });

/**
 * @param {unknown} value
 * @returns {string} the value as text that cannot open a tag or leave an attribute (`& < > " ' \``)
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (character) => ESCAPES[character]);
}

class SafeHtml {
  /** @param {string} markup */
  constructor(markup) {
    this.markup = markup;
  }

  toString() {
    return this.markup;
  }
}

/**
 * Marks markup the code itself wrote (an icon, a constant layout) as safe to insert as is. Never call it on a value that came from a player, a file or the network.
 * @param {string} markup
 * @returns {SafeHtml}
 */
export function raw(markup) {
  return new SafeHtml(markup);
}

/**
 * Tagged template: every `${value}` is escaped, except what is already markup (`raw(...)`, another html``) and arrays of them, which are joined.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml} markup that `innerHTML = …` takes as it is (it becomes its string), and that another html`` does not escape again
 */
export function html(strings, ...values) {
  const part = (value) => {
    if (value instanceof SafeHtml) return value.markup;
    if (Array.isArray(value)) return value.map(part).join('');
    // A string that starts like a tag is almost surely markup somebody forgot to mark: it is escaped (the safe way), and said, so the screen that shows "<span …>" as
    // text is found at once, in the console, instead of by chance. Fix: build it with html``, or raw() when it is a constant of the code.
    if (typeof value === 'string' && /^\s*<[a-z/!]/i.test(value) && !warnedMarkup.has(value.slice(0, 40))) {
      warnedMarkup.add(value.slice(0, 40));
      console.warn(`[html] a value that looks like markup is shown as text: ${value.slice(0, 80)} — use html\`\` for it, or raw() for a constant of the code`);
    }
    return escapeHtml(value);
  };
  return new SafeHtml(strings.reduce((markup, string, index) => markup + string + (index < values.length ? part(values[index]) : ''), ''));
}
