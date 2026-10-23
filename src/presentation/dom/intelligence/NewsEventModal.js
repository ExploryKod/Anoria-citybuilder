import { labelForNewsSource, labelForNewsCategory } from '../../../composition/intelligenceCatalog.js';
import { listHamlets } from '../../../core/persistence/hamlet/hamletSession.js';

async function hamletNameOf(hamletId) {
  const hamlet = (await listHamlets()).find((candidate) => candidate.id === hamletId);
  if (!hamlet) throw new Error(`[news] item belongs to an unknown hamlet ${hamletId}`);
  return hamlet.name;
}
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { createModalFocusSession } from '../shell/modalFocus.js';
import { formatEuro } from '../../../contexts/accounting/presentation/formatMoney.js';
import { buildingIconHtml, buildingName } from '../shell/CatalogVocabulary.js';

/**
 * The buttons a dépêche can carry (its `action`): what each looks like and what it does. A new kind is one more entry; a dépêche that names a kind
 * not listed here fails loudly.
 * @type {Readonly<Record<string, { relevant: (action: object, deps: object) => boolean, iconHtml: (action: object) => string, label: (action: object) => string, run: (action: object, deps: object) => void }>>}
 */
const NEWS_ACTIONS = Object.freeze({
  // Pick a building to place: the button wears its picture, a click closes the dépêche and puts the tool in hand. Once the building stands the
  // button has nothing left to offer: the dépêche is only a confirmation, and shows no button.
  buildTool: {
    relevant: (action, deps) => {
      if (typeof deps.isBuilt !== 'function') throw new Error('[news] a dépêche offers a building to place, but the modal was not given isBuilt');
      return !deps.isBuilt(action.toolId);
    },
    iconHtml: (action) => buildingIconHtml(action.toolId),
    label: (action) => `Placer : ${buildingName(action.toolId)}`,
    run: (action, deps) => {
      if (typeof deps.activateBuildTool !== 'function') throw new Error('[news] a dépêche offers a building to place, but the modal was not given activateBuildTool');
      deps.activateBuildTool(action.toolId);
    },
  },
});

/**
 * The icons a dépêche's `legend` can show: each key names a button of the interface, whose own icon is copied (the dépêche shows what the player will
 * find on screen, never a second drawing). A key not listed here fails loudly.
 */
const NEWS_LEGEND_ICONS = Object.freeze({
  'rail-population': '#hud-pop-tab-details',
  'rail-employment': '#hud-pop-tab-emploi',
  'rail-city-stocks': '#hud-pop-tab-ressources-ville',
  'rail-nature': '#hud-pop-tab-ressources-nature',
});

/** @param {string} key @returns {HTMLElement} a copy of the icon of the interface button the key names */
function legendIconOf(key) {
  const selector = NEWS_LEGEND_ICONS[key];
  if (!selector) throw new Error(`[news] a dépêche's legend names the icon "${key}", which the modal does not know (${Object.keys(NEWS_LEGEND_ICONS).join(', ')})`);
  const source = document.querySelector(selector);
  if (!source) throw new Error(`[news] the legend icon "${key}" points at ${selector}, which is not on the page`);
  const icon = document.createElement('span');
  icon.className = 'news-event-legend-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = source.innerHTML;
  return icon;
}

/** @param {{ kind: string }} action */
function newsActionOf(action) {
  const known = NEWS_ACTIONS[action.kind];
  if (!known) throw new Error(`[news] a dépêche carries an action of kind "${action.kind}", which the modal does not know`);
  return known;
}

/** @type {null | (() => Promise<void>)} */
let presentIncomingHandler = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let newsFocusSession = null;

/** @type {Array<() => void>} */
let closeWaiters = [];

/** True while the dépêche modal is open (set when it opens, cleared when it closes). */
let newsModalOpen = false;

/** @type {Map<string, () => void>} */
const closeListeners = new Map();

/**
 * Calls back each time the dépêche modal has been closed (what the player does next may depend on the dépêche they just got past). One listener per key:
 * registering the same key again replaces it.
 */
export function onNewsModalClosed(key, listener) {
  closeListeners.set(key, listener);
}

/**
 * Résolu quand la modale des dépêches est refermée (tout de suite si elle est fermée).
 * @returns {Promise<void>}
 */
export function waitForNewsModalClosed() {
  if (!newsModalOpen) return Promise.resolve();
  return new Promise((resolve) => {
    closeWaiters.push(resolve);
  });
}

/**
 * Ouvre la file des dépêches incoming après un tick (si non vide).
 * @returns {Promise<void>}
 */
export async function presentIncomingNewsEvents() {
  if (typeof presentIncomingHandler === 'function') {
    await presentIncomingHandler();
  }
}

