/**
 * Thin ECS adapter — monthly population growth via Housing BC.
 */
export function createHousingPopulationGrowthSystem({ housing, timeManager }) {
  return async function housingPopulationGrowth(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = timeManager.getTimeInfo(time);

    await housing.growAllHousePopulation({
      monthIndex: timeInfo.monthIndex,
    });
  };
}
