/**
 * Market — pure format.
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
  return { layout: 'centered', foyerTabLabel: 'building', hubOverlayMode: null };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatMarketFoyerModel(vm) {
  const { supplyView, stocks, buildingRow, employment } = vm;
  if (!supplyView || !Object.hasOwn(stocks || {}, 'food')) return null;

  const maxStock = supplyView.maxStock || 500;
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

  const stocksPanel = {
    sections: [
      {
        title: 'Stock marché',
        rows: [
          { label: 'Blé', value: `${stocks.wheat || 0}/${maxStock} paniers` },
          { label: 'Légumes verts', value: `${stocks.cabbage || 0}/${maxStock} paniers` },
          { label: 'Autres légumes', value: `${stocks.carrot || 0}/${maxStock} paniers` },
          { label: 'Total', value: `${stocks.food || 0}/${maxStock} paniers disponibles` },
        ],
      },
      {
        title: 'État du marché',
        rows: [{ label: 'État', value: marketState }],
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

  const employees = formatWorkplaceEmployeesPanel(marketData, {
    fullyStaffed: '✅ Le marché marche à plein régime',
    noWorkers: '❌ Le marché manque de bras, il ne peut fonctionner',
    partialWorkers: '⚠️ Le marché tente de vendre avec peine car trop peu d\'employés',
  }, employment);

  return {
    sections: [
      ...stocksPanel.sections,
      ...(employees?.sections ?? []),
    ],
  };
}