/**
 * @param {object} deps
 * @param {object} deps.intelligence
 * @param {() => number} [deps.getGameTime]
 * @param {object} [deps.popupManager]
 * @param {(name: string, instance: *) => void} [deps.registerAppService]
 */
export function initNewsEventModal(deps) {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('news-event-modal');
  if (!modal) return;

  const titleEl = document.getElementById('news-event-title');
  const metaEl = document.getElementById('news-event-meta');
  const bodyEl = document.getElementById('news-event-body');
  const illustrationsEl = document.getElementById('news-event-illustrations');
  const imageEl = document.getElementById('news-event-image');
  const choicesEl = document.getElementById('news-event-choices');
  const legendEl = document.getElementById('news-event-legend');
  const paywallEl = document.getElementById('news-event-paywall');
  const payBtn = document.getElementById('news-event-pay-btn');
  const skipBtn = document.getElementById('news-event-skip-btn');
  const fundsHintEl = document.getElementById('news-event-funds-hint');
  const nextBtn = document.getElementById('news-event-next-btn');
  const closeBtn = document.getElementById('news-event-close-btn');
  const actionEl = document.getElementById('news-event-action');
  const actionBtn = document.getElementById('news-event-action-btn');
  const actionIconEl = document.getElementById('news-event-action-icon');
  const actionLabelEl = document.getElementById('news-event-action-label');

  /** @type {import('../../../contexts/intelligence/domain/NewsItem.js').NewsItem[]} */
  let queue = [];
  let index = 0;
  let bodyRevealed = false;
  /** The page of the dépêche being read, once the reader has opened one of its pages (null: the dépêche's own first page), and the dépêche it belongs to. */
  let openedPage = null;
  let openedPageOf = null;

  function blurModalFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && modal.contains(active)) {
      active.blur();
    }
  }

  function setModalClosed() {
    blurModalFocus();
    newsFocusSession?.release();
    newsFocusSession = null;
    modal.classList.remove('active', 'visible', 'show');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    deps.popupManager?.closePopup?.('news-event-modal');
    deps.popupManager?.ensureEventsUnblocked?.();
    queue = [];
    index = 0;
    bodyRevealed = false;
    openedPage = null;
    openedPageOf = null;
    newsModalOpen = false;
    const waiters = closeWaiters;
    closeWaiters = [];
    for (const resolve of waiters) resolve();
    for (const listener of closeListeners.values()) listener();
  }

  function setModalOpen() {
    newsModalOpen = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.removeAttribute('inert');
  }

  // Reset boot state — avoids FOUC leftover / stuck canvas block
  setModalClosed();

  function currentItem() {
    return queue[index] ?? null;
  }

  /** What is on screen: the dépêche's first page (itself) or the page the reader opened. Same shape: { body, action, illustrations, image, choices, next }. */
  function currentView() {
    const item = currentItem();
    if (!item) return null;
    return openedPageOf === item.id && openedPage ? openedPage : item;
  }

  /** A blocking dépêche whose button still has something to offer (what it asks is not done): it cannot be closed. */
  function isBlocked(item, action) {
    return item?.blocking === true && Boolean(action);
  }

  /** @type {Map<string, number>} per blocking dépêche, the turn its button was pressed: it comes back a couple of turns later if still not done. */
  const blockingPressedAt = new Map();
  const BLOCKING_COMES_BACK_AFTER_TURNS = 2;

  function openPage(page) {
    openedPage = page;
    openedPageOf = currentItem()?.id ?? null;
    void render();
  }

  function formatTurnLabel(turn) {
    try {
      const info = TimeManager.getTimeInfo(turn);
      return `${info.month} — an ${info.year + 1}`;
    } catch {
      return `Tour ${turn}`;
    }
  }

  function closeModal() {
    setModalClosed();
  }

  async function render() {
    const item = currentItem();
    if (!item) {
      closeModal();
      return;
    }

    const view = currentView();
    const needsPay = item.revelation === 'unpaid' && !bodyRevealed;
    const hasNext = index < queue.length - 1;
    const showBody = item.revelation === 'free' || item.revelation === 'revealed' || bodyRevealed;
    const price = item.access?.price ?? 10;

    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
      const metaLine = `${labelForNewsSource(item.sourceId)} · ${labelForNewsCategory(item.categoryId)} · ${formatTurnLabel(item.turn)}`;
      metaEl.textContent = metaLine;
      hamletNameOf(item.hamletId).then((name) => {
        metaEl.textContent = `${metaLine} · ${name}`;
      });
    }
    if (bodyEl) {
      bodyEl.textContent = showBody
        ? view.body
        : item.teaser || 'Une dépêche est disponible contre contribution.';
    }

    // The buildings a dépêche shows, side by side under its text: their picture and their catalog name.
    if (illustrationsEl) {
      const shown = showBody ? view.illustrations ?? [] : [];
      illustrationsEl.hidden = shown.length === 0;
      illustrationsEl.replaceChildren(
        ...shown.map((buildingId) => {
          const figure = document.createElement('figure');
          figure.className = 'news-event-illustration';
          const picture = document.createElement('span');
          picture.className = 'news-event-illustration-picture';
          picture.setAttribute('aria-hidden', 'true');
          picture.innerHTML = buildingIconHtml(buildingId);
          const caption = document.createElement('figcaption');
          caption.textContent = buildingName(buildingId);
          figure.append(picture, caption);
          return figure;
        })
      );
    }

    // Icons of the interface, each with its word, in a row under the text.
    if (legendEl) {
      const entries = showBody ? view.legend ?? [] : [];
      legendEl.hidden = entries.length === 0;
      legendEl.replaceChildren(
        ...entries.map(({ icon, word }) => {
          const item = document.createElement('div');
          item.className = 'news-event-legend-item';
          const caption = document.createElement('span');
          caption.textContent = word;
          item.append(legendIconOf(icon), caption);
          return item;
        })
      );
    }

    // A picture under the text (a screenshot of the interface the text points at).
    if (imageEl) {
      const image = showBody ? view.image : null;
      imageEl.hidden = !image;
      if (image) {
        imageEl.src = image.src;
        imageEl.alt = image.alt;
      } else {
        imageEl.removeAttribute('src');
      }
    }

    if (paywallEl) {
      paywallEl.hidden = !needsPay;
    }
    if (payBtn) {
      payBtn.textContent = `Payer ${formatEuro(price)}`;
      payBtn.hidden = !needsPay;
    }
    if (skipBtn) {
      skipBtn.hidden = !needsPay;
      skipBtn.textContent = hasNext ? 'Lire d’autres nouvelles' : 'Ignorer';
    }
    // What the dépêche offers to do (a building to place), once it can be read.
    const action = showBody && view.action && newsActionOf(view.action).relevant(view.action, deps) ? view.action : null;

    // The buttons that open the rest of the dépêche, a page at a time: one per choice (its own sentence, from the catalog), then "Lire la suite".
    if (choicesEl) {
      const buttons = [];
      if (showBody) {
        for (const choice of view.choices ?? []) buttons.push({ label: choice.label, page: choice.page });
        if (view.next) buttons.push({ label: 'Lire la suite', page: view.next });
      }
      choicesEl.hidden = buttons.length === 0;
      choicesEl.replaceChildren(
        ...buttons.map(({ label, page }) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'news-event-choice-btn';
          button.textContent = label;
          button.addEventListener('click', () => openPage(page));
          return button;
        })
      );
    }
    if (actionEl) actionEl.hidden = !action;
    if (action) {
      const kind = newsActionOf(action);
      if (actionIconEl) actionIconEl.innerHTML = kind.iconHtml(action);
      if (actionLabelEl) actionLabelEl.textContent = kind.label(action);
    }
    // Two buttons at most: an unpaid dépêche offers to pay or to leave it; a readable one offers to close, and to read the next only if there is one.
    // With a button of its own on it, the dépêche shows only one of those two: the next one when there is one, to close it otherwise.
    // A blocking dépêche has its button as the only way out: nothing to close, nothing next.
    const blocked = isBlocked(item, action);
    if (nextBtn) {
      nextBtn.hidden = needsPay || !hasNext || blocked;
      nextBtn.textContent = 'Lire le suivant';
    }
    if (closeBtn) {
      closeBtn.hidden = needsPay || blocked || (Boolean(action) && hasNext);
    }

    if (needsPay) {
      let canPay = false;
      try {
        canPay = (await deps.intelligence.canAffordContribution?.(price)) === true;
      } catch {
        canPay = false;
      }
      if (payBtn) payBtn.disabled = !canPay;
      if (fundsHintEl) {
        fundsHintEl.textContent = canPay ? 'Vous avez les fonds' : 'Fonds insuffisants';
      }
    } else if (fundsHintEl) {
      fundsHintEl.textContent = '';
    }

    if (newsFocusSession?.isActive()) {
      requestAnimationFrame(() => {
        focusNewsPrimaryAction()?.focus?.();
      });
    }
  }

  function focusNewsPrimaryAction() {
    if (nextBtn instanceof HTMLElement && !nextBtn.hidden) return nextBtn;
    if (closeBtn instanceof HTMLElement && !closeBtn.hidden) return closeBtn;
    if (payBtn instanceof HTMLElement && !payBtn.hidden && !payBtn.disabled) return payBtn;
    if (skipBtn instanceof HTMLElement && !skipBtn.hidden) return skipBtn;
    return nextBtn ?? payBtn ?? skipBtn ?? modal;
  }

  /** Read and done: the dépêche is archived and the modal closes (the ones not yet read come back at the next presentation). */
  async function archiveCurrentAndClose() {
    const item = currentItem();
    if (item && !(item.revelation === 'unpaid' && !bodyRevealed)) {
      const turn = deps.getGameTime?.() ?? item.turn;
      await deps.intelligence.archiveNewsItem({ newsItemId: item.id, turn });
    }
    closeModal();
  }

  async function archiveCurrentAndAdvance() {
    const item = currentItem();
    if (!item) {
      closeModal();
      return;
    }
    const turn = deps.getGameTime?.() ?? item.turn;
    await deps.intelligence.archiveNewsItem({ newsItemId: item.id, turn });
    index += 1;
    bodyRevealed = false;
    if (index >= queue.length) {
      closeModal();
      return;
    }
    await render();
  }

  async function skipUnpaidAndAdvance() {
    const item = currentItem();
    if (!item) {
      closeModal();
      return;
    }
    await deps.intelligence.deleteNewsItem({ newsItemId: item.id });
    index += 1;
    bodyRevealed = false;
    if (index >= queue.length) {
      closeModal();
      return;
    }
    await render();
  }

  async function payCurrent() {
    const item = currentItem();
    if (!item || item.revelation !== 'unpaid' || bodyRevealed) return;

    const turn = deps.getGameTime?.() ?? item.turn;
    if (payBtn) payBtn.disabled = true;
    const result = await deps.intelligence.payForNewsItem({
      newsItemId: item.id,
      turn,
    });

    if (!result?.ok) {
      if (fundsHintEl) {
        fundsHintEl.textContent =
          result?.reason === 'insufficient_funds'
            ? 'Fonds insuffisants'
            : 'Paiement impossible';
      }
      await render();
      return;
    }

    queue[index] = result.item;
    bodyRevealed = true;
    await render();
  }

  nextBtn?.addEventListener('click', () => {
    void archiveCurrentAndAdvance();
  });
  closeBtn?.addEventListener('click', () => {
    void archiveCurrentAndClose();
  });
  actionBtn?.addEventListener('click', () => {
    const action = currentView()?.action;
    if (!action) return;
    const item = currentItem();
    if (item?.blocking === true) {
      // Not read, not archived: the dépêche stays until what it asks is done (it comes back after a few turns, see presentIncomingHandler).
      blockingPressedAt.set(item.id, deps.getGameTime?.() ?? item.turn);
      closeModal();
      newsActionOf(action).run(action, deps);
      return;
    }
    // The dépêche is read: it is archived and closed, then its button does what it says.
    void archiveCurrentAndClose().then(() => newsActionOf(action).run(action, deps));
  });
  skipBtn?.addEventListener('click', () => {
    void skipUnpaidAndAdvance();
  });
  payBtn?.addEventListener('click', () => {
    void payCurrent();
  });

  presentIncomingHandler = async () => {
    if (
      !modal.hidden &&
      (modal.classList.contains('active') || modal.classList.contains('visible'))
    ) {
      return;
    }
    queue = await deps.intelligence.listIncomingNews();
    // A blocking dépêche is done once its button has nothing left to offer (the building stands): it is archived without being shown. While it is not,
    // it is shown again a couple of turns after its button was pressed, not before (the player is placing the building).
    const now = deps.getGameTime?.() ?? 0;
    const kept = [];
    for (const item of queue) {
      if (item.blocking !== true || !item.action) {
        kept.push(item);
      } else if (!newsActionOf(item.action).relevant(item.action, deps)) {
        await deps.intelligence.archiveNewsItem({ newsItemId: item.id, turn: now });
      } else if (!blockingPressedAt.has(item.id) || now - blockingPressedAt.get(item.id) >= BLOCKING_COMES_BACK_AFTER_TURNS) {
        kept.push(item);
      }
    }
    queue = kept;
    if (!queue.length) return;
    index = 0;
    bodyRevealed = false;
    setModalOpen();
    modal.classList.add('active', 'visible');
    await render();
    newsFocusSession?.release({ restoreFocus: false });
    newsFocusSession = createModalFocusSession({
      panel: modal,
      onEscape: () => {
        const item = currentItem();
        if (isBlocked(item, item?.action && newsActionOf(item.action).relevant(item.action, deps) ? item.action : null)) return;
        void archiveCurrentAndClose();
      },
      initialFocus: focusNewsPrimaryAction,
      ensureDialogAttributes: false,
    });
  };

  deps.registerAppService?.('newsEventModal', {
    presentIncoming: presentIncomingHandler,
  });
}
