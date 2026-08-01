/**
 * Règles liées au type de bâtiment dans le contexte Urban.
 */
export function needsRoadAccess(buildingType) {
  if (!buildingType || typeof buildingType !== 'string') {
    return false;
  }
  return !buildingType.includes('roads') && !buildingType.includes('Road');
}
