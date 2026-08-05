/**
 * Services tab — pure format (VM → display model).
 */

function isResidentialHouse(buildingType) {
  return typeof buildingType === 'string' && buildingType.includes('House');
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatServicesModel(vm) {
  const roadCount = vm.roadAccess?.roadCount ?? 0;
  const hasRoad = vm.roadAccess?.hasAccess === true || roadCount > 0;

  /** @type {ReadonlyArray<{
   *   emoji: string,
   *   label: string,
   *   value: string | null,
   *   status: 'ok' | 'off',
   *   ariaLabel: string,
   * }>} */
  const items = [
    {
      emoji: '🛣️',
      label: 'Route',
      value: hasRoad ? String(roadCount) : null,
      status: hasRoad ? 'ok' : 'off',
      ariaLabel: hasRoad
        ? `${roadCount} route${roadCount > 1 ? 's' : ''} adjacente${roadCount > 1 ? 's' : ''}`
        : 'Aucune route adjacente',
    },
  ];

  if (isResidentialHouse(vm.buildingType)) {
    const hasMarket = vm.supplyView?.marketTooFar !== true;
    items.push({
      emoji: '🏪',
      label: 'Marché',
      value: hasMarket ? '✓' : null,
      status: hasMarket ? 'ok' : 'off',
      ariaLabel: hasMarket ? 'Marché à portée' : 'Marché hors de portée',
    });
  }

  return { items };
}
