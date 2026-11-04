/**
 * Thin ECS adapter — the monthly health of the inhabitants via Housing BC.
 *
 * A house is judged on the LAST day of the month: the records of its needs (water, food, services) are then those of the
 * whole month, not of its first morning. The command judges each house once per month on its own.
 */

/**
 * @param {object} deps
 * @param {{ evolveHealthOfHouses: (params: { monthKey: number, periodKey: number }) => Promise<unknown> }} deps.housing
 * @param {(time: number) => { dayInMonth: number, monthNumber: number, monthIndex: number }} deps.getTimeInfo
 * @param {() => number} deps.getDaysPerMonth the calendar's length of a month (frozen for the game)
 */
export function createHousingHealthSystem({ housing, getTimeInfo, getDaysPerMonth }) {
  return async function housingHealth(_world, context = {}) {
    const timeInfo = getTimeInfo(context.time ?? 0);
    if (timeInfo.dayInMonth !== getDaysPerMonth()) return;
    await housing.evolveHealthOfHouses({ monthKey: timeInfo.monthNumber, periodKey: timeInfo.monthIndex });
  };
}
