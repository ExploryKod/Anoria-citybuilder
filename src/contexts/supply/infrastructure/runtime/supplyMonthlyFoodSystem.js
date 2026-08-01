/**
 * Thin ECS adapter — runs the monthly food supply chain via Supply BC.
 */
export function createSupplyMonthlyFoodSystem({
  supply,
  getTimeInfo,
  toSupplySeason,
  toSupplyMonth,
  foodDistributionDistance = 5,
}) {
  return async function supplyMonthlyFood(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);

    await supply.runMonthlyFoodSupplyCycle({
      season: toSupplySeason(timeInfo.season),
      month: toSupplyMonth(timeInfo.month),
      timeInfo,
      maxDistance: foodDistributionDistance,
    });
  };
}
