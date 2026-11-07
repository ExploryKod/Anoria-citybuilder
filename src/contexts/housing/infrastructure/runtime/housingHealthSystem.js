/**
 * Thin ECS adapter — the monthly health of the inhabitants via Housing BC.
 *
 * A house is judged on the LAST day of the month: the records of its needs (water, food, services) are then those of the
 * whole month, not of its first morning. The command judges each house once per month on its own.
 */

/**
 * @param {object} deps
 * @param {{ evolveHealthOfHouses: (params: { monthKey: number, periodKey: number, deathsEnabled: boolean }) => Promise<{ judged: number, deaths: number, suicides: number }> }} deps.housing
 * @param {(time: number) => { dayInMonth: number, monthNumber: number, monthIndex: number }} deps.getTimeInfo
 * @param {() => number} deps.getDaysPerMonth the calendar's length of a month (frozen for the game)
 * @param {() => boolean} deps.areHealthDeathsEnabled whether poor health kills in this game (the mode that has defeat, like the famine)
 * @param {(deaths: number, timeInfo: object) => void} deps.onHealthDeaths told how many citizens died of poor health this month (the composition counts them, by cause)
 * @param {(suicides: number, timeInfo: object) => void} deps.onSuicides told how many citizens took their own lives this month (counted under their own cause)
 */
export function createHousingHealthSystem({ housing, getTimeInfo, getDaysPerMonth, areHealthDeathsEnabled, onHealthDeaths, onSuicides }) {
  if (typeof areHealthDeathsEnabled !== 'function' || typeof onHealthDeaths !== 'function' || typeof onSuicides !== 'function') {
    throw new Error('[health] the health system needs areHealthDeathsEnabled, onHealthDeaths and onSuicides: a death must be counted by its cause');
  }
  return async function housingHealth(_world, context = {}) {
    if (!Number.isFinite(context.time)) throw new Error(`[health] the tick carries no time (${context.time}): the month cannot be told`);
    const timeInfo = getTimeInfo(context.time);
    if (timeInfo.dayInMonth !== getDaysPerMonth()) return;
    const { deaths, suicides } = await housing.evolveHealthOfHouses({
      monthKey: timeInfo.monthNumber,
      periodKey: timeInfo.monthIndex,
      deathsEnabled: areHealthDeathsEnabled(),
    });
    if (deaths > 0) onHealthDeaths(deaths, timeInfo);
    if (suicides > 0) onSuicides(suicides, timeInfo);
  };
}
