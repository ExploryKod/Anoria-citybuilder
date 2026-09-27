import { createModalFocusSession } from './modalFocus.js';

/**
 * A yes/no question in front of the game, answered before anything happens. Reuses the look of the
 * news modal (`news-event-modal` styles) and its keyboard behaviour (Tab trapped, Escape = no).
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string[]} [options.items] One line each, listed under the message.
 * @param {string} options.confirmLabel
 * @param {string} options.cancelLabel
 * @returns {Promise<boolean>} true when the player confirms.
 */
export function confirmModal({ title, message, items = [], confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'news-event-modal active';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'news-event-modal-card';

    const header = document.createElement('div');
    header.className = 'news-event-modal-header';
    const heading = document.createElement('h3');
    heading.textContent = title;
    header.appendChild(heading);

    const content = document.createElement('div');
    content.className = 'news-event-modal-content';
    const body = document.createElement('p');
    body.className = 'news-event-modal-body';
    body.textContent = message;
    content.appendChild(body);
    if (items.length > 0) {
      const list = document.createElement('ul');
      for (const item of items) {
        const line = document.createElement('li');
        line.textContent = item;
        list.appendChild(line);
      }
      content.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'news-event-modal-footer';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'modal-btn';
    cancel.textContent = cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'modal-btn modal-btn-primary';
    confirm.textContent = confirmLabel;
    footer.append(cancel, confirm);

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
    session = createModalFocusSession({ panel: modal, onEscape: () => answer(false), initialFocus: cancel });
  });
}
