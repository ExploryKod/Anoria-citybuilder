import { TimeManager } from '../../../../shared/time/TimeManager.js';

/**
 * Thin ECS adapter — the producers short of natural sources buy land on the last day of each game month (as the monthly city trade does).
 *
 * @param {object} deps
 * @param {{ runMonthlyLandPurchases: (params: { time: number, label: string }) => Promise<void>, runMonthlyForestGrowth: (timeInfo: { year: number, monthIndex: number }) => Promise<void> }} deps.land
 * @param {(time: number) => { dayInMonth: number, month: string, year: number, monthIndex: number }} deps.getTimeInfo
 */
export function createLandMonthlySystem({ land, getTimeInfo }) {
  return async function landMonthly(_world, context = {}) {
    const timeInfo = getTimeInfo(context.time);
    if (timeInfo.dayInMonth !== TimeManager.DAYS_PER_MONTH) return;
    // The land is bought first: what a producer just bought is planted this month
    await land.runMonthlyLandPurchases({ time: context.time, label: `${timeInfo.month} ${timeInfo.year}` });
    await land.runMonthlyForestGrowth({ year: timeInfo.year, monthIndex: timeInfo.monthIndex });
  };
}
