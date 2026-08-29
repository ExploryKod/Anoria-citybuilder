import { renderTradeMapPanelForCity } from '../admin/commerce/renderTradeMap.js';

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 */
export function renderWorldMapToolbar(view) {
  const openRoutes = view.partners.filter((partner) => partner.isActive).length;
  const influencePercent = Math.round(view.kingdom.influence * 100);

  return `
    <div class="map-page-toolbar trade-map-toolbar">
      <span class="trade-map-toolbar-title">Carte du monde</span>
      <span class="trade-map-toolbar-stats" id="world-map-stats">
        ${openRoutes}/${view.partners.length} routes · Royaume ${influencePercent}%
      </span>
      <nav class="map-page-nav" aria-label="Navigation cartes">
        <a href="/hamlets" class="map-page-nav-link">Royaume</a>
        <a href="/game" class="map-page-nav-link">Partie</a>
      </nav>
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 * @param {string | null} selectedCityId
 */
export function renderWorldMapShell(view, selectedCityId) {
  const selected = selectedCityId ?? 'anoria';

  return `
    ${renderWorldMapToolbar(view)}
    <div class="map-page-body">
      <div class="map-page-canvas trade-map-canvas world-phaser-host" id="world-phaser-host">
        <div id="world-phaser-root" class="world-phaser-root" aria-label="Carte hexagonale du monde"></div>
        <p class="world-phaser-hint">Molette : zoom · Glisser : déplacer · Survol : coordonnées hex</p>
      </div>
      <div class="map-page-panel trade-map-panel" id="world-map-panel">
        ${renderTradeMapPanelForCity(selected, view.partners)}
      </div>
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 */
export function renderWorldMapStats(view) {
  const openRoutes = view.partners.filter((partner) => partner.isActive).length;
  const influencePercent = Math.round(view.kingdom.influence * 100);
  return `${openRoutes}/${view.partners.length} routes · Royaume ${influencePercent}%`;
}

/** @deprecated Use renderWorldMapShell — Phaser canvas replaces SVG stage */
export function renderWorldMapPage(view, selectedCityId) {
  return renderWorldMapShell(view, selectedCityId);
}
