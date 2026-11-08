import { createModalFocusSession } from './modalFocus.js';
import { renderRichText } from './richText.js';

let modalCount = 0;

/**
 * A yes/no question in front of the game, answered before anything happens. Reuses the look of the
 * news modal (`news-event-modal` styles) and its keyboard behaviour (Tab trapped, Escape = no).
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {Array<string | { label: string, text: string }>} [options.items] One entry each, listed under the message with no bullet and aligned left like the
 *   message: a plain line, or a line with a bold `label` above its `text` (a line break in `text` is kept).
 * @param {string} options.confirmLabel
 * @param {string} options.cancelLabel
 * @returns {Promise<boolean>} true when the player confirms.
 */
export function confirmModal({ title, message, items = [], confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'news-event-modal confirm-modal active';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'news-event-modal-card';

    const header = document.createElement('div');
    header.className = 'news-event-modal-header';
    // The dialog's title is its h2; what the entries are called under it are h3: one hierarchy, whatever the modal says.
    const heading = document.createElement('h2');
    heading.id = `confirm-modal-title-${++modalCount}`;
    heading.textContent = title;
    modal.setAttribute('aria-labelledby', heading.id);
    header.appendChild(heading);

    const content = document.createElement('div');
    content.className = 'news-event-modal-content';
    // The text is laid out by richText.js (paragraphs, bold, `- ` lists, `## ` headings), the same convention as a dépêche, built from text nodes only.
    const body = document.createElement('div');
    body.className = 'news-event-modal-body';
    renderRichText(body, message);
    content.appendChild(body);
    if (items.length > 0) {
      const list = document.createElement('ul');
      list.className = 'confirm-modal-list';
      for (const item of items) {
        const line = document.createElement('li');
        line.className = 'confirm-modal-item';
        if (typeof item === 'string') {
          renderRichText(line, item);
        } else {
          const label = document.createElement('h3');
          label.className = 'confirm-modal-item-label';
          label.textContent = item.label;
          const text = document.createElement('div');
          text.className = 'confirm-modal-item-text';
          renderRichText(text, item.text);
          line.append(label, text);
        }
        list.appendChild(line);
      }
      content.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'news-event-modal-footer';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    // "No" is outlined and "yes" filled, so the two never look alike.
    cancel.className = 'modal-btn secondary';
    cancel.textContent = cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'modal-btn modal-btn-primary';
    confirm.textContent = confirmLabel;
    // A notice has a single button: nothing to refuse.
    if (cancelLabel === null) footer.append(confirm);
    else footer.append(cancel, confirm);

    card.append(header, content, footer);
    modal.appendChild(card);

    let session = null;
    const answer = (value) => {
      session?.release();
      modal.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => answer(false));
    confirm.addEventListener('click', () => answer(true));

    document.body.appendChild(modal);
    // Focus starts on "no": a stray Enter must not destroy anything.
    session = createModalFocusSession({ panel: modal, onEscape: () => answer(false), initialFocus: cancelLabel === null ? confirm : cancel });
  });
}

/**
 * A message the player must read before going on (a refusal, a result), in the look of the game's modals: one button, no choice.
 * @param {{ title: string, message: string, items?: Array<string | { label: string, text: string }>, closeLabel?: string }} options
 * @returns {Promise<void>}
 */
export async function noticeModal({ title, message, items = [], closeLabel = 'Fermer' }) {
  await confirmModal({ title, message, items, confirmLabel: closeLabel, cancelLabel: null });
}
