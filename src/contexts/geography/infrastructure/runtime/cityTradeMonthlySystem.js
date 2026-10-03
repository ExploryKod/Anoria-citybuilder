import { TimeManager } from '../../../../shared/time/TimeManager.js';

/**
 * Thin ECS adapter — runs the monthly city-trade cycle on the last day of
 * each game month (mirrors the supply monthly cycle pattern).
 *
 * @param {object} deps
 * @param {{ runMonthlyCityTradeCycle: (timeInfo: object) => Promise<void> }} deps.trade
 * @param {(time: number) => object} deps.getTimeInfo
 */
export function createCityTradeMonthlySystem({ trade, getTimeInfo }) {
  return async function cityTradeMonthly(_world, context = {}) {
    const timeInfo = getTimeInfo(context.time ?? 0);
    if (timeInfo.dayInMonth !== TimeManager.DAYS_PER_MONTH) return;
    await trade.runMonthlyCityTradeCycle(timeInfo);
  };
}
