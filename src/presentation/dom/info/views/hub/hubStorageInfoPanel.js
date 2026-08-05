import {
  clearHubInfoOverlayMode,
  getInfoBuildingBody,
  setHubInfoOverlayMode,
  setInfoBuildingTitle,
} from './hubStorageInfoDom.js';
import { patchHubStoragePieChart, renderHubStoragePieChart } from './hubStoragePieChart.js';

/**
 * @param {object} line
 */
function renderStockGridItem(line) {
  const capHint = line.maxCap > 0 ? ` / ${line.maxCap}` : '';
  const refused = line.mode === 'refuse' ? ' hub-stock-item--refused' : '';
  const fetch = line.mode === 'fetch' ? ' hub-stock-item--fetch' : '';
  const empty = line.amount <= 0 ? ' hub-stock-item--empty' : '';

  return `
    <div class="hub-stock-item${refused}${fetch}${empty}" data-product="${line.productId}">
      <span class="hub-stock-emoji">${line.emoji}</span>
      <span class="hub-stock-qty">${line.amount}${capHint}</span>
      <span class="hub-stock-label">${line.label}</span>
    </div>
  `;
}

/**
 * @param {HTMLElement} ordersPanel
 * @param {string|null} message
 */
function setOrderWarning(ordersPanel, message) {
  clearOrderWarnings(ordersPanel);
  if (!message) return;

  const el = document.createElement('p');
  el.className = 'hub-orders-warning';
  el.setAttribute('role', 'alert');
  el.textContent = message;
  const help = ordersPanel.querySelector('.hub-orders-help');
  if (help?.nextSibling) {
    ordersPanel.insertBefore(el, help.nextSibling);
  } else {
    ordersPanel.prepend(el);
  }
}

/** @param {HTMLElement} ordersPanel */
function clearOrderWarnings(ordersPanel) {
  ordersPanel.querySelectorAll('.hub-orders-warning').forEach((el) => el.remove());
}

/**
 * @param {HTMLElement} ordersPanel
 * @param {object} view
 * @param {string|null} orderWarning
 */
function patchOrdersPanelRows(ordersPanel, view, orderWarning) {
  clearOrderWarnings(ordersPanel);

  const overflowLines = view.lines.filter((line) => line.amount > line.maxCap);
  if (overflowLines.length > 0) {
    setOrderWarning(
      ordersPanel,
      overflowLines
        .map(
          (line) =>
            `${line.emoji} ${line.label} : ${line.amount} unités en stock pour un plafond de ${line.maxCap} — videz d'abord l'espace.`
        )
        .join(' ')
    );
  } else if (orderWarning) {
    setOrderWarning(ordersPanel, orderWarning);
  }

  view.lines.forEach((line) => {
    const row = ordersPanel.querySelector(`.hub-order-c3-row[data-product="${line.productId}"]`);
    if (!row) return;

    row.classList.toggle('hub-order-c3-row--overflow', line.amount > line.maxCap);

    const modeBtn = row.querySelector('[data-action="mode"]');
    if (modeBtn) {
      modeBtn.textContent = line.modeLabel;
      modeBtn.className = `hub-order-mode-btn hub-order-mode-btn--${line.mode}`;
    }

    const display = row.querySelector('.hub-order-share-display');
    if (display) {
      display.textContent = line.percentLabel;
      display.title = `Plafond ${line.maxPercent} % → ${line.maxCap} / ${view.totalCapacity} unités`;
    }
  });
}

/**
 * Soft-refresh without rebuilding the whole modal.
 *
 * @param {object} ctx
 * @param {string|null} [orderWarning]
 */
