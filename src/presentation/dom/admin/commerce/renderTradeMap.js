const UNITS_PER_QUOTA_SQUARE = 5;

/** @type {Record<string, { left: string, top: string, icon: string }>} */
export const TRADE_MAP_POSITIONS = {
  anoria: { left: '50%', top: '48%', icon: '🏛️' },
  olivea: { left: '22%', top: '32%', icon: '🫒' },
  silvania: { left: '78%', top: '28%', icon: '🌲' },
};

/**
 * @param {number} current
 * @param {number} max
 */
function renderQuotaBar(current, max) {
  const squareCount = Math.max(1, Math.ceil(max / UNITS_PER_QUOTA_SQUARE));
  const filledSquares = Math.floor(current / UNITS_PER_QUOTA_SQUARE);
  const partial = current % UNITS_PER_QUOTA_SQUARE;
  const squares = Array.from({ length: squareCount }, (_, index) => {
    if (index < filledSquares) return 'full';
    if (index === filledSquares && partial > 0) return 'partial';
    return 'empty';
  });

  return `
    <div class="trade-map-quota-bar" aria-label="${current}/${max}">
      ${squares
        .map((state) => `<span class="trade-map-quota-square trade-map-quota-square--${state}"></span>`)
        .join('')}
    </div>`;
}

/**
 * @param {object} tradeLine
 * @param {'sold'|'bought'} direction
 */
function renderTradeRow(tradeLine, direction) {
  const label = direction === 'sold' ? 'Vendu' : 'Acheté';
  return `
    <div class="trade-map-trade-row ${tradeLine.isUnavailable ? 'unavailable' : ''}">
      <span class="trade-map-trade-label">${label}</span>
      <span class="trade-map-trade-product">${tradeLine.productName}</span>
      <span class="trade-map-trade-count">${tradeLine.currentYearly}/${tradeLine.yearlyQuota}</span>
      ${renderQuotaBar(tradeLine.currentYearly, tradeLine.yearlyQuota)}
    </div>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>[number]} partner
 */
export function renderTradeMapBottomPanel(partner) {
  if (!partner) {
    return `
      <div class="trade-map-panel-empty">
        <p>Sélectionnez une ville sur la carte</p>
      </div>`;
  }

  const soldRows = partner.buysFromUs.map((line) => renderTradeRow(line, 'sold')).join('');
  const boughtRows = partner.sellsToUs.map((line) => renderTradeRow(line, 'bought')).join('');
  const conditionsText = partner.canActivate
    ? ''
    : `<p class="trade-map-panel-conditions">${partner.unmetConditions.join(' · ')}</p>`;

  return `
    <div class="trade-map-panel-inner" data-partner-id="${partner.id}">
      <div class="trade-map-panel-header">
        <h3 class="trade-map-panel-city">${partner.name}</h3>
        <span class="trade-map-panel-route ${partner.isActive ? 'open' : 'closed'}">
          ${partner.isActive ? 'Route ouverte' : 'Route fermée'}
        </span>
      </div>
      <p class="trade-map-panel-desc">${partner.description}</p>
      <div class="trade-map-panel-trades">
        ${soldRows}${boughtRows}
        ${
          soldRows === '' && boughtRows === ''
            ? '<p class="trade-map-panel-no-trades">Aucune offre commerciale</p>'
            : ''
        }
      </div>
      ${
        partner.isActive
          ? `
      <p class="trade-map-panel-active-note">
        Commerce automatique actif — les quotas se réinitialisent chaque année.
      </p>`
          : `
      ${conditionsText}
      <button class="partner-activation-btn trade-map-open-route-btn"
              data-partner-id="${partner.id}"
              ${partner.canActivate ? '' : 'disabled'}>
        Ouvrir la route (500 €)
      </button>`
      }
    </div>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedPartnerId
 */
export function renderPartnerMarkers(partners, selectedPartnerId) {
  return partners
    .map((partner) => {
      const pos = TRADE_MAP_POSITIONS[partner.id] ?? { left: '50%', top: '20%', icon: '🏘️' };
      const isSelected = partner.id === selectedPartnerId;
      const routeClass = partner.isActive ? 'route-open' : 'route-closed';
      return `
    <button type="button"
            class="trade-map-city trade-map-city--partner ${routeClass}${isSelected ? ' selected' : ''}"
            style="left:${pos.left};top:${pos.top}"
            data-partner-id="${partner.id}"
            aria-label="${partner.name}"
            aria-pressed="${isSelected}">
      <span class="trade-map-city-icon">${pos.icon}</span>
      <span class="trade-map-city-name">${partner.name}</span>
    </button>`;
    })
    .join('');
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedPartnerId
 */
export function renderTradeMapMarkers(partners, selectedPartnerId) {
  const playerPos = TRADE_MAP_POSITIONS.anoria;
  const playerMarker = `
    <div class="trade-map-city trade-map-city--player" style="left:${playerPos.left};top:${playerPos.top}">
      <span class="trade-map-city-icon">${playerPos.icon}</span>
      <span class="trade-map-city-name">Anoria</span>
    </div>`;

  return playerMarker + renderPartnerMarkers(partners, selectedPartnerId);
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedPartnerId
 */
export function renderTradeMapOverlay(partners, selectedPartnerId) {
  const selected = partners.find((p) => p.id === selectedPartnerId) ?? partners[0] ?? null;
  const openRoutes = partners.filter((p) => p.isActive).length;

  return `
    <div class="trade-map-overlay" id="trade-map-overlay" role="dialog" aria-modal="true" aria-label="Carte commerciale">
      <div class="trade-map-toolbar">
        <span class="trade-map-toolbar-title">Empire — Routes commerciales</span>
        <span class="trade-map-toolbar-stats">${openRoutes}/${partners.length} routes ouvertes</span>
        <button type="button" class="trade-map-close-btn" id="trade-map-close-btn" aria-label="Fermer la carte">✕</button>
      </div>
      <div class="trade-map-canvas" id="trade-map-canvas">
        <div class="trade-map-terrain"></div>
        <div class="trade-map-coast trade-map-coast--west"></div>
        <div class="trade-map-coast trade-map-coast--east"></div>
        <div class="trade-map-roads"></div>
        ${renderTradeMapMarkers(partners, selected?.id ?? null)}
      </div>
      <div class="trade-map-panel" id="trade-map-panel">
        ${renderTradeMapBottomPanel(selected)}
      </div>
    </div>`;
}
