/**
 * Thin ECS adapter — runs the monthly resource supply chain via Supply BC.
 */
export function createSupplyMonthlyResourceSystem({
  supply,
  getTimeInfo,
  toSupplySeason,
  toSupplyMonth,
}) {
  return async function supplyMonthlyResource(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);

    await supply.runMonthlyResourceCycle({
      season: toSupplySeason(timeInfo.season),
      month: toSupplyMonth(timeInfo.month),
      timeInfo,
    });
  };
}
