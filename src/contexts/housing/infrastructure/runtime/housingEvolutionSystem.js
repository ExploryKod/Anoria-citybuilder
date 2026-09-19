/**
 * Thin ECS adapter — house type evolution via Housing BC.
 */

/**
 * @param {object} deps
 * @param {{ evolveAllHouseBuildings: Function }} deps.housing
 * @param {(time: number) => { monthIndex: number }} deps.getTimeInfo
 */
export function createHousingEvolutionSystem({ housing, getTimeInfo }) {
  return async function housingEvolution(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);
    await housing.evolveAllHouseBuildings({ periodKey: timeInfo.monthIndex });
  };
}
