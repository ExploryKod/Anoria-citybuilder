/**
 * @param {number} probabilityPercent 0-100
 * @returns {number}
 */
export function getMinTurnsBetweenEvents(probabilityPercent) {
  return probabilityPercent >= 50 ? 0 : 10;
}

/**
 * @param {number} daysPerMonth
 * @returns {number}
 */
export function getFirstYearEnd(daysPerMonth) {
  return 12 * daysPerMonth;
}

/**
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isHouseBuildingType(buildingType) {
  return (buildingType || '').includes('House');
}

/**
 * @param {object} params
 * @param {boolean} params.enabled
 * @param {number} params.time
 * @param {number} params.firstYearEnd
 * @param {number} params.turnsSinceLastEvent
 * @param {number} params.minTurnsBetweenEvents
 * @param {number} params.houseCount
 * @param {number} params.randomValue 0..1
 * @param {number} params.probability 0..1
 * @returns {boolean}
 */
export function shouldTriggerDisasterEvent({
  enabled,
  time,
  firstYearEnd,
  turnsSinceLastEvent,
  minTurnsBetweenEvents,
  houseCount,
  randomValue,
  probability,
}) {
  if (!enabled) return false;
  if (time <= firstYearEnd) return false;
  if (turnsSinceLastEvent < minTurnsBetweenEvents) return false;
  if (houseCount <= 0) return false;
  return randomValue <= probability;
}
