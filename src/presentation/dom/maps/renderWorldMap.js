import {
  renderTradeMapPanelForCity,
  renderTradeMapStageContent,
} from '../admin/commerce/renderTradeMap.js';

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildWorldMapView.js').buildWorldMapView>>} view
 * @param {string | null} selectedCityId
 */
export function renderWorldMapPage(view, selectedCityId) {
  const selected = selectedCityId ?? 'anoria';
  const openRoutes = view.partners.filter((partner) => partner.isActive).length;
  const influencePercent = Math.round(view.kingdom.influence * 100);

  return `
    <div class="map-page-toolbar trade-map-toolbar">
      <span class="trade-map-toolbar-title">Carte du monde</span>
      <span class="trade-map-toolbar-stats">
        ${openRoutes}/${view.partners.length} routes · Royaume ${influencePercent}%
      </span>
      <nav class="map-page-nav" aria-label="Navigation cartes">
        <a href="/hamlets" class="map-page-nav-link">Royaume</a>
        <a href="/game" class="map-page-nav-link">Partie</a>
      </nav>
    </div>
    <div class="map-page-body">
      <div class="map-page-canvas trade-map-canvas" id="world-map-canvas">
        <div class="world-map-kingdom-ring" style="left:${view.kingdom.map.x}%;top:${view.kingdom.map.y}%;--world-influence:${view.kingdom.influence}" aria-hidden="true"></div>
        ${renderTradeMapStageContent(view.partners, selected)}
      </div>
      <div class="map-page-panel trade-map-panel" id="world-map-panel">
        ${renderTradeMapPanelForCity(selected, view.partners)}
      </div>
    </div>`;
}
