import { setBuildingInfoTitle } from '../../layout/buildingInfoLayout.js';
import { patchHubStoragePieChart, renderHubStoragePieChart } from './hubStoragePieChart.js';
import { goodLabel } from '../../../shell/CatalogVocabulary.js';
import { formatHubStockSummary } from '../../presenters/formats/hubStorageInfoFormat.js';
/**
 * The view the chart draws: a hub that holds several flows of goods (see `storageViews`) draws one flow at a time,
 * the one the player picked; any other hub draws all it holds.
 * @param {object} view
 * @param {string | null} flowId
 */
function chartViewOf(view, flowId) {
  const flow = view.storageViews?.find((candidate) => candidate.id === flowId);
  return flow ? { ...view, pieSegments: flow.pieSegments, currentTotal: flow.total } : view;
}

/** The orders listed under the selected pill: only the goods of that flow (the whole list for a hub that holds one flow). */
function ordersViewOf(view, flowId) {
  const flow = view.storageViews?.find((candidate) => candidate.id === flowId);
  return flow ? { ...view, lines: flow.lines } : view;
}

/** The title over the chart: the flow's own name when the hub has several, else "Stock". */
function chartTitleOf(view, flowId) {
  return view.storageViews?.find((candidate) => candidate.id === flowId)?.label ?? 'Stock';
}

/** The buttons that switch the chart from one flow to another (none when the hub holds a single flow). */
function renderFlowTabs(view, flowId) {
  if (!(view.storageViews?.length > 1)) return '';
  return `<div class="hub-flow-tabs" role="tablist">${view.storageViews
    .map(
      (flow) =>
        `<button type="button" role="tab" class="hub-flow-tab hub-flow-tab--${flow.id}${flow.id === flowId ? ' is-active' : ''}" data-flow="${flow.id}" aria-selected="${flow.id === flowId}">${flow.label}</button>`
    )
    .join('')}</div>`;
}

