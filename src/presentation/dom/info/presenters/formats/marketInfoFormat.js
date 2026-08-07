/**
 * Market — pure format (split by thematic tabs).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
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
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ marketState: string, hasNoWorkersForState: boolean } | null}
 */
function resolveMarketState(vm) {
  const { supplyView, stocks, buildingRow } = vm;
  if (!supplyView || !Object.hasOwn(stocks || {}, 'food')) return null;

  const marketData = buildingRow;
  const hasNoWorkersForState = (marketData?.roads ?? 0) > 0
    && (marketData?.employees?.worker || 0) === 0
    && (marketData?.employees?.worker_need || 0) > 0;

  const buyingPeriodName = 'Automne';
  let marketState;
  if (hasNoWorkersForState) {
    marketState = '🔴 Inactif : pas d\'employés';
  } else if (supplyView.isBuying === true) {
    marketState = '🟢 Achats en cours : c\'est le mois des affaires !';
  } else {
    marketState = `⏸️ En attente : le marché n'achète qu'en ${buyingPeriodName}`;
  }

  return { marketState, hasNoWorkersForState };
}

/**
 * Overview — état + approvisionnement.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketOverviewModel(vm) {
  const resolved = resolveMarketState(vm);
  if (!resolved) return null;

  const { supplyView } = vm;
  return {
    sections: [
      {
        title: 'État du marché',
        rows: [{ label: 'État', value: resolved.marketState }],
      },
      {
        title: 'Approvisionnement',
        rows: [
          {
            label: 'Fermes',
            value: supplyView.noFarmsNearby === true
              ? '❌ Aucune ferme à proximité'
              : '✅ Fermes accessibles',
          },
          {
            label: 'Distribution',
            value: !supplyView.hasHousesNearby
              ? '❌ Aucune maison à portée'
              : '✅ Maisons à portée',
          },
        ],
      },
    ],
  };
}

/**
 * Stocks tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketStocksModel(vm) {
  const { supplyView, stocks } = vm;
  if (!supplyView || !Object.hasOwn(stocks || {}, 'food')) return null;

  const maxStock = supplyView.maxStock || 500;
  return {
    sections: [{
      title: 'Stock marché',
      rows: [
        { label: 'Blé', value: `${stocks.wheat || 0}/${maxStock} paniers` },
        { label: 'Légumes verts', value: `${stocks.cabbage || 0}/${maxStock} paniers` },
        { label: 'Autres légumes', value: `${stocks.carrot || 0}/${maxStock} paniers` },
        { label: 'Total', value: `${stocks.food || 0}/${maxStock} paniers disponibles` },
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
  return formatWorkplaceEmployeesPanel(vm.buildingRow, {
    fullyStaffed: '✅ Le marché marche à plein régime',
    noWorkers: '❌ Le marché manque de bras, il ne peut fonctionner',
    partialWorkers: '⚠️ Le marché tente de vendre avec peine car trop peu d\'employés',
  }, vm.employment);
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
