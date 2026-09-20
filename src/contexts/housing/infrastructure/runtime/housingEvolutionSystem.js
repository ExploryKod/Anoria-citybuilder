/**
 * Thin ECS adapter — house type evolution via Housing BC.
 */

/**
 * @param {object} deps
 * @param {{ evolveAllHouseBuildings: Function }} deps.housing
 * @param {(time: number) => { monthIndex: number }} deps.getTimeInfo
 * @param {(changes: object[], timeInfo: object) => (void | Promise<void>)} [deps.onChanges]
 *   Told which houses went up or down a level, injected from composition.
 */
export function createHousingEvolutionSystem({ housing, getTimeInfo, onChanges = null }) {
  return async function housingEvolution(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);
    const result = await housing.evolveAllHouseBuildings({ periodKey: timeInfo.monthIndex });

    if (result?.changes?.length > 0 && typeof onChanges === 'function') {
      await onChanges(result.changes, timeInfo);
    }
  };
}