/** Marks the flow pill that is picked, and unmarks the others. */
function markActiveFlow(root, flowId) {
  root.querySelectorAll('.hub-flow-tab').forEach((button) => {
    const active = button.dataset.flow === flowId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
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
  ordersPanel.querySelector('.hub-orders-warnings').append(el);
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
 * Re-reads the hub from the supply context.
 * @param {object} ctx
 */
async function readFreshHubView(ctx) {
  const { hubKind, buildingId, supply, buildingRow, supplyView } = ctx;
  const freshRow = await supply.getSupplyBuildingRow(buildingId);
  const freshView = await supply.getHubStorageInfoView(hubKind, freshRow ?? buildingRow, {
    stocks: freshRow?.stocks,
    maxStock: supplyView?.maxStock,
    timeContextAhead: ctx.timeContextAhead,
  });
  ctx.buildingRow = freshRow ?? buildingRow;
  ctx.view = freshView;
  return freshView;
}

/** Redraws the chart of the Stockage tab from a fresh view (set while that tab is on screen), so a change made in the Ordres tab shows there too. */
let refreshStorageChart = null;

/**
 * The Stockage tab: how full the hub is (a pie), what it holds, and when it collects.
 *
 * @param {object} params
 */
export async function renderHubStorageInfoPanel({
  container,
  view,
  buildingId,
  supply,
  buildingRow,
  supplyView = null,
  timeContextAhead = null,
}) {
  if (!container || !view) return;

  setBuildingInfoTitle(view.title);

  const ctx = {
    view,
    hubKind: view.hubKind,
    buildingId,
    supply,
    buildingRow,
    supplyView,
    timeContextAhead,
    // The flow whose chart is drawn, for a hub that holds several (null when it holds a single one).
    flowId: view.storageViews?.[0]?.id ?? null,
  };

  container.innerHTML = `
    <div class="hub-info-panel">
      ${renderFlowTabs(view, ctx.flowId)}
      <section class="hub-storage-chart-section${ctx.flowId ? ` hub-storage-chart-section--${ctx.flowId}` : ''}">
        <h3 class="hub-storage-chart-title">${chartTitleOf(view, ctx.flowId)}</h3>
        ${renderHubStoragePieChart(chartViewOf(view, ctx.flowId), formatHubStockSummary(chartViewOf(view, ctx.flowId)))}
      </section>
    </div>
  `;

  const drawChart = () => {
    const chartView = chartViewOf(ctx.view, ctx.flowId);
    patchHubStoragePieChart(container, chartView, formatHubStockSummary(chartView), chartTitleOf(ctx.view, ctx.flowId));
  };

  refreshStorageChart = (freshView) => {
    ctx.view = freshView;
    drawChart();
  };

  container.querySelector('.hub-flow-tabs')?.addEventListener('click', (event) => {
    const tab = /** @type {HTMLElement} */ (event.target).closest('[data-flow]');
    if (!tab || tab.dataset.flow === ctx.flowId) return;
    ctx.flowId = tab.dataset.flow;
    markActiveFlow(container, ctx.flowId);
    const section = container.querySelector('.hub-storage-chart-section');
    if (section) section.className = `hub-storage-chart-section hub-storage-chart-section--${ctx.flowId}`;
    drawChart();
  });
}

/**
 * What each mode does, in the player's words (narrative, written here; the names of the modes come from the hub's own view).
 * A mode without a sentence here is a defect, so it throws.
 */
const MODE_DESCRIPTIONS = Object.freeze({
  accept: "L'entrepôt reçoit ce bien, jusqu'au plafond.",
  refuse: "L'entrepôt n'en reçoit plus ; ce qu'il en garde reste en place.",
  fetch: "Les producteurs qui vendent ce bien viennent d'abord ici, avant l'entrepôt le plus proche.",
  empty: "L'entrepôt donne ce bien aux autres, un peu chaque jour (d'abord à ceux en « Amener », puis aux plus proches), et n'en reçoit plus.",
});

/**
 * The guide to the orders: the cycle of the modes, what each does, what the percentage is, and who wins when goods compete.
 * @param {ReadonlyArray<{ id: string, label: string }>} modes
 */
function renderOrdersGuide(modes) {
  const described = modes.map((mode) => {
    const description = MODE_DESCRIPTIONS[mode.id];
    if (!description) throw new Error(`[hubStorageInfoPanel] the storage mode "${mode.id}" has no description (MODE_DESCRIPTIONS)`);
    return `<dt>${mode.label}</dt><dd>${description}</dd>`;
  });
  return `
    <section class="hub-orders-guide" aria-labelledby="hub-orders-guide-title">
      <h4 id="hub-orders-guide-title" class="hub-orders-guide-title">Les modes</h4>
      <p class="hub-orders-cycle">${modes.map((mode) => `<strong>${mode.label}</strong>`).join(' → ')}</p>
      <dl class="hub-orders-modes">${described.join('')}</dl>
      <p class="hub-orders-note"><strong>Plafond</strong> — le pourcentage est la part de l'entrepôt que ce bien peut remplir au plus.</p>
      <p class="hub-orders-note"><strong>Égalité</strong> — si plusieurs biens sont à 100 % (ou se chevauchent), la place libre va au premier arrivé.</p>
    </section>`;
}

/**
 * The Ordres tab: for each good the hub holds, what it does with it (the mode) and how much of the hub it may fill (the ceiling).
 *
 * @param {object} params
 */
export async function renderHubStorageOrdersPanel({
  container,
  view,
  buildingId,
  supply,
  buildingRow,
  supplyView = null,
  timeContextAhead = null,
}) {
  if (!container || !view) return;

  const ctx = {
    view,
    hubKind: view.hubKind,
    buildingId,
    supply,
    buildingRow,
    supplyView,
    timeContextAhead,
    flowId: view.storageViews?.[0]?.id ?? null,
  };

  container.innerHTML = `
    <div class="hub-info-panel">
      ${renderFlowTabs(view, ctx.flowId)}
      <div class="hub-orders-panel"></div>
    </div>
  `;
  const ordersPanel = container.querySelector('.hub-orders-panel');
  renderHubOrdersPanelShell(ordersPanel, ordersViewOf(ctx.view, ctx.flowId), view.modes);

  /** Reads the hub again and redraws the rows (and the chart of the Stockage tab, which shows the same hub). */
  const refresh = async (orderWarning = null) => {
    const freshView = await readFreshHubView(ctx);
    patchOrdersPanelRows(ordersPanel, ordersViewOf(freshView, ctx.flowId), orderWarning);
    refreshStorageChart?.(freshView);
  };

  container.querySelector('.hub-flow-tabs')?.addEventListener('click', (event) => {
    const tab = /** @type {HTMLElement} */ (event.target).closest('[data-flow]');
    if (!tab || tab.dataset.flow === ctx.flowId) return;
    ctx.flowId = tab.dataset.flow;
    markActiveFlow(container, ctx.flowId);
    renderHubOrdersPanelShell(ordersPanel, ordersViewOf(ctx.view, ctx.flowId), ctx.view.modes);
  });

  ordersPanel.addEventListener('click', async (event) => {
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
      await refresh();
      return;
    }

    if (action === 'percent-dec') {
      const result = await supply.adjustHubStorageOrderShare(ctx.hubKind, buildingId, productId, -1);
      if (result?.ok === false && result.reason === 'stock_exceeds_new_max') {
        const label = line?.label ?? goodLabel(productId);
        const message = `${line?.emoji ?? ''} ${label} : impossible de réduire à ${result.newPercent ?? '?'} % (${result.newMaxCap} unités) — ${result.currentAmount} déjà en stock. Videz d'abord l'espace.`;
        await refresh(message);
        return;
      }
      await refresh();
      return;
    }

    if (action === 'percent-inc') {
      await supply.adjustHubStorageOrderShare(ctx.hubKind, buildingId, productId, 1);
      await refresh();
    }
  });
}

/**
 * @param {HTMLElement} ordersPanel
 * @param {object} view
 * @param {ReadonlyArray<{ id: string, label: string }>} modes
 */
function renderHubOrdersPanelShell(ordersPanel, view, modes) {
  ordersPanel.innerHTML = `
    <div class="hub-orders-warnings"></div>
    <h3 class="hub-orders-title">Ordres de stockage</h3>
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
    ${renderOrdersGuide(modes)}
  `;

  patchOrdersPanelRows(ordersPanel, view, null);
}
