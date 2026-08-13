import { labelForNewsSource } from '../../../contexts/intelligence/domain/catalogs/NewsSourceCatalog.js';
import { labelForNewsCategory } from '../../../contexts/intelligence/domain/catalogs/NewsCategoryCatalog.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { createModalFocusSession } from '../shell/modalFocus.js';

/** @type {null | (() => Promise<void>)} */
let presentIncomingHandler = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let newsFocusSession = null;

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

  // Reset boot state — avoids FOUC leftover / stuck canvas block
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('active', 'visible', 'show');
  deps.popupManager?.closePopup?.('news-event-modal');
  deps.popupManager?.ensureEventsUnblocked?.();

  const titleEl = document.getElementById('news-event-title');
  const metaEl = document.getElementById('news-event-meta');
  const bodyEl = document.getElementById('news-event-body');
  const paywallEl = document.getElementById('news-event-paywall');
  const payBtn = document.getElementById('news-event-pay-btn');
  const skipBtn = document.getElementById('news-event-skip-btn');
  const fundsHintEl = document.getElementById('news-event-funds-hint');
  const nextBtn = document.getElementById('news-event-next-btn');

  /** @type {import('../../../contexts/intelligence/domain/NewsItem.js').NewsItem[]} */
  let queue = [];
  let index = 0;
  let bodyRevealed = false;

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
    newsFocusSession?.release();
    newsFocusSession = null;
    modal.classList.remove('active', 'visible', 'show');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    deps.popupManager?.closePopup?.('news-event-modal');
    deps.popupManager?.ensureEventsUnblocked?.();
    queue = [];
    index = 0;
    bodyRevealed = false;
  }

  async function render() {
    const item = currentItem();
    if (!item) {
      closeModal();
      return;
    }

    const needsPay = item.revelation === 'unpaid' && !bodyRevealed;
    const showBody = item.revelation === 'free' || item.revelation === 'revealed' || bodyRevealed;
    const price = item.access?.price ?? 10;

    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
      metaEl.textContent = `${labelForNewsSource(item.sourceId)} · ${labelForNewsCategory(item.categoryId)} · ${formatTurnLabel(item.turn)}`;
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
      payBtn.textContent = `Payer ${price} €`;
      payBtn.hidden = !needsPay;
    }
    if (skipBtn) {
      skipBtn.hidden = !needsPay;
    }
    if (nextBtn) {
      nextBtn.hidden = needsPay;
      nextBtn.textContent = 'Lire le suivant';
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
    if (payBtn instanceof HTMLElement && !payBtn.hidden && !payBtn.disabled) return payBtn;
    if (skipBtn instanceof HTMLElement && !skipBtn.hidden) return skipBtn;
    return nextBtn ?? payBtn ?? skipBtn ?? modal;
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
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active', 'visible');
    await render();
    newsFocusSession?.release({ restoreFocus: false });
    newsFocusSession = createModalFocusSession({
      panel: modal,
      onEscape: closeModal,
      initialFocus: focusNewsPrimaryAction,
      ensureDialogAttributes: false,
    });
  };

  deps.registerAppService?.('newsEventModal', {
    presentIncoming: presentIncomingHandler,
  });
}
