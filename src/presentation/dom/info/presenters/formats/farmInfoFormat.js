/**
 * Farm — pure format (split by thematic tabs).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getResourceRoles, getResourceStockShape } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { buildingName, goodAmount, goodLabel, namesOfBuildings } from '../../../shell/CatalogVocabulary.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

function productLabel(productType) {
  return goodLabel(productType);
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
    value: goodAmount(category, houseStocks[category] || 0),
  }));
  stockRows.push({ label: 'Total', value: goodAmount(totalKey, houseStocks[totalKey] || 0) });

  return {
    sections: [{ title: `Stocks · ${buildingName(buildingType)}`, rows: stockRows }],
  };
}

/**
 * Trade / sales tab (current year).
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel}
 */
export function formatFarmTradeModel(vm) {
  const { supplyView, currentYear = 0, buildingType } = vm;
  const salesToMarket = supplyView?.salesToMarket || [];
  const salesToHub = supplyView?.salesToHub || [];
  const currentYearMarketSales = salesToMarket.filter((s) => s.year === currentYear);
  const currentYearHubSales = salesToHub.filter((s) => s.year === currentYear);
  // Who buys this building's goods, named as the catalog names those buildings.
  const goods = producedCategories(buildingType);
  const buyers = namesOfBuildings('distributor', goods).join(', ');
  const collectors = namesOfBuildings('hub', goods).join(', ');

  if (currentYearMarketSales.length === 0 && currentYearHubSales.length === 0) {
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
    saleRows.push({ label: `Ventes · ${buyers}`, value: `${currentYearMarketSales.length} vente(s)` });
    for (const sale of currentYearMarketSales) {
      const subtext = `${sale.monthName || `Mois ${sale.month + 1}`} - Tour ${sale.turn}: ${goodAmount(sale.productType, sale.quantity)}`;
      saleRows.push({
        label: `  → ${productLabel(sale.productType)}`,
        value: goodAmount(sale.productType, sale.quantity),
        subtext,
      });
    }
  }
  if (currentYearHubSales.length > 0) {
    saleRows.push({
      label: `Ventes · ${collectors}`,
      value: `${currentYearHubSales.length} type(s) de produit`,
    });
    for (const sale of currentYearHubSales) {
      saleRows.push({
        label: `  → ${productLabel(sale.productType)}`,
        value: goodAmount(sale.productType, sale.quantity),
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
