import { labelForNewsSource } from '../../../contexts/intelligence/domain/catalogs/NewsSourceCatalog.js';
import { labelForNewsCategory } from '../../../contexts/intelligence/domain/catalogs/NewsCategoryCatalog.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';

/** @type {null | (() => Promise<void>)} */
let presentIncomingHandler = null;

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
 * Modale event-message (file incoming uniquement).
 *
 * @param {object} deps
 * @param {object} deps.intelligence
 * @param {() => number} [deps.getGameTime]
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
    modal.classList.remove('active', 'visible');
    queue = [];
    index = 0;
    bodyRevealed = false;
  }

  function render() {
    const item = currentItem();
    if (!item) {
      closeModal();
      return;
    }

    const needsPay = item.revelation === 'unpaid' && !bodyRevealed;
    const showBody = item.revelation === 'free' || item.revelation === 'revealed' || bodyRevealed;

    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
      metaEl.textContent = `${labelForNewsSource(item.sourceId)} · ${labelForNewsCategory(item.categoryId)} · ${formatTurnLabel(item.turn)}`;
    }
    if (bodyEl) {
      bodyEl.textContent = showBody ? item.body : item.teaser || 'Une dépêche est disponible contre contribution.';
    }

    if (paywallEl) {
      paywallEl.hidden = !needsPay;
    }
    if (fundsHintEl) {
      fundsHintEl.textContent = '';
    }
    if (payBtn) {
      const price = item.access?.price ?? 10;
      payBtn.textContent = `Payer ${price} €`;
      payBtn.disabled = true; // Phase 2 : activer via canAfford
      payBtn.hidden = !needsPay;
    }
    if (skipBtn) {
      skipBtn.hidden = !needsPay;
    }
    if (nextBtn) {
      nextBtn.hidden = needsPay;
      nextBtn.textContent = 'Lire le suivant';
    }
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
    render();
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
    render();
  }

  nextBtn?.addEventListener('click', () => {
    void archiveCurrentAndAdvance();
  });
  skipBtn?.addEventListener('click', () => {
    void skipUnpaidAndAdvance();
  });
  // Phase 2 : payBtn settle + reveal

  presentIncomingHandler = async () => {
    if (modal.classList.contains('active') || modal.classList.contains('visible')) {
      return;
    }
    queue = await deps.intelligence.listIncomingNews();
    if (!queue.length) return;
    index = 0;
    bodyRevealed = false;
    modal.classList.add('active', 'visible');
    render();
  };

  deps.registerAppService?.('newsEventModal', {
    presentIncoming: presentIncomingHandler,
  });
}
