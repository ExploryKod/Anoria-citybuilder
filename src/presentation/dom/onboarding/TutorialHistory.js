import { TimeManager } from '../../../shared/time/TimeManager.js';
import { isTutorialMode } from '../../../shared/gameplay/gameMode.js';
import { createModalFocusSession } from '../shell/modalFocus.js';
import { illustrationFigure, makeImageZoomable, richTextHtml } from '../intelligence/NewsEventModal.js';

const TUTORIAL_CATEGORY = 'tutorial';

/**
 * The pages of a dépêche in reading order: itself, then what "Lire la suite" and its choices open, depth first.
 * @param {{ next?: object | null, choices?: Array<{ page: object }> }} page
 * @returns {object[]}
 */
function pagesOf(page) {
  const pages = [page];
  for (const choice of page.choices ?? []) pages.push(...pagesOf(choice.page));
  if (page.next) pages.push(...pagesOf(page.next));
  return pages;
}

/** One page of a dépêche as the history shows it when it is read: its text, its buildings and its picture. */
function renderPage(page) {
  const section = document.createElement('div');
  section.className = 'tutorial-history-page';
  const body = document.createElement('p');
  body.className = 'news-event-modal-body';
  body.innerHTML = richTextHtml(page.body);
  section.append(body);

  if (page.illustrations?.length) {
    const row = document.createElement('div');
    row.className = 'news-event-illustrations';
    row.append(...page.illustrations.map(illustrationFigure));
    section.append(row);
  }
  if (page.image) {
    const image = document.createElement('img');
    image.className = 'news-event-image';
    image.src = page.image.src;
    image.alt = page.image.alt;
    makeImageZoomable(image, page.image);
    section.append(image);
    if (page.image.caption) {
      const caption = document.createElement('p');
      caption.className = 'news-event-image-caption';
      caption.textContent = page.image.caption;
      section.append(caption);
    }
  }
  return section;
}

function dateLabel(item) {
  const info = TimeManager.getTimeInfo(item.turn);
  return `${info.month}, an ${info.year + 1}`;
}

function button(label, onClick, extraClass = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `modal-btn ${extraClass}`.trim();
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

/**
 * The tutorial's history: a button (shown in a tutorial game only) that opens the list of the dépêches the tutorial has given, newest first. Each one can be
 * read again (its pages, its pictures) or, once read, removed from the list (it stays filed: the tutorial must not write it again).
 *
 * @param {{ intelligence: object, popupManager?: object }} deps
 */
export function initTutorialHistory({ intelligence, popupManager }) {
  const openBtn = document.getElementById('tutorial-history-btn');
  const modal = document.getElementById('tutorial-history-modal');
  const list = document.getElementById('tutorial-history-list');
  const titleEl = document.getElementById('tutorial-history-title');
  const backBtn = document.getElementById('tutorial-history-back');
  const closeBtn = document.getElementById('tutorial-history-close');
  if (!openBtn || !modal || !list || !titleEl || !backBtn || !closeBtn) throw new Error('[tutorial history] its button or modal is missing from game.html');
  if (!isTutorialMode()) return;

  openBtn.hidden = false;
  const LIST_TITLE = titleEl.textContent;
  let focusSession = null;

  function close() {
    focusSession?.release();
    focusSession = null;
    modal.classList.remove('active', 'visible');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    popupManager?.ensureEventsUnblocked?.();
  }

  /** The dépêches of the tutorial the player has not removed, newest first, with whether each is read (archived). */
  async function load() {
    const [archived, incoming] = await Promise.all([intelligence.listArchivedNews(), intelligence.listIncomingNews()]);
    return [
      ...archived.map((item) => ({ item, read: true })),
      ...incoming.map((item) => ({ item, read: false })),
    ]
      .filter(({ item }) => item.categoryId === TUTORIAL_CATEGORY && !item.hidden)
      .sort((a, b) => b.item.turn - a.item.turn);
  }

  function showReading(item) {
    titleEl.textContent = item.title;
    backBtn.hidden = false;
    list.replaceChildren(...pagesOf(item).map(renderPage));
    // The list is one scroller for every dépêche and for the list itself: a dépêche is read from its top
    list.scrollTop = 0;
  }

  async function showList() {
    titleEl.textContent = LIST_TITLE;
    backBtn.hidden = true;
    const entries = await load();
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'news-event-modal-body';
      empty.textContent = 'Aucune dépêche pour le moment.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(
      ...entries.map(({ item, read }) => {
        const row = document.createElement('div');
        row.className = `tutorial-history-row ${read ? 'tutorial-history-row--read' : 'tutorial-history-row--unread'}`;
        // Read or not, said by an icon (and by the dimming of the row, see the CSS): a closed envelope for a message waiting, an open book once read.
        const status = document.createElement('span');
        status.className = 'tutorial-history-row__status';
        status.textContent = read ? '📖' : '✉️';
        status.title = read ? 'Lue' : 'Non lue';
        status.setAttribute('role', 'img');
        status.setAttribute('aria-label', status.title);
        const text = document.createElement('div');
        text.className = 'tutorial-history-row__text';
        const title = document.createElement('strong');
        title.textContent = item.title;
        const date = document.createElement('span');
        date.textContent = dateLabel(item);
        text.append(title, date);
        const actions = document.createElement('div');
        actions.className = 'tutorial-history-row__actions';
        actions.append(button('Lire', () => showReading(item)));
        // A dépêche not read yet is not removed from under the player: it is shown to them first.
        if (read) {
          actions.append(
            button('Supprimer', async () => {
              await intelligence.hideNewsItem({ newsItemId: item.id });
              await showList();
            })
          );
        }
        row.append(status, text, actions);
        return row;
      })
    );
  }

  async function open() {
    await showList();
    list.scrollTop = 0;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.removeAttribute('inert');
    modal.classList.add('active', 'visible');
    focusSession = createModalFocusSession({ panel: modal, onEscape: close, initialFocus: () => closeBtn, ensureDialogAttributes: false });
  }

  openBtn.addEventListener('click', () => void open());
  backBtn.addEventListener('click', async () => {
    await showList();
    list.scrollTop = 0;
  });
  closeBtn.addEventListener('click', close);
}
