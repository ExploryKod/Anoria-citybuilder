const DEFAULT_MAINTENANCE_COSTS = Object.freeze({
  roads: 2,
  'House-Blue': 3,
  'House-Red': 3,
  'House-Purple': 3,
  'House-2Story': 3,
  Farm: 1,
  Market: 1,
});

/**
 * @param {Array<{ type?: string }>} houses
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} [maintenanceCosts]
 */
export function accumulateBuildingMaintenanceBreakdown(
  houses,
  maintenanceCosts = DEFAULT_MAINTENANCE_COSTS
) {
  const maintenanceBreakdown = {
    houses: 0,
    farms: 0,
    markets: 0,
    roads: 0,
    infrastructure: 0,
    industry: 0,
    total: 0,
  };

  for (const house of houses) {
    if (!house.type) {
      continue;
    }

    const type = house.type;
    let cost = 2;

    if (type.includes('roads')) {
      cost = maintenanceCosts.roads;
      maintenanceBreakdown.roads += cost;
    } else if (
      type === 'House-Blue' ||
      type === 'House-Red' ||
      type === 'House-Purple' ||
      type === 'House-2Story' ||
      type.includes('House')
    ) {
      cost = maintenanceCosts['House-Blue'];
      maintenanceBreakdown.houses += cost;
    } else if (type.includes('Farm')) {
      cost = maintenanceCosts.Farm;
      maintenanceBreakdown.farms += cost;
    } else if (type.includes('Market')) {
      cost = maintenanceCosts.Market;
      maintenanceBreakdown.markets += cost;
    } else if (
      type.includes('Well') ||
      type.includes('Fountain') ||
      type.includes('Streetlight')
    ) {
      cost = 2;
      maintenanceBreakdown.infrastructure += cost;
    } else if (type.includes('Windmill') || type.includes('Barn')) {
      cost = 2;
      maintenanceBreakdown.industry += cost;
    }

    maintenanceBreakdown.total += cost;
  }

  return maintenanceBreakdown;
}
