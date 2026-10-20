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
    newsModalOpen = false;
    const waiters = closeWaiters;
    closeWaiters = [];
    for (const resolve of waiters) resolve();
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
        ? item.body
        : item.teaser || 'Une dépêche est disponible contre contribution.';
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
    const action = showBody && item.action && newsActionOf(item.action).relevant(item.action, deps) ? item.action : null;
    if (actionEl) actionEl.hidden = !action;
    if (action) {
      const kind = newsActionOf(action);
      if (actionIconEl) actionIconEl.innerHTML = kind.iconHtml(action);
      if (actionLabelEl) actionLabelEl.textContent = kind.label(action);
    }
    // Two buttons at most: an unpaid dépêche offers to pay or to leave it; a readable one offers to close, and to read the next only if there is one.
    // With a button of its own on it, the dépêche shows only one of those two: the next one when there is one, to close it otherwise.
    if (nextBtn) {
      nextBtn.hidden = needsPay || !hasNext;
      nextBtn.textContent = 'Lire le suivant';
    }
    if (closeBtn) {
      closeBtn.hidden = needsPay || (Boolean(action) && hasNext);
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
    const action = currentItem()?.action;
    if (!action) return;
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
