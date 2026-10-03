import { HAMLET_ACCESS } from '../../../core/persistence/hamlet/hamletAccess.js';
import {
  WORLD_CITY_CATEGORY_LABELS,
  getWorldCityById,
} from '../../../composition/worldCityCatalog.js';

const RELATION_STATUS_LABEL = { active: 'Commerce actif', suspended: 'Suspendu', expired: 'Expiré' };
const RELATION_STATUS_CLASS = { active: 'open', suspended: 'closed', expired: 'closed' };

/**
 * @param {string} cityId
 * @param {object|null} [tradeInfo]
 */
function renderCityPanel(cityId, tradeInfo = null) {
  const city = getWorldCityById(cityId);
  if (!city) {
    return `
      <div class="trade-map-panel-empty">
        <p>Sélectionnez une ville sur la carte</p>
      </div>`;
  }

  const categoryLabel = WORLD_CITY_CATEGORY_LABELS[city.category] ?? '';
  const tradeBlock = tradeInfo ? renderTradeBlock(tradeInfo) : '';

  return `
    <div class="trade-map-panel-inner" data-city-id="${city.id}">
      <div class="trade-map-panel-header">
        <div class="trade-map-panel-title-group">
          <h3 class="trade-map-panel-city">${city.name}</h3>
        </div>
        ${categoryLabel ? `<span class="trade-map-panel-category">${categoryLabel}</span>` : ''}
      </div>
      ${city.description ? `<p class="trade-map-panel-desc">${city.description}</p>` : ''}
      ${tradeBlock}
    </div>`;
}

/**
 * @param {{ relation: object|null, entry: object|null, sales: object[] }} tradeInfo
 */
function renderTradeBlock({ relation, entry, sales }) {
  if (!entry) return '';

  const status = relation?.status ?? null;
  const statusLabel = status ? (RELATION_STATUS_LABEL[status] ?? status) : 'Pas de relation';
  const statusClass = status ? (RELATION_STATUS_CLASS[status] ?? 'closed') : 'closed';

  const wantsLine = entry.wants
    .map((w) => w.good)
    .join(', ');

  // Last-month sales summary — quick glance only; the full log lives in the exchange modal.
  const lastMonthSales = sales.slice(0, entry.wants.length * 2);
  const salesLines = lastMonthSales.length > 0
    ? lastMonthSales.map((s) => {
        const qty = s.quantity ?? 0;
        const customs = s.customsCollected ?? 0;
        return `<li>${s.good ?? s.foodType} — ${qty} unités · douane <strong>${customs} €</strong></li>`;
      }).join('')
    : '<li>Aucune vente récente</li>';

  return `
    <div class="trade-map-trade-block">
      <div class="trade-map-trade-header">
        <span class="trade-map-panel-route ${statusClass}">${statusLabel}</span>
      </div>
      ${status === 'active' ? `
        <p class="trade-map-trade-wants">Demande : <strong>${wantsLine}</strong></p>
        <p class="trade-map-trade-satisfaction">Satisfaction : <strong>${relation.satisfactionScore ?? 50}/100</strong></p>
        <div class="trade-map-trade-recent">
          <p class="trade-map-trade-recent-label">Dernières ventes :</p>
          <ul class="trade-map-trade-sales-list">${salesLines}</ul>
        </div>` : ''}
      <button type="button" class="trade-map-exchanges-btn" data-action="open-city-exchange">Échanges</button>
    </div>`
;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 * @param {{ cityId?: string | null, hamletId?: string | null }} selection
 */
export function renderWorldMapShell(view, selection = {}) {
  const panelSelection = {
    cityId: selection.hamletId ? null : (selection.cityId ?? 'anoria'),
    hamletId: selection.hamletId ?? null,
  };

  return `
    <div class="map-page-body">
      <div class="map-page-canvas trade-map-canvas world-phaser-host" id="world-phaser-host">
        <div id="world-phaser-root" class="world-phaser-root" aria-label="Carte hexagonale du monde"></div>
      </div>
      <div class="map-page-panel trade-map-panel" id="world-map-panel">
        ${renderWorldMapPanel(view, panelSelection)}
      </div>
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 * @param {string | null} hamletId
 */
export function renderWorldHamletPanel(view, hamletId) {
  const hamlet = view.hamlets.find((item) => item.id === hamletId);
  if (!hamlet) {
    return `
      <div class="trade-map-panel-empty">
        <p>Sélectionnez un hameau sur la carte</p>
      </div>`;
  }

  let statusText = 'Verrouillé';
  let statusClass = 'closed';
  let actionHtml = '<p class="trade-map-panel-active-note">Ce hameau n’est pas encore accessible.</p>';

  if (hamlet.access === HAMLET_ACCESS.active) {
    statusText = 'Hameau actif';
    statusClass = 'open';
    actionHtml = `
      <a href="/game/${hamlet.id}" class="site-btn site-btn--primary site-btn--inline world-map-enter-btn" title="Entrer dans le hameau">
        Entrer
      </a>`;
  } else if (hamlet.access === HAMLET_ACCESS.unlocked) {
    statusText = 'Accessible';
    statusClass = 'open';
    actionHtml = `
      <button type="button" class="site-btn site-btn--primary site-btn--inline world-map-travel-btn" data-hamlet-id="${hamlet.id}" title="Voyager vers ce hameau">
        Voyager
      </button>`;
  }

  return `
    <div class="trade-map-panel-inner" data-hamlet-id="${hamlet.id}">
      <div class="trade-map-panel-header">
        <div class="trade-map-panel-title-group">
          <h3 class="trade-map-panel-city">${hamlet.name}</h3>
        </div>
        <span class="trade-map-panel-route ${statusClass}">${statusText}</span>
      </div>
      <p class="trade-map-panel-desc">
        ${hamlet.natureSeeded ? 'Nature déjà semée sur ce site.' : 'Site encore vierge — la nature sera générée au premier voyage.'}
      </p>
      ${actionHtml}
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 * @param {{ cityId?: string | null, hamletId?: string | null }} selection
 * @param {object|null} [tradeInfo]
 */
export function renderWorldMapPanel(view, selection = {}, tradeInfo = null) {
  if (selection.hamletId) {
    return renderWorldHamletPanel(view, selection.hamletId);
  }

  const cityId = selection.cityId ?? 'anoria';
  const cityPanel = renderCityPanel(cityId, tradeInfo);

  if (cityId !== 'anoria') {
    return cityPanel;
  }

  return `
    ${cityPanel}
    <a href="/game/${view.activeHamletId}" class="site-btn site-btn--primary site-btn--inline world-map-enter-btn" title="Entrer dans le hameau actif">
      Entrer
    </a>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 */
export function renderWorldMapStats(view) {
  const influencePercent = Math.round(view.kingdom.influence * 100);
  return `${view.kingdom.unlockedHamlets}/${view.kingdom.totalHamlets} hameaux · Royaume ${influencePercent}%`;
}

/** @deprecated Use renderWorldMapShell */
export function renderWorldMapPage(view, selection) {
  return renderWorldMapShell(view, selection);
}
