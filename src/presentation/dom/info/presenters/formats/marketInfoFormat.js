/**
 * Market — pure format (split by thematic tabs).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getResourceRoles, getResourceStockShape } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { buildingName, goodLabel, goodUnit, scheduleLabel } from '../../../shell/CatalogVocabulary.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatMarketLayoutHeader(vm) {
  const def = getBuildingDefinition(vm.buildingType);
  return {
    title: buildingName(vm.buildingType),
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · <span aria-label="${vm.buildingPop} habitants">${vm.buildingPop} hab.</span>`,
    accent: null,
  };
}

export function formatMarketLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/** The goods of one thing a market distributes, in the catalog's words ("Assiette, Pot, …"). */
const goodsNames = (categories) => categories.map(goodLabel).join(', ');

/** Every thing the market's catalog entries have it distribute: its diet, the goods it also stocks... */
const distributorEntries = (vm) => getResourceRoles(vm.buildingType).filter((entry) => entry.role === 'distributor');

/**
 * Overview — reference facts, one set per thing the market distributes: when it buys and which hub it
 * draws from now. Operational/supply-chain status (inactive, no farms nearby, no houses nearby) is a
 * Messages-tab complaint now — see messagesInfoFormat.js's personnelComplaint (staffing/road) and
 * marketSupplyComplaints (fermes/maisons). Repeating those here would just be the same fact said twice.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketOverviewModel(vm) {
  const { supplyView, stocks } = vm;
  if (!supplyView || !Object.hasOwn(stocks || {}, getResourceStockShape().totalKey)) return null;

  const entries = distributorEntries(vm);
  const rows = entries.flatMap((entry) => {
    const goods = goodsNames(entry.categories);
    const link = (supplyView.hubLinks ?? []).find((candidate) => candidate.categories.join() === entry.categories.join());
    return [
      { label: `Période d'achat · ${goods}`, value: scheduleLabel(entry.schedule) },
      ...(entry.hubLink
        ? [{ label: `Approvisionné par · ${goods}`, value: link?.hubType ? buildingName(link.hubType) : 'aucun à portée' }]
        : []),
    ];
  });

  return { sections: [{ title: `État · ${buildingName(vm.buildingType)}`, rows }] };
}

/**
 * Stocks tab — one section per thing the market distributes, each with its own goods and ceiling.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketStocksModel(vm) {
  const { supplyView, stocks } = vm;
  if (!supplyView) return null;

  const sections = distributorEntries(vm)
    .filter((entry) => entry.totalKey && Object.hasOwn(stocks || {}, entry.totalKey))
    .map((entry, index) => {
      // Goods, aggregate and ceiling all come from the market's own catalog entry.
      const ceiling = Number.isFinite(entry.maxStock) ? entry.maxStock : supplyView.maxStock;
      const cap = Number.isFinite(ceiling) ? `/${ceiling}` : '';
      return {
        title: index === 0 ? `Stock · ${buildingName(vm.buildingType)}` : `Stock · ${goodsNames(entry.categories)}`,
        rows: [
          ...entry.categories.map((category) => ({
            label: goodLabel(category),
            value: `${stocks[category] || 0}${cap} ${goodUnit(category, stocks[category] || 0)}`,
          })),
          {
            label: 'Total disponible',
            value: `${stocks[entry.totalKey] || 0}${cap} ${goodUnit(entry.totalKey, stocks[entry.totalKey] || 0)}`,
          },
        ],
      };
    });

  return sections.length > 0 ? { sections } : null;
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
