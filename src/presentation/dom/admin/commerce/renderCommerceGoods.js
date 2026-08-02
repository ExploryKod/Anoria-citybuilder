const PRODUCT_ICONS = {
  wood: '🪵',
  furniture: '🪑',
  figs: '🍇',
};

function renderToggleRow({ id, label, checked, disabled, field }) {
  return `
    <div class="commerce-good-modal-row${disabled ? ' disabled' : ''}">
      <span class="commerce-good-modal-label">${label}</span>
      <label class="commerce-switch">
        <input type="checkbox"
               class="commerce-switch-input commerce-good-modal-toggle"
               data-field="${field}"
               data-product-id="${id}"
               ${checked ? 'checked' : ''}
               ${disabled ? 'disabled' : ''}>
        <span class="commerce-switch-slider"></span>
      </label>
    </div>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradeGoodsView.js').buildTradeGoodsView>[number]} good
 */
export function renderCommerceGoodModal(good) {
  if (!good) return '';

  const icon = PRODUCT_ICONS[good.id] ?? '📦';

  return `
    <div class="commerce-good-modal-overlay" id="commerce-good-modal" role="dialog" aria-modal="true" aria-label="${good.name}">
      <div class="commerce-good-modal">
        <div class="commerce-good-modal-header">
          <h3 class="commerce-good-modal-title">${icon} ${good.name}</h3>
          <button type="button" class="commerce-good-modal-close" id="commerce-good-modal-close" aria-label="Fermer">✕</button>
        </div>
        <div class="commerce-good-modal-body">
          ${renderToggleRow({
            id: good.id,
            label: 'Exporter',
            checked: good.exportEnabled,
            disabled: !good.canExport,
            field: 'exportEnabled',
          })}
          ${renderToggleRow({
            id: good.id,
            label: 'Importer',
            checked: good.importEnabled,
            disabled: !good.canImport,
            field: 'importEnabled',
          })}
          <div class="commerce-good-modal-row${!good.canExport || !good.exportEnabled ? ' disabled' : ''}">
            <span class="commerce-good-modal-label">Exporter à partir de</span>
            <input type="number"
                   class="commerce-good-modal-threshold"
                   data-field="exportFromThreshold"
                   data-product-id="${good.id}"
                   min="0"
                   value="${good.exportFromThreshold}"
                   ${!good.canExport || !good.exportEnabled ? 'disabled' : ''}>
          </div>
          <div class="commerce-good-modal-row${!good.canImport || !good.importEnabled ? ' disabled' : ''}">
            <span class="commerce-good-modal-label">Importer jusqu'à</span>
            <input type="number"
                   class="commerce-good-modal-threshold"
                   data-field="importUpTo"
                   data-product-id="${good.id}"
                   data-max="${good.maxImportUpTo}"
                   min="0"
                   max="${good.maxImportUpTo}"
                   value="${Math.min(good.importUpTo, good.maxImportUpTo)}"
                   ${!good.canImport || !good.importEnabled ? 'disabled' : ''}>
          </div>
          <div class="commerce-good-modal-row">
            <span class="commerce-good-modal-label">Industrie</span>
            <button type="button"
                    class="commerce-good-modal-industry-btn${good.industryActive ? ' active' : ''}"
                    data-field="industryActive"
                    data-product-id="${good.id}">
              ${good.industryActive ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>
          <p class="commerce-good-modal-stock">Stock actuel : ${good.stock}</p>
        </div>
      </div>
    </div>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradeGoodsView.js').buildTradeGoodsView>[number]} good
 */
function renderGoodRow(good) {
  const icon = PRODUCT_ICONS[good.id] ?? '📦';
  const exportCell =
    good.exportCap > 0
      ? `${good.yearlyExport}/${good.exportCap}`
      : '—';
  const importCell =
    good.importCap > 0
      ? `${good.yearlyImport}/${good.effectiveImportCap}`
      : '—';

  return `
    <button type="button" class="commerce-good-row" data-product-id="${good.id}">
      <span class="commerce-good-row-name">${icon} ${good.name}</span>
      <span>${good.stock}</span>
      <span class="${good.exportCap > 0 ? '' : 'muted'}">${exportCell}</span>
      <span class="${good.importCap > 0 ? '' : 'muted'}">${importCell}</span>
      <span class="commerce-good-row-status">${good.status}</span>
    </button>`;
}

/**
 * @param {ReturnType<import('../../../../contexts/commerce/application/queries/GetTradeGoodsView.js').buildTradeGoodsView>} goods
 */
export function renderCommerceGoodsList(goods) {
  if (!goods.length) {
    return '<p class="commerce-goods-empty">Aucune denrée commerciale configurée.</p>';
  }

  return `
    <div class="commerce-goods-table">
      <div class="commerce-goods-table-head">
        <span>Denrée</span>
        <span>Stock</span>
        <span>Export (an)</span>
        <span>Import (an)</span>
        <span>Statut</span>
      </div>
      ${goods.map((good) => renderGoodRow(good)).join('')}
    </div>`;
}
