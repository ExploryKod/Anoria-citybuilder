/**
 * Farm — pure format.
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

function productLabel(productType) {
  if (productType === 'wheat') return 'Blé';
  if (productType === 'carrot') return 'Carotte';
  if (productType === 'cabbage') return 'Chou';
  return productType;
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
  return { layout: 'centered', foyerTabLabel: 'building', hubOverlayMode: null };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatFarmFoyerModel(vm) {
  const {
    buildingType,
    supplyView,
    stocks: initialStocks,
    buildingRow,
    employment,
    currentYear = 0,
  } = vm;

  const houseStocks = initialStocks ?? { food: 0, wheat: 0, carrot: 0, cabbage: 0 };

  /** @type {import('../../buildingInfoTypes.js').InfoKvRow[]} */
  const stockRows = [];
  if (buildingType.includes('Farm-Wheat')) {
    stockRows.push({ label: 'Blé', value: `${houseStocks.wheat || 0} paniers` });
  }
  if (buildingType.includes('Farm-Carrot')) {
    stockRows.push({ label: 'Carottes', value: `${houseStocks.carrot || 0} paniers` });
  }
  if (buildingType.includes('Farm-Cabbage')) {
    stockRows.push({ label: 'Légumes verts', value: `${houseStocks.cabbage || 0} paniers` });
  }
  stockRows.push({ label: 'Total', value: `${houseStocks.food || 0} paniers` });

  /** @type {import('../../buildingInfoTypes.js').InfoKvSection[]} */
  const sections = [{ title: 'Stocks ferme', rows: stockRows }];

  const salesToMarket = supplyView?.salesToMarket || [];
  const salesToWindmill = supplyView?.salesToWindmill || [];
  const currentYearMarketSales = salesToMarket.filter((s) => s.year === currentYear);
  const currentYearWindmillSales = salesToWindmill.filter((s) => s.year === currentYear);

  if (currentYearMarketSales.length > 0 || currentYearWindmillSales.length > 0) {
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
    sections.push({ title: 'Ventes de l\'année', rows: saleRows });
  }

  const employees = formatWorkplaceEmployeesPanel(buildingRow, {
    fullyStaffed: '✅ La ferme a tout ce qu\'il faut pour fonctionner',
    noWorkers: '❌ La ferme n\'a aucun employé et ne peut pas fonctionner',
    partialWorkers: '⚠️ La ferme ne peut fonctionner à sa pleine capacité',
  }, employment);

  return {
    sections: [...sections, ...(employees?.sections ?? [])],
  };
}
