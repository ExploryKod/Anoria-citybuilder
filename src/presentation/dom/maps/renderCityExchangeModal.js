import { goodLabel } from '../shell/CatalogVocabulary.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';

/**
 * The "Échanges" modal — a city's full commerce history, one row per merchant_sale transaction
 * (see SupplyTraceability.recordMerchantSale). Separate from the building-info-panel system on
 * purpose (a city is not a building — no buildingRow/supplyView/construction context to fake), but
 * it reuses the same shared bits that were never building-specific to begin with: modalFocus.js's
 * focus trap, and the same tab-strip markup shape (see world.html) so a later tab (diplomacy…) is
 * just another button + panel, same as the building panel's own tabs.
 */

/**
 * One transaction row for the Commerce tab table.
 * @param {object} sale A stored merchant_sale record (extra fields spread onto it — see
 *   DexieSupplyTraceabilityRepository.addTransaction): { turn, good, quantity, price,
 *   grossRevenue, customsCollected, customsRate, netRevenue }.
 * @returns {string}
 */
function renderSaleRow(sale) {
  const when = TimeManager.formatTime(sale.turn);
  const good = goodLabel(sale.good ?? sale.foodType);
  const quantity = sale.quantity ?? 0;
  const unitPrice = sale.price ?? 0;
  const gross = sale.grossRevenue ?? 0;
  const customsRate = Math.round((sale.customsRate ?? 0) * 100);
  const customs = sale.customsCollected ?? 0;
  const net = sale.netRevenue ?? 0;

  return `
    <tr>
      <td>${when}</td>
      <td>${good}</td>
      <td>${quantity}</td>
      <td>${unitPrice.toLocaleString('fr-FR')} €</td>
      <td>${gross.toLocaleString('fr-FR')} €</td>
      <td>${customs.toLocaleString('fr-FR')} € (${customsRate} %)</td>
      <td>${net.toLocaleString('fr-FR')} €</td>
    </tr>`;
}

/**
 * @param {ReadonlyArray<object>} sales Every merchant_sale record for this city, newest first
 *   (see DexieSupplyTraceabilityRepository.getMerchantSalesForCity).
 * @returns {string}
 */
export function renderCityCommerceTab(sales) {
  if (!sales || sales.length === 0) {
    return '<p class="city-exchange-empty">Aucun échange commercial pour le moment.</p>';
  }

  const totalGross = sales.reduce((sum, s) => sum + (s.grossRevenue ?? 0), 0);
  const totalCustoms = sales.reduce((sum, s) => sum + (s.customsCollected ?? 0), 0);
  const totalNet = sales.reduce((sum, s) => sum + (s.netRevenue ?? 0), 0);

  const rows = sales.map(renderSaleRow).join('');

  return `
    <div class="city-exchange-summary">
      <span>${sales.length} transaction${sales.length > 1 ? 's' : ''}</span>
      <span>Brut total : <strong>${totalGross.toLocaleString('fr-FR')} €</strong></span>
      <span>Douane totale : <strong>${totalCustoms.toLocaleString('fr-FR')} €</strong></span>
      <span>Net marchands total : <strong>${totalNet.toLocaleString('fr-FR')} €</strong></span>
    </div>
    <table class="city-exchange-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Bien</th>
          <th>Quantité</th>
          <th>Prix unitaire</th>
          <th>Montant brut</th>
          <th>Douane</th>
          <th>Net marchands</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
