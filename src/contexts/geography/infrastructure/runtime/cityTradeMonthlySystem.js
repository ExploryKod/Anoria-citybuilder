import { TimeManager } from '../../../../shared/time/TimeManager.js';

/**
 * Thin ECS adapter — runs the monthly city-trade cycle on the last day of
 * each game month (mirrors the supply monthly cycle pattern).
 *
 * @param {object} deps
 * @param {{ runMonthlyCityTradeCycle: (timeInfo: object) => Promise<Array<{ milestoneId: string, occurrence: string, params: object }>> }} deps.trade
 * @param {(time: number) => object} deps.getTimeInfo
 * @param {(announcement: { milestoneId: string, turn: number, occurrence: string, params: object }) => Promise<unknown>} deps.announce tells the player what a partner did on its own
 */
export function createCityTradeMonthlySystem({ trade, getTimeInfo, announce }) {
  if (typeof announce !== 'function') throw new Error('[trade] the monthly trade system needs `announce`: what the partners do on their own must be told to the player');
  return async function cityTradeMonthly(_world, context = {}) {
    const timeInfo = getTimeInfo(context.time);
    if (timeInfo.dayInMonth !== TimeManager.DAYS_PER_MONTH) return;
    const announcements = await trade.runMonthlyCityTradeCycle(timeInfo);
    for (const announcement of announcements) await announce({ ...announcement, turn: context.time });
  };
}
