/**
 * @param {import('../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView extends (...args: infer A) => infer R ? R extends Array<infer Item> ? Item : never : never} tradeLine
 */
function renderTradeLine(tradeLine, directionLabel) {
  return `
    <div class="partner-trade-item ${tradeLine.statusClass} ${tradeLine.isUnavailable ? 'unavailable' : ''}">
      <div class="partner-trade-header">
        <span class="partner-trade-product">${tradeLine.productName}</span>
        <span class="partner-trade-status ${tradeLine.statusClass}">${tradeLine.statusText}</span>
      </div>
      <div class="partner-trade-details">
        <div class="partner-trade-detail">
          <span class="detail-label">${directionLabel}:</span>
          <span class="detail-value">${tradeLine.pricePerUnit} € / panier</span>
        </div>
        <div class="partner-trade-detail">
          <span class="detail-label">Mois:</span>
          <span class="detail-value">${tradeLine.monthsText}</span>
        </div>
        ${
          tradeLine.maxPerTurn > 1
            ? `
        <div class="partner-trade-detail">
          <span class="detail-label">Max/tour:</span>
          <span class="detail-value">${tradeLine.maxPerTurn}</span>
        </div>`
            : ''
        }
        <div class="partner-trade-detail">
          <span class="detail-label">Quota annuel (ville):</span>
          <span class="detail-value ${tradeLine.statusClass === 'quota-reached' ? 'quota-reached' : ''}">${tradeLine.currentYearly}/${tradeLine.yearlyQuota}</span>
        </div>
        <div class="partner-trade-detail">
          <span class="detail-label">Plafond global:</span>
          <span class="detail-value ${tradeLine.statusClass === 'limit-reached' ? 'limit-reached' : ''}">${tradeLine.globalUsed}/${tradeLine.globalCap}</span>
        </div>
      </div>
    </div>`;
}

/**
 * @param {ReturnType<import('../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>[number]} partner
 */
export function renderTradePartnerCard(partner) {
  const buysFromUsHtml = partner.buysFromUs
    .map((trade) => renderTradeLine(trade, 'Prix d\'achat'))
    .join('');
  const sellsToUsHtml = partner.sellsToUs
    .map((trade) => renderTradeLine(trade, 'Prix de vente'))
    .join('');

  const conditionsText = partner.canActivate
    ? '✅ Toutes les conditions sont remplies'
    : partner.unmetConditions.join(' | ');

  return `
    <div class="commerce-partner-item ${partner.isActive ? 'active' : 'inactive'}" data-partner-id="${partner.id}">
      <div class="commerce-partner-header">
        <h4 class="commerce-partner-name">${partner.name}</h4>
        <p class="commerce-partner-description">${partner.description}</p>
      </div>

      <div class="commerce-partner-activation">
        <div class="partner-activation-status">
          <span class="status-label">Route:</span>
          <span class="status-value ${partner.isActive ? 'active' : 'inactive'}">
            ${partner.isActive ? '✅ Ouverte' : '❌ Fermée'}
          </span>
        </div>
        ${
          partner.isActive
            ? `
        <div class="partner-contract-info" style="background: #fff3cd; padding: 10px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #ffc107;">
          <div style="font-weight: 600; color: #856404; margin-bottom: 5px;">Commerce automatique actif</div>
          <div style="font-size: 13px; color: #856404;">
            Les échanges se font chaque mois selon les saisons et quotas. La route reste ouverte : les quotas se réinitialisent chaque année.
          </div>
        </div>`
            : ''
        }
        ${
          !partner.isActive
            ? `
        <button class="partner-activation-btn"
                id="activation-btn-${partner.id}"
                data-partner-id="${partner.id}"
                data-partner-active="false"
                ${partner.canActivate ? '' : 'disabled'}>
          Ouvrir la route (500 €)
        </button>`
            : ''
        }
        <div class="partner-activation-conditions" id="conditions-${partner.id}">
          <span class="conditions-label">Conditions:</span>
          <span class="conditions-value" id="conditions-value-${partner.id}" style="color: ${partner.canActivate ? '#28a745' : '#dc3545'}">${conditionsText}</span>
        </div>
      </div>

      <div class="commerce-partner-trades ${!partner.isActive ? 'disabled' : ''}">
        ${
          partner.buysFromUs.length > 0
            ? `
        <div class="partner-trades-section">
          <h5 class="partner-trades-title">Achète chez nous (nos exports)</h5>
          ${buysFromUsHtml}
        </div>`
            : ''
        }
        ${
          partner.sellsToUs.length > 0
            ? `
        <div class="partner-trades-section">
          <h5 class="partner-trades-title">Vend chez eux (nos imports)</h5>
          ${sellsToUsHtml}
        </div>`
            : ''
        }
        ${
          partner.buysFromUs.length === 0 && partner.sellsToUs.length === 0
            ? `
        <div class="partner-no-trades">
          <p>Aucune offre commerciale</p>
        </div>`
            : ''
        }
      </div>
    </div>`;
}

/**
 * @param {ReturnType<import('../../../contexts/commerce/application/queries/GetTradePartnersView.js').buildTradePartnersView>} partners
 */
export function renderTradePartnersList(partners) {
  return partners.map((partner) => renderTradePartnerCard(partner)).join('');
}
