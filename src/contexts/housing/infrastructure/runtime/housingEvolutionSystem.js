/**
 * Thin ECS adapter — house type evolution via Housing BC.
 */

/**
 * @param {object} deps
 * @param {{ evolveAllHouseBuildings: Function }} deps.housing
 * @param {(time: number) => { monthIndex: number }} deps.getTimeInfo
 * @param {(changes: object[], timeInfo: object) => (void | Promise<void>)} [deps.onChanges]
 *   Told which houses went up or down a level, injected from composition.
 * @param {(departure: { count: number, houses: number, unmet: object[] }, timeInfo: object) => void} [deps.onPopulationDeparted]
 *   Told when inhabitants left because a house's standing changed.
 * @param {<T>(work: () => Promise<T>) => Promise<T>} [deps.readSupplyOnce]
 *   Runs the pass with the supply's buildings read once (the pass asks, for every house, where the warehouses and producers stand: left alone, each question is a scan
 *   of the whole building table, so the pass costs houses × scans). Injected from composition; absent, the pass runs as it always did.
 */
export function createHousingEvolutionSystem({
  housing,
  getTimeInfo,
  onChanges = null,
  onPopulationDeparted = null,
  readSupplyOnce = null,
}) {
  return async function housingEvolution(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);
    const evolve = () => housing.evolveAllHouseBuildings({ periodKey: timeInfo.monthIndex });
    const result = await (readSupplyOnce ? readSupplyOnce(evolve) : evolve());

    if (result?.changes?.length > 0 && typeof onChanges === 'function') {
      await onChanges(result.changes, timeInfo);
    }
    if (result?.departure && typeof onPopulationDeparted === 'function') {
      onPopulationDeparted(result.departure, timeInfo);
    }
  };
}
