import { getBuildingInfoBody, setBuildingInfoTitle } from '../../layout/buildingInfoLayout.js';
import { patchHubStoragePieChart, renderHubStoragePieChart } from './hubStoragePieChart.js';
import { getResourceRoles, isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { buildingName, goodLabel, scheduleLabel } from '../../../shell/CatalogVocabulary.js';
import { formatHubStockSummary } from '../../presenters/formats/hubStorageInfoFormat.js';

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
 * What the line says of an order to empty: goods are leaving, nothing can take them, or there is nothing left.
 * @param {{ mode: string, amount: number, emptying: 'moving' | 'blocked' | null }} line
 * @returns {{ icon: string, title: string } | null}
 */
function emptyingStatus(line) {
  if (line.mode !== 'empty') return null;
  if (line.emptying === 'blocked') {
    return { icon: '⚠️', title: 'Vidage bloqué : aucun autre entrepôt ne peut prendre ce bien (plein, refusé ou hors service).' };
  }
  if (line.amount <= 0) return { icon: '✓', title: 'Vidé : plus rien à déplacer.' };
  return { icon: '🚚', title: 'Vidage en cours : le stock part vers les autres entrepôts.' };
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

    const status = row.querySelector('[data-role="emptying"]');
    if (status) {
      const emptying = emptyingStatus(line);
      status.textContent = emptying?.icon ?? '';
      status.title = emptying?.title ?? '';
      status.hidden = !emptying;
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
  const body = getBuildingInfoBody();
  if (!body) return null;

  const freshRow = await supply.getSupplyBuildingRow(buildingId);
  const freshView = supply.getHubStorageInfoView(hubKind, freshRow ?? buildingRow, {
    stocks: freshRow?.stocks,
    maxStock: supplyView?.maxStock,
    timeContextAhead: ctx.timeContextAhead,
  });

  ctx.buildingRow = freshRow ?? buildingRow;
  ctx.view = freshView;

  patchHubStoragePieChart(body, freshView, formatHubStockSummary(freshView));

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
  timeContextAhead = null,
  ordersOpen = false,
}) {
  const body = getBuildingInfoBody();
  if (!body || !view) return;

  setBuildingInfoTitle(view.title);

  /** Mutable panel context for soft refresh + event delegation */
  const ctx = {
    view,
    hubKind: view.hubKind,
    buildingId,
    supply,
    buildingRow,
    supplyView,
    timeContextAhead,
  };

  const workerLine = `${view.workers} / ${view.workerNeed} requis`;

  let statusMessage = '';
  if (view.hubKind === 'hub' && supplyView) {
    // When this hub collects is the one its catalog entry declares, in words.
    const collectsWhen = scheduleLabel(getResourceRoles(buildingRow.type).find((entry) => entry.role === 'collector')?.schedule);
    if (!isRoadNeedMet(buildingRow.type, buildingRow.roads)) {
      statusMessage = `⚠️ Sans route, ${buildingName(buildingRow.type)} ne peut pas stocker.`;
    } else if (supplyView.isCollecting) {
      statusMessage = `🟢 Collecte active (${collectsWhen}).`;
    } else {
      statusMessage = `⏸️ En attente — collecte : ${collectsWhen}.`;
    }
  }

  body.innerHTML = `
    <div class="hub-info-panel">
      <div class="hub-info-summary">
        <div class="hub-info-workers">👷 ${workerLine}</div>
        ${statusMessage ? `<p class="hub-info-status">${statusMessage}</p>` : ''}
      </div>
      <section class="hub-storage-chart-section">
        <h3 class="hub-storage-chart-title">Stock</h3>
        ${renderHubStoragePieChart(view, formatHubStockSummary(view))}
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
        const label = line?.label ?? goodLabel(productId);
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
      Mode : Accepter → Refuser → Amener → Vider.
      <strong>Amener</strong> : les producteurs qui vendent ce bien viennent d'abord ici, avant l'entrepôt le plus proche.
      <strong>Vider</strong> : cet entrepôt donne ce bien aux autres, un peu à chaque jour (d'abord ceux en « Amener », puis
      les plus proches), et n'en reçoit plus.
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
          <span class="hub-order-c3-label">${line.label} <span class="hub-order-emptying" data-role="emptying" hidden></span></span>
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
