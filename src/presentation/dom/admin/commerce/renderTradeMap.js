import {
  TRADE_MAP_CITIES,
  TRADE_MAP_CONNECTIONS,
  TRADE_MAP_CITY_CATEGORY_LABELS,
  TRADE_MAP_CITY_CATEGORIES,
  cityHasCommercialRoute,
  cityShowsOnTradeMapRoutes,
  getTradeMapCityById,
} from '../../../../contexts/commerce/domain/catalogs/TradeMapCityCatalog.js';

const UNITS_PER_QUOTA_SQUARE = 5;

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
 * @param {string} category
 */
function renderCategoryBadge(category) {
  const label = TRADE_MAP_CITY_CATEGORY_LABELS[category];
  if (!label) return '';
  return `<span class="trade-map-panel-category trade-map-panel-category--${category}">${label}</span>`;
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
        <div class="trade-map-panel-title-group">
          <h3 class="trade-map-panel-city">${partner.name}</h3>
          ${partner.cityCategory ? renderCategoryBadge(partner.cityCategory) : ''}
        </div>
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
 * @param {{ id: string, name: string, category: string, description?: string }} city
 */
export function renderTradeMapCityPanel(city) {
  const categoryLabel = TRADE_MAP_CITY_CATEGORY_LABELS[city.category];
  const isEnemy = city.category === TRADE_MAP_CITY_CATEGORIES.enemy;
  const isNonCommercial = city.category === TRADE_MAP_CITY_CATEGORIES.nonCommercial;
  const isOwned = city.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial;

  let statusText = '';
  let statusClass = '';
  if (city.id === 'anoria') {
    statusText = 'Capitale';
    statusClass = 'capital';
  } else if (isOwned) {
    statusText = 'Route ouverte — territoire Anoria';
    statusClass = 'open';
  } else if (isEnemy) {
    statusText = 'Aucune route commerciale';
    statusClass = 'hostile';
  } else if (isNonCommercial) {
    statusText = 'Commerce non ouvert';
    statusClass = 'potential';
  }

  return `
    <div class="trade-map-panel-inner" data-city-id="${city.id}">
      <div class="trade-map-panel-header">
        <div class="trade-map-panel-title-group">
          <h3 class="trade-map-panel-city">${city.name}</h3>
          ${categoryLabel ? renderCategoryBadge(city.category) : ''}
        </div>
        ${statusText ? `<span class="trade-map-panel-route ${statusClass}">${statusText}</span>` : ''}
      </div>
      ${city.description ? `<p class="trade-map-panel-desc">${city.description}</p>` : ''}
      ${
        isNonCommercial
          ? '<p class="trade-map-panel-active-note">Une route commerciale pourra être négociée ultérieurement.</p>'
          : ''
      }
      ${
        isEnemy
          ? '<p class="trade-map-panel-conditions">Aucun échange possible pour l\'instant.</p>'
          : ''
      }
    </div>`;
}

/**
 * @param {string} selectedCityId
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 */
export function renderTradeMapPanelForCity(selectedCityId, partners) {
  const city = getTradeMapCityById(selectedCityId);
  if (!city) {
    return renderTradeMapBottomPanel(null);
  }

  if (city.partnerId) {
    const partner = partners.find((item) => item.id === city.partnerId);
    if (partner) {
      return renderTradeMapBottomPanel(partner);
    }
  }

  return renderTradeMapCityPanel(city);
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string} fromId
 * @param {string} toId
 */
function isConnectionActive(partners, fromId, toId) {
  const fromCity = getTradeMapCityById(fromId);
  const toCity = getTradeMapCityById(toId);
  const partnerIds = [fromCity?.partnerId, toCity?.partnerId].filter(Boolean);

  if (partnerIds.length === 0) {
    if (
      fromCity?.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial
      || toCity?.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial
    ) {
      return true;
    }
    return false;
  }

  return partnerIds.some((partnerId) => {
    const partner = partners.find((item) => item.id === partnerId);
    return partner?.isActive === true;
  });
}

/**
 * @param {object} city
 */
function getCityRouteGap(city) {
  if (city.id === 'anoria') return 4.2;
  return 3.6;
}

/**
 * Courbe légère entre deux villes — espace aux extrémités, direction lisible.
 * @param {object} from
 * @param {object} to
 * @param {{ curveSign?: number }} [opts]
 */
function buildCurvedRoutePath(from, to, opts = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const gapFrom = getCityRouteGap(from);
  const gapTo = getCityRouteGap(to);

  if (len < gapFrom + gapTo + 0.5) return null;

  const ux = dx / len;
  const uy = dy / len;
  const x1 = from.x + ux * gapFrom;
  const y1 = from.y + uy * gapFrom;
  const x2 = to.x - ux * gapTo;
  const y2 = to.y - uy * gapTo;

  const px = -uy;
  const py = ux;
  const curveStrength = Math.min(len * 0.07, 2.2);
  const sign = opts.curveSign ?? 1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const cx = midX + px * curveStrength * sign;
  const cy = midY + py * curveStrength * sign;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * @param {string} fromId
 * @param {string} toId
 */
function routeCurveSign(fromId, toId) {
  const key = `${fromId}-${toId}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash += key.charCodeAt(i);
  }
  return hash % 2 === 0 ? 1 : -1;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 */
export function renderTradeMapConnections(partners) {
  const paths = TRADE_MAP_CONNECTIONS.map((link) => {
    const from = getTradeMapCityById(link.from);
    const to = getTradeMapCityById(link.to);
    if (!from || !to) return '';

    if (!cityShowsOnTradeMapRoutes(from) || !cityShowsOnTradeMapRoutes(to)) {
      return '';
    }

    const active = isConnectionActive(partners, link.from, link.to);
    const kindClass = `trade-map-link--${link.kind}${active ? ' trade-map-link--active' : ''}`;
    const pathD = buildCurvedRoutePath(from, to, {
      curveSign: routeCurveSign(link.from, link.to),
    });
    if (!pathD) return '';

    return `<path class="trade-map-link ${kindClass}" d="${pathD}" />`;
  });

  return `
    <svg class="trade-map-links" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${paths.join('')}
    </svg>`;
}

/**
 * @param {object} city
 * @param {object | null | undefined} partner
 */
function buildCityTooltip(city, partner) {
  const parts = [city.name];

  if (city.category === 'capital') {
    parts.push('Capitale');
  } else {
    const categoryLabel = TRADE_MAP_CITY_CATEGORY_LABELS[city.category];
    if (categoryLabel) parts.push(categoryLabel);
  }

  if (partner) {
    parts.push(partner.isActive ? 'Route ouverte' : 'Route fermée');
  } else if (city.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial) {
    parts.push('Route ouverte');
  } else if (city.category === TRADE_MAP_CITY_CATEGORIES.enemy) {
    parts.push('Aucune route commerciale');
  } else if (city.category === TRADE_MAP_CITY_CATEGORIES.nonCommercial) {
    parts.push('Commerce non ouvert');
  }

  return parts.join(' · ');
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedCityId
 */
export function renderTradeMapCities(partners, selectedCityId) {
  return TRADE_MAP_CITIES.map((city) => {
    const isPlayer = city.id === 'anoria';
    const isSelected = city.id === selectedCityId;
    const partner = city.partnerId
      ? partners.find((item) => item.id === city.partnerId)
      : null;
    const routeOpen = partner?.isActive
      || city.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial;
    const tooltip = buildCityTooltip(city, partner);
    const hasCommercialRoute = cityHasCommercialRoute(city);

    const classes = [
      'trade-map-city',
      isPlayer ? 'trade-map-city--player' : 'trade-map-city--settlement',
      `trade-map-city--cat-${city.category}`,
      hasCommercialRoute
        ? (routeOpen ? 'route-open' : 'route-closed')
        : 'route-none',
      isSelected ? 'selected' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const tag = isPlayer ? 'div' : 'button';
    const attrs = isPlayer
      ? ` title="${tooltip}" aria-label="${tooltip}"`
      : ` type="button" data-city-id="${city.id}" aria-pressed="${isSelected}" title="${tooltip}" aria-label="${tooltip}"`;

    const labelAnchor = city.labelAnchor ?? 'bottom';

    return `
      <${tag} class="${classes}" style="left:${city.x}%;top:${city.y}%"${attrs}>
        <span class="trade-map-city-node" aria-hidden="true"></span>
        <span class="trade-map-city-label trade-map-city-label--${labelAnchor}">${city.name}</span>
        <span class="trade-map-city-tooltip" role="tooltip">${tooltip}</span>
      </${tag}>`;
  }).join('');
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedCityId
 */
export function renderTradeMapCanvasContent(partners, selectedCityId) {
  return `
    <div class="trade-map-world" aria-hidden="true">
      <div class="trade-map-sheet"></div>
      <div class="trade-map-grid-lines"></div>
      <div class="trade-map-compass" aria-hidden="true">
        <span class="trade-map-compass-n">N</span>
        <span class="trade-map-compass-rose"></span>
      </div>
    </div>
    <div class="trade-map-layer">
      ${renderTradeMapConnections(partners)}
      ${renderTradeMapCities(partners, selectedCityId)}
    </div>`;
}

/**
 * Contenu carte dans un cadre proportionnel (mobile → desktop).
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedCityId
 */
export function renderTradeMapStageContent(partners, selectedCityId) {
  return `
    <div class="trade-map-stage">
      ${renderTradeMapCanvasContent(partners, selectedCityId)}
    </div>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 * @param {string|null} selectedCityId
 */
export function renderTradeMapOverlay(partners, selectedCityId) {
  const openRoutes = partners.filter((p) => p.isActive).length;
  const selected = selectedCityId ?? 'anoria';

  return `
    <div class="trade-map-overlay" id="trade-map-overlay" role="dialog" aria-modal="true" aria-label="Carte commerciale" tabindex="-1">
      <div class="trade-map-toolbar">
        <span class="trade-map-toolbar-title">Routes commerciales</span>
        <span class="trade-map-toolbar-stats">${openRoutes}/${partners.length} routes ouvertes</span>
        <button type="button" class="trade-map-close-btn" id="trade-map-close-btn" title="Fermer la carte" aria-label="Fermer la carte">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/></svg>
        </button>
      </div>
      <div class="trade-map-canvas" id="trade-map-canvas">
        ${renderTradeMapStageContent(partners, selected)}
      </div>
      <div class="trade-map-panel" id="trade-map-panel">
        ${renderTradeMapPanelForCity(selected, partners)}
      </div>
    </div>`;
}

/** @deprecated Use renderTradeMapCities */
export function renderPartnerMarkers(partners, selectedPartnerId) {
  const city = selectedPartnerId
    ? TRADE_MAP_CITIES.find((item) => item.partnerId === selectedPartnerId)
    : null;
  return renderTradeMapCities(partners, city?.id ?? null);
}

/** @deprecated Use renderTradeMapCities */
export function renderTradeMapMarkers(partners, selectedPartnerId) {
  const city = selectedPartnerId
    ? TRADE_MAP_CITIES.find((item) => item.partnerId === selectedPartnerId)
    : null;
  return renderTradeMapStageContent(partners, city?.id ?? null);
}

/** Legacy export for positions */
export const TRADE_MAP_POSITIONS = Object.fromEntries(
  TRADE_MAP_CITIES.map((city) => [
    city.id,
    { left: `${city.x}%`, top: `${city.y}%` },
  ]),
);
