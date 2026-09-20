/**
 * Farm — pure format (split by thematic tabs).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getResourceRoles, getResourceStockShape } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { getResourceCategoryPresentation } from '../../../../../composition/supplyCatalog.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

function productLabel(productType) {
  return getResourceCategoryPresentation(productType).label;
}

/** Categories a building type produces, straight from the catalog. */
function producedCategories(buildingType) {
  return getResourceRoles(buildingType)
    .filter((entry) => entry.role === 'producer')
    .flatMap((entry) => entry.categories);
}

/**
 * @param {string} buildingType
 * @returns {string}
 */
function farmCropLabel(buildingType) {
  const [category] = producedCategories(buildingType);
  return category ? productLabel(category) : 'Culture';
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatFarmLayoutHeader(vm) {
  const def = getBuildingDefinition(vm.buildingType);
  return {
    title: def?.displayName ?? vm.buildingType,
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · <span aria-label="${vm.buildingPop} habitants">${vm.buildingPop} hab.</span>`,
    accent: null,
  };
}

export function formatFarmLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * Overview tab — crop identity.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel}
 */
export function formatFarmOverviewModel(vm) {
  return {
    sections: [{
      title: 'Culture',
      rows: [
        { label: 'Produit', value: farmCropLabel(vm.buildingType) },
        { label: 'Année en cours', value: String(vm.currentYear ?? 0) },
      ],
    }],
  };
}

/**
 * Stocks tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel}
 */
export function formatFarmStocksModel(vm) {
  const { buildingType, stocks: initialStocks } = vm;
  const houseStocks = initialStocks ?? {};
  const { totalKey } = getResourceStockShape();

  /** @type {import('../../buildingInfoTypes.js').InfoKvRow[]} */
  const stockRows = producedCategories(buildingType).map((category) => ({
    label: productLabel(category),
    value: `${houseStocks[category] || 0} paniers`,
  }));
  stockRows.push({ label: 'Total', value: `${houseStocks[totalKey] || 0} paniers` });

  return {
    sections: [{ title: 'Stocks ferme', rows: stockRows }],
  };
}

/**
 * Trade / sales tab (current year).
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel}
 */
export function formatFarmTradeModel(vm) {
  const { supplyView, currentYear = 0 } = vm;
  const salesToMarket = supplyView?.salesToMarket || [];
  const salesToWindmill = supplyView?.salesToWindmill || [];
  const currentYearMarketSales = salesToMarket.filter((s) => s.year === currentYear);
  const currentYearWindmillSales = salesToWindmill.filter((s) => s.year === currentYear);

  if (currentYearMarketSales.length === 0 && currentYearWindmillSales.length === 0) {
    return {
      sections: [{
        title: 'Ventes de l\'année',
        rows: [],
        banners: [{ text: 'Aucune vente enregistrée cette année.', variant: 'neutral' }],
      }],
    };
  }

  /** @type {import('../../buildingInfoTypes.js').InfoKvRow[]} */
  const saleRows = [];
  if (currentYearMarketSales.length > 0) {
    saleRows.push({ label: 'Ventes au marché', value: `${currentYearMarketSales.length} vente(s)` });
    for (const sale of currentYearMarketSales) {
      const subtext = `${sale.monthName || `Mois ${sale.month + 1}`} - Tour ${sale.turn}: ${sale.quantity} paniers`;
      saleRows.push({
        label: `  → ${productLabel(sale.productType)}`,
        value: `${sale.quantity} paniers`,
        subtext,
      });
    }
  }
  if (currentYearWindmillSales.length > 0) {
    saleRows.push({
      label: 'Ventes au moulin',
      value: `${currentYearWindmillSales.length} type(s) de produit`,
    });
    for (const sale of currentYearWindmillSales) {
      saleRows.push({
        label: `  → ${productLabel(sale.productType)}`,
        value: `${sale.quantity} paniers`,
        subtext: `${sale.count || 1} collecte(s) cette année`,
      });
    }
  }

  return {
    sections: [{ title: 'Ventes de l\'année', rows: saleRows }],
  };
}

/**
 * Staff tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatFarmStaffModel(vm) {
  return formatWorkplaceEmployeesPanel(vm.buildingRow, vm.employment);
}

/** @deprecated Prefer thematic tab formatters */
export function formatFarmFoyerModel(vm) {
  const overview = formatFarmOverviewModel(vm);
  const stocks = formatFarmStocksModel(vm);
  const trade = formatFarmTradeModel(vm);
  const staff = formatFarmStaffModel(vm);
  return {
    sections: [
      ...overview.sections,
      ...stocks.sections,
      ...trade.sections,
      ...(staff?.sections ?? []),
    ],
  };
}
