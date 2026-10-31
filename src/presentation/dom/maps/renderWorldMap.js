import { HAMLET_ACCESS } from '../../../core/persistence/hamlet/hamletAccess.js';
import { goodIcon, goodLabel } from '../shell/CatalogVocabulary.js';
import { satisfactionOf,formatSatisfaction } from '../../../shared/trade-catalog/satisfaction.js';
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
    .map((w) => `<span class="trade-map-good-icon" title="${goodLabel(w.good)}" aria-label="${goodLabel(w.good)}" role="img">${goodIcon(w.good)}</span>`)
    .join('');

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
        <button type="button" class="trade-map-exchanges-btn" data-action="open-city-exchange" title="Échanges et décisions" aria-label="Échanges et décisions">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z"/><path d="M17 9h3v8a2 2 0 0 1-2 2h-1"/><path d="M7 9h7M7 12h7M7 15h4"/></svg>
        </button>
      </div>
      ${status === 'active' ? `
        <p class="trade-map-trade-wants">Demande : <strong>${wantsLine}</strong></p>
        <p class="trade-map-trade-satisfaction">Satisfaction : <strong>${formatSatisfaction(satisfactionOf(relation))}</strong></p>
        <div class="trade-map-trade-recent">
          <p class="trade-map-trade-recent-label">Dernières ventes :</p>
          <ul class="trade-map-trade-sales-list">${salesLines}</ul>
        </div>` : ''}
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
      <div class="map-page-canvas trade-map-canvas world-map-host" id="world-map-host">
        <div id="world-map-view" class="world-map-view" aria-label="Carte hexagonale du monde"></div>
      </div>
      <div class="map-page-panel trade-map-panel" id="world-map-panel">
        ${renderWorldMapPanel(view, panelSelection)}
      </div>
    </div>`;
}

/** Shown where a hamlet could be entered: the map is read-only, the carousel in the game switches hamlet. */
const CHANGE_HAMLET_IN_GAME_NOTE = '<p class="trade-map-panel-active-note">Pour changer de hameau, utilisez le carrousel dans le jeu.</p>';

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

  // The map only shows; changing hamlet happens in the game, with the hamlet carousel (no page load).
  if (hamlet.access === HAMLET_ACCESS.active) {
    statusText = 'Hameau actif';
    statusClass = 'open';
    actionHtml = CHANGE_HAMLET_IN_GAME_NOTE;
  } else if (hamlet.access === HAMLET_ACCESS.unlocked) {
    statusText = 'Accessible';
    statusClass = 'open';
    actionHtml = CHANGE_HAMLET_IN_GAME_NOTE;
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

  return cityPanel;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 */
export function renderWorldMapStats(view) {
  return `${view.kingdom.unlockedHamlets}/${view.kingdom.totalHamlets} hameaux`;
}

/** @deprecated Use renderWorldMapShell */
export function renderWorldMapPage(view, selection) {
  return renderWorldMapShell(view, selection);
}