async function softRefreshHubPanel(ctx, orderWarning = null) {
  const { hubKind, buildingId, supply, buildingRow, supplyView } = ctx;
  const body = getInfoBuildingBody();
  if (!body) return null;

  const freshRow = await supply.getSupplyBuildingRow(buildingId);
  const freshView = supply.getHubStorageInfoView(hubKind, freshRow ?? buildingRow, {
    stocks: hubKind === 'barn' ? freshRow?.commerceStocks : freshRow?.stocks,
    maxStock: supplyView?.maxStock,
  });

  ctx.buildingRow = freshRow ?? buildingRow;
  ctx.view = freshView;

  const capacityEl = body.querySelector('.hub-info-capacity');
  if (capacityEl) {
    capacityEl.textContent = `📦 ${freshView.currentTotal} / ${freshView.totalCapacity} unités`;
  }

  const grid = body.querySelector('.hub-stock-grid');
  if (grid) {
    grid.innerHTML = freshView.lines.map(renderStockGridItem).join('');
  }

  patchHubStoragePieChart(body, freshView);

  const ordersPanel = body.querySelector('.hub-orders-panel');
  if (ordersPanel && !ordersPanel.classList.contains('hidden')) {
    patchOrdersPanelRows(ordersPanel, freshView, orderWarning);
  }

  return freshView;
}

/**
 * @param {object} params
 */
export async function renderHubStorageInfoPanel({
  view,
  buildingId,
  supply,
  buildingRow,
  supplyView = null,
  ordersOpen = false,
}) {
  const body = getInfoBuildingBody();
  if (!body || !view) return;

  setInfoBuildingTitle(view.title);
  setHubInfoOverlayMode(view.hubKind);

  /** Mutable panel context for soft refresh + event delegation */
  const ctx = {
    view,
    hubKind: view.hubKind,
    buildingId,
    supply,
    buildingRow,
    supplyView,
  };

  const workerLine = `${view.workers} / ${view.workerNeed} requis`;
  const capacityLine = `${view.currentTotal} / ${view.totalCapacity} unités`;

  let statusMessage = '';
  if (view.hubKind === 'windmill' && supplyView) {
    if ((buildingRow.roads ?? 0) <= 0) {
      statusMessage = '⚠️ Sans route le moulin ne peut pas stocker.';
    } else if (supplyView.isCollecting) {
      statusMessage = '🟢 Collecte active (décembre).';
    } else {
      statusMessage = '⏸️ En attente — collecte en décembre.';
    }
  } else if (view.hubKind === 'barn') {
    if ((buildingRow.roads ?? 0) <= 0) {
      statusMessage = '⚠️ Sans route la grange ne peut pas recevoir de marchandises.';
    } else if (view.workers <= 0) {
      statusMessage = '❌ Sans magasinier, stockage impossible.';
    } else if (view.currentTotal >= view.totalCapacity) {
      statusMessage = '⚠️ Entrepôt plein — libérez du stock ou embauchez.';
    } else {
      statusMessage = '✅ Prêt à recevoir les transferts usine et le commerce.';
    }
  }

  body.innerHTML = `
    <div class="hub-info-panel">
      <div class="hub-info-summary">
        <div class="hub-info-workers">👷 ${workerLine}</div>
        <div class="hub-info-capacity">📦 ${capacityLine}</div>
        ${statusMessage ? `<p class="hub-info-status">${statusMessage}</p>` : ''}
      </div>
      <div class="hub-stock-grid">
        ${view.lines.map(renderStockGridItem).join('')}
      </div>
      <section class="hub-storage-chart-section">
        <h3 class="hub-storage-chart-title">Répartition de l'entrepôt</h3>
        ${renderHubStoragePieChart(view)}
      </section>
      <div class="hub-info-actions">
        <button type="button" class="hub-orders-toggle-btn">${ordersOpen ? 'Masquer ordres' : 'Ordres'}</button>
      </div>
      <div class="hub-orders-panel ${ordersOpen ? '' : 'hidden'}" aria-hidden="${ordersOpen ? 'false' : 'true'}"></div>
    </div>
  `;

  const ordersBtn = body.querySelector('.hub-orders-toggle-btn');
  const ordersPanel = body.querySelector('.hub-orders-panel');

  if (ordersOpen && ordersPanel) {
    renderHubOrdersPanelShell(ordersPanel, ctx.view);
  }

  ordersPanel?.addEventListener('click', async (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const btn = target.closest('[data-action]');
    if (!btn || !ordersPanel.contains(btn)) return;

    const row = btn.closest('.hub-order-c3-row');
    const productId = row?.dataset.product;
    if (!productId) return;

    const action = btn.getAttribute('data-action');
    const line = ctx.view.lines.find((entry) => entry.productId === productId);

    if (action === 'mode') {
      await supply.updateHubStorageOrderMode(ctx.hubKind, buildingId, productId);
      await softRefreshHubPanel(ctx);
      return;
    }

    if (action === 'percent-dec') {
      const result = await supply.adjustHubStorageOrderShare(ctx.hubKind, buildingId, productId, -1);
      if (result?.ok === false && result.reason === 'stock_exceeds_new_max') {
        const label = line?.label ?? productId;
        const message = `${line?.emoji ?? ''} ${label} : impossible de réduire à ${result.newPercent ?? '?'} % (${result.newMaxCap} unités) — ${result.currentAmount} déjà en stock. Videz d'abord l'espace.`;
        await softRefreshHubPanel(ctx, message);
        return;
      }
      await softRefreshHubPanel(ctx);
      return;
    }

    if (action === 'percent-inc') {
      await supply.adjustHubStorageOrderShare(ctx.hubKind, buildingId, productId, 1);
      await softRefreshHubPanel(ctx);
    }
  });

  ordersBtn?.addEventListener('click', async () => {
    if (!ordersPanel) return;
    const willOpen = ordersPanel.classList.contains('hidden');
    if (willOpen) {
      await softRefreshHubPanel(ctx);
      ordersPanel.classList.remove('hidden');
      ordersPanel.setAttribute('aria-hidden', 'false');
      ordersBtn.textContent = 'Masquer ordres';
      renderHubOrdersPanelShell(ordersPanel, ctx.view);
    } else {
      ordersPanel.classList.add('hidden');
      ordersPanel.setAttribute('aria-hidden', 'true');
      ordersPanel.innerHTML = '';
      ordersBtn.textContent = 'Ordres';
    }
  });
}

