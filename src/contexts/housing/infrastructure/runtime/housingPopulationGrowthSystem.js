/**
 * Thin ECS adapter — monthly population growth via Housing BC.
 * Famine limits / death accounting are injected from composition.
 */

/**
 * @param {object} deps
 * @param {{ growAllHousePopulation: Function }} deps.housing
 * @param {(time: number) => { monthIndex: number }} deps.getTimeInfo
 * @param {() => boolean} [deps.areFamineLimitsEnabled]
 * @param {(deaths: number) => void} [deps.onFamineDeaths]
 */
export function createHousingPopulationGrowthSystem({
  housing,
  getTimeInfo,
  areFamineLimitsEnabled = () => false,
  onFamineDeaths = null,
}) {
  return async function housingPopulationGrowth(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);
    const applyFamineLimits = areFamineLimitsEnabled() === true;

    const result = await housing.growAllHousePopulation({
      monthIndex: timeInfo.monthIndex,
      applyFamineLimits,
    });

    if (applyFamineLimits && result?.deaths > 0 && typeof onFamineDeaths === 'function') {
      onFamineDeaths(result.deaths);
    }
  };
}
