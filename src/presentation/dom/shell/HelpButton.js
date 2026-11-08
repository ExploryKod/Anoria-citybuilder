import { noticeModal } from './ConfirmModal.js';
import { HELP, FRAGMENTS } from '../../../shared/help-catalog/HelpCatalog.js';
import { formatEuro } from '../../../contexts/accounting/presentation/formatMoney.js';

const FORMATTERS = Object.freeze({
  euro: formatEuro,
  percent: (ratio) => `${(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
  index: (value) => value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
});

/**
 * Reads a text of the catalog in the state the city is in, and puts the live figures in it. Strict: an entry that names a state or a figure the caller did not give,
 * a figure the entry does not name, or a text with no version for the state, throws and names it (HelpCatalog.js).
 * @param {string} id
 * @param {{ state?: string | null, figures?: Record<string, number> }} [reading]
 * @returns {{ about: string, title: string, message: string, items: Array<{ label: string, text: string }> }}
 */
export function resolveHelp(id, { state = null, figures = {} } = {}) {
  const entry = HELP[id];
  if (!entry) throw new Error(`[help] "${id}" is not an entry of HelpCatalog.js`);
  const states = entry.states ?? [];
  if (states.length === 0 && state !== null) throw new Error(`[help] "${id}" has no states, got "${state}"`);
  if (states.length > 0 && !states.includes(state)) throw new Error(`[help] "${id}" is written for the states ${states.join(', ')}, got "${state}"`);
  const declared = Object.keys(entry.figures ?? {});
  for (const name of Object.keys(figures)) {
    if (!declared.includes(name)) throw new Error(`[help] "${id}" does not name the figure "${name}": remove it, or declare it in the entry`);
  }
  const textOf = (text, where) => {
    const chosen = typeof text === 'string' ? text : text[state];
    if (typeof chosen !== 'string') throw new Error(`[help] "${id}": ${where} has no text for the state "${state}"`);
    return chosen.replace(/\{(\w+)\}/g, (_, name) => {
      if (!declared.includes(name)) throw new Error(`[help] "${id}": ${where} writes {${name}}, which the entry does not declare as a figure`);
      // A state writes only the figures it needs: one it does not write is not asked for, one it writes must be given.
      if (!Number.isFinite(figures[name])) throw new Error(`[help] "${id}": ${where} writes {${name}}, which was not given (got ${figures[name]})`);
      return FORMATTERS[entry.figures[name]](figures[name]);
    });
  };
  return {
    about: entry.about,
    title: entry.title,
    message: textOf(entry.message, 'the message'),
    items: (entry.items ?? [])
      .filter((item) => item.when === undefined || item.when === state)
      .map((item, index) => {
        if (item.fragment === undefined) return { label: textOf(item.label, `item ${index} label`), text: textOf(item.text, `item ${index} text`) };
        const fragment = FRAGMENTS[item.fragment];
        if (!fragment) throw new Error(`[help] "${id}" uses the fragment "${item.fragment}", which is not in HelpCatalog.js`);
        return { ...fragment };
      }),
  };
}

/**
 * A "?" that explains what is not obvious on a screen: it opens the explanation of the catalog (HelpCatalog.js) in the game's own modal, with the figures of the moment.
 * It is put only where a figure or a term needs one: what is obvious is not explained.
 *
 * @param {string} id an entry of the help catalog
 * @param {{ state?: string | null, figures?: Record<string, number> }} [reading] the state the city is in and the live figures the entry names
 * @returns {HTMLButtonElement}
 */
export function helpButton(id, reading = {}) {
  const { about, title, message, items } = resolveHelp(id, reading);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-btn';
  button.textContent = '?';
  button.title = `Expliquez-moi : ${about}`;
  button.setAttribute('aria-label', `Expliquez-moi : ${about}`);
  button.addEventListener('click', (event) => {
    // A "?" inside a row or a heading must not trigger what the row does.
    event.stopPropagation();
    void noticeModal({ title, message, items });
  });
  return button;
}

/**
 * Puts a "?" at the end of every element of the page marked `data-help="<entry>"`: the markup of a page, or of a screen built as html (`helpSlotHtml`). An element
 * may carry the state (`data-help-state`) and the live figures (`data-help-figures`, JSON) its entry reads. Done once per element: calling it again does not double the buttons.
 * @param {ParentNode} root
 */
export function bindStaticHelps(root) {
  for (const host of root.querySelectorAll('[data-help]')) {
    if (host.querySelector(':scope > .help-btn')) continue;
    host.append(helpButton(host.dataset.help, {
      state: host.dataset.helpState ?? null,
      figures: host.dataset.helpFigures ? JSON.parse(host.dataset.helpFigures) : {},
    }));
  }
}

/**
 * The markup of a "?" for a screen that is written as an html string: a slot that `bindStaticHelps` turns into the button once the markup is in the page. The entry is
 * read at once, so a wrong state or figure fails where the screen is built, not when it is clicked.
 * @param {string} id
 * @param {{ state?: string | null, figures?: Record<string, number> }} [reading]
 * @returns {string} html
 */
export function helpSlotHtml(id, reading = {}) {
  resolveHelp(id, reading);
  const attribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<span class="help-slot" data-help="${attribute(id)}"${reading.state ? ` data-help-state="${attribute(reading.state)}"` : ''}${reading.figures ? ` data-help-figures="${attribute(JSON.stringify(reading.figures))}"` : ''}></span>`;
}
