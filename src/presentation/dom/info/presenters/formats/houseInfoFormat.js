/**
 * House — pure format (VM → display models).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import {
  getResidentialGroupTitle,
  residentialGroupForType,
} from '../../../shell/ResidentialGroupLabels.js';

const LEVEL_MAX_POP = Object.freeze({ 1: 6, 2: 12 });

function resolveHouseStatusMessage(level, pop, hasRoadAccess) {
  if (level === 1) {
    if (pop <= 0) return 'Maison vide. Des habitants s\'y installeront avec le temps.';
    if (!hasRoadAccess) {
      return 'Cette maison vit en autarcie. Une route et des habitants permettront le passage au niveau 2.';
    }
    return 'Les conditions sont réunies : la maison peut devenir spécialisée.';
  }
  if (!hasRoadAccess) return 'Route coupée : la maison risque de redescendre au niveau 1.';
  return 'Foyer intégré à l\'économie de la ville.';
}

function resolveHouseholdComposition(level, pop) {
  const safePop = Math.max(0, Math.floor(pop) || 0);
  if (level === 1) return { hunters: safePop, artisans: 0 };
  return { hunters: 0, artisans: safePop };
}

function resolveStockGroups(stocks) {
  const wheat = stocks.wheat || 0;
  const cabbage = stocks.cabbage || 0;
  const carrot = stocks.carrot || 0;
  const fruits = stocks.fruit || 0;
  const game = stocks.game || 0;

  return {
    subsistence: [
      { emoji: '🍎', value: fruits, ariaLabel: `Fruits cueillis : ${fruits} panier${fruits > 1 ? 's' : ''}` },
      { emoji: '🦌', value: game, ariaLabel: `Gibier : ${game} panier${game > 1 ? 's' : ''}` },
    ],
    farms: [
      { emoji: '🌾', value: wheat, ariaLabel: `Blé : ${wheat} panier${wheat > 1 ? 's' : ''}` },
      { emoji: '🥬', value: cabbage, ariaLabel: `Légumes verts : ${cabbage} panier${cabbage > 1 ? 's' : ''}` },
      { emoji: '🥕', value: carrot, ariaLabel: `Autres légumes : ${carrot} panier${carrot > 1 ? 's' : ''}` },
    ],
  };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseLayoutHeader(vm) {
  const group = residentialGroupForType(vm.buildingType);
  const title = group ? getResidentialGroupTitle(group) : (getBuildingDefinition(vm.buildingType)?.displayName ?? vm.buildingType);

  const maxPop = LEVEL_MAX_POP[vm.houseLevel] ?? LEVEL_MAX_POP[1];
  const levelBadge = vm.houseLevel === 2 ? '②' : '①';
  const meta = `Niveau <span aria-label="Niveau ${vm.houseLevel}">${levelBadge}</span> · <span aria-label="${vm.buildingPop} habitants sur ${maxPop}">${vm.buildingPop}/${maxPop} 👥</span>`;

  return { title, meta, accent: group };
}

export function formatHouseLayoutOptions() {
  return {
    layout: 'centered',
    foyerTabLabel: 'foyer',
    hubOverlayMode: null,
  };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseFoyerModel(vm) {
  const hasRoadAccess = vm.roadAccess.hasAccess;
  const variant = vm.houseLevel === 2 && !hasRoadAccess ? 'warning' : 'neutral';

  const model = {
    statusMessage: resolveHouseStatusMessage(vm.houseLevel, vm.buildingPop, hasRoadAccess),
    statusVariant: variant,
    composition: resolveHouseholdComposition(vm.houseLevel, vm.buildingPop),
    anchorX: vm.anchorX,
    anchorY: vm.anchorY,
    stocks: null,
    stockGroups: null,
  };

  if (vm.stocks && Object.hasOwn(vm.stocks, 'food')) {
    const groups = resolveStockGroups(vm.stocks);
    model.stockGroups = {
      subsistence: groups.subsistence,
      farms: groups.farms,
      showSubsistence: true,
    };
  }

  return model;
}
