/**
 * Thin ECS adapter — monthly factory → barn transfer via Supply BC.
 */
export function createSupplyMonthlyCommerceSystem({ supply, getTimeInfo }) {
  return async function supplyMonthlyCommerce(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);

    await supply.runMonthlyCommerceSupplyCycle({
      monthIndex: timeInfo.monthIndex ?? 0,
      time,
    });
  };
}
