/**
 * Nature — pure format.
 */

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatNatureLayoutHeader(vm) {
  return {
    title: 'Ressource naturelle',
    meta: `📍 (${vm.anchorX}, ${vm.anchorY})`,
    accent: null,
  };
}

export function formatNatureLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatNatureFoyerModel(vm) {
  const { buildingType, anchorX, anchorY, terrainLabel, buildingRow, stocks } = vm;
  const resolvedStocks = stocks ?? buildingRow?.stocks ?? null;
  const maxStocks = buildingRow?.maxStocks || {};

  /** @type {import('../../buildingInfoTypes.js').InfoKvSection[]} */
  const sections = [{
    title: 'Ressource naturelle',
    rows: [
      { label: 'Type', value: buildingType },
      { label: 'Adresse', value: `x: ${anchorX} | y: ${anchorY}` },
      { label: 'Terrain', value: terrainLabel },
    ],
  }];

  if (!resolvedStocks || Object.keys(resolvedStocks).length === 0) {
    return { sections };
  }

  /** @type {import('../../buildingInfoTypes.js').InfoKvRow[]} */
  const stockRows = [];
  if (buildingType.includes('Tree')) {
    stockRows.push({
      label: 'Bois',
      value: `${resolvedStocks.wood || 0} / ${maxStocks.wood || 0}`,
    });
  }
  if (buildingType.includes('Boulder')) {
    if ((maxStocks.rock || 0) > 0) {
      stockRows.push({
        label: 'Pierre',
        value: `${resolvedStocks.rock || 0} / ${maxStocks.rock || 0}`,
      });
    }
    if ((maxStocks.gold || 0) > 0) {
      stockRows.push({
        label: 'Or',
        value: `${resolvedStocks.gold || 0} / ${maxStocks.gold || 0}`,
      });
    }
    if ((maxStocks.iron || 0) > 0) {
      stockRows.push({
        label: 'Fer',
        value: `${resolvedStocks.iron || 0} / ${maxStocks.iron || 0}`,
      });
    }
  }

  if (stockRows.length > 0) {
    sections.push({ title: 'Stocks disponibles', rows: stockRows });
  }

  return { sections };
}
