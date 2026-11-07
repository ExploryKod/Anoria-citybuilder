/**
 * Thin ECS adapter — once a month, the companies that cannot pay their debts are liquidated (Gameplay BC, LiquidateInsolventCompanies.js).
 *
 * It runs on the LAST day of the month, like the health of the inhabitants: the settlement that books a month's debts ran on its first turn, so the months a debt has
 * been open are then counted whole. A company already liquidated is no longer there, so the day cannot liquidate it twice.
 *
 * @param {object} deps
 * @param {{ liquidateInsolventCompanies: { execute: () => Promise<unknown> } }} deps.gameplay
 * @param {(time: number) => { dayInMonth: number }} deps.getTimeInfo
 * @param {() => number} deps.getDaysPerMonth the calendar's length of a month (frozen for the game)
 */
export function createInsolvencySystem({ gameplay, getTimeInfo, getDaysPerMonth }) {
  return async function insolvency(_world, context = {}) {
    if (getTimeInfo(context.time ?? 0).dayInMonth !== getDaysPerMonth()) return;
    await gameplay.liquidateInsolventCompanies.execute();
  };
}
