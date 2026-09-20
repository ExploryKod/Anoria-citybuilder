/**
 * Market — pure format (split by thematic tabs).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getResourceRoles, getResourceStockShape } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { getResourceCategoryPresentation } from '../../../../../composition/supplyCatalog.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatMarketLayoutHeader(vm) {
  const def = getBuildingDefinition(vm.buildingType);
  return {
    title: def?.displayName ?? vm.buildingType,
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · <span aria-label="${vm.buildingPop} habitants">${vm.buildingPop} hab.</span>`,
    accent: null,
  };
}

export function formatMarketLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * Overview — reference fact only (which season the market buys in).
 * Operational/supply-chain status (inactive, no farms nearby, no houses
 * nearby) is a Messages-tab complaint now — see messagesInfoFormat.js's
 * personnelComplaint (staffing/road) and marketSupplyComplaints (fermes/
 * maisons). Repeating those here would just be the same fact said twice.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketOverviewModel(vm) {
  const { supplyView, stocks } = vm;
  if (!supplyView || !Object.hasOwn(stocks || {}, getResourceStockShape().totalKey)) return null;

  return {
    sections: [{
      title: 'État du marché',
      rows: [{ label: 'Période d\'achat', value: 'Automne' }],
    }],
  };
}

/**
 * Stocks tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketStocksModel(vm) {
  const { supplyView, stocks } = vm;
  // Goods, aggregate and ceiling all come from the market's own catalog entry.
  const entry = getResourceRoles(vm.buildingType).find((candidate) => candidate.role === 'distributor');
  if (!supplyView || !entry?.totalKey || !Object.hasOwn(stocks || {}, entry.totalKey)) return null;

  const cap = Number.isFinite(supplyView.maxStock) ? `/${supplyView.maxStock}` : '';
  return {
    sections: [{
      title: 'Stock marché',
      rows: [
        ...entry.categories.map((category) => ({
          label: getResourceCategoryPresentation(category).label,
          value: `${stocks[category] || 0}${cap} paniers`,
        })),
        { label: 'Total', value: `${stocks[entry.totalKey] || 0}${cap} paniers disponibles` },
      ],
    }],
  };
}

/**
 * Staff tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketStaffModel(vm) {
  return formatWorkplaceEmployeesPanel(vm.buildingRow, vm.employment);
}

/** @deprecated Prefer thematic tab formatters */
export function formatMarketFoyerModel(vm) {
  const overview = formatMarketOverviewModel(vm);
  const stocks = formatMarketStocksModel(vm);
  const staff = formatMarketStaffModel(vm);
  if (!overview && !stocks) return null;
  return {
    sections: [
      ...(stocks?.sections ?? []),
      ...(overview?.sections ?? []),
      ...(staff?.sections ?? []),
    ],
  };
}