/**
 * @param {HTMLElement} ordersPanel
 * @param {object} view
 */
function renderHubOrdersPanelShell(ordersPanel, view) {
  ordersPanel.innerHTML = `
    <h3 class="hub-orders-title">Ordres de stockage</h3>
    <p class="hub-orders-help">
      Mode : Accepter → Refuser → Amener.
      <strong>Amener</strong> tire le stock ailleurs.
      Le <strong>%</strong> est le plafond de remplissage (comme les m² de César III).
      Si plusieurs denrées sont à 100&nbsp;% (ou se chevauchent), la place libre va au
      <strong>premier arrivé</strong>.
    </p>
    <div class="hub-orders-c3-list">
      ${view.lines
        .map(
          (line) => `
        <div class="hub-order-c3-row${line.amount > line.maxCap ? ' hub-order-c3-row--overflow' : ''}" data-product="${line.productId}">
          <span class="hub-order-c3-icon">${line.emoji}</span>
          <span class="hub-order-c3-label">${line.label}</span>
          <button type="button" class="hub-order-mode-btn hub-order-mode-btn--${line.mode}" data-action="mode">
            ${line.modeLabel}
          </button>
          <div class="hub-order-share-control">
            <button type="button" class="hub-order-share-btn" data-action="percent-dec" aria-label="Réduire">−</button>
            <span class="hub-order-share-display" title="Plafond ${line.maxPercent} % → ${line.maxCap} / ${view.totalCapacity} unités">${line.percentLabel}</span>
            <button type="button" class="hub-order-share-btn" data-action="percent-inc" aria-label="Augmenter">+</button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  patchOrdersPanelRows(ordersPanel, view, null);
}

export { clearHubInfoOverlayMode };
