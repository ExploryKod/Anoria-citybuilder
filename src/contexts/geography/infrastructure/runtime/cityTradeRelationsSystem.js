/**
 * Thin ECS adapter — auto-opens new trade relations on the first day of each
 * month whenever their canOpenRelation conditions are met.
 *
 * @param {object} deps
 * @param {{ checkAndOpenNewRelations: (timeInfo: object) => Promise<void> }} deps.trade
 * @param {(time: number) => object} deps.getTimeInfo
 */
export function createCityTradeRelationsSystem({ trade, getTimeInfo }) {
  return async function cityTradeRelations(_world, context = {}) {
    const timeInfo = getTimeInfo(context.time);
    if (timeInfo.dayInMonth !== 1) return;
    await trade.checkAndOpenNewRelations(timeInfo);
  };
}
