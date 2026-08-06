/** @param {object} tradeLine */
function isTradeLineQuotaExhausted(tradeLine) {
  return (tradeLine.currentYearly || 0) >= tradeLine.yearlyQuota;
}

/** @param {object} partner */
export function hasRemainingYearlyQuota(partner) {
  const hasBuyQuota = (partner.buysFromUs ?? []).some(
    (line) => !isTradeLineQuotaExhausted(line)
  );
  const hasSellQuota = (partner.sellsToUs ?? []).some(
    (line) => !isTradeLineQuotaExhausted(line)
  );
  return hasBuyQuota || hasSellQuota;
}

/** @param {object} partner */
export function isYearlyQuotaExhausted(partner) {
  if (!partner?.isActive) {
    return false;
  }

  const buys = partner.buysFromUs ?? [];
  const sells = partner.sellsToUs ?? [];

  if (buys.length === 0 && sells.length === 0) {
    return false;
  }

  const allBuysExhausted = buys.length === 0 || buys.every(isTradeLineQuotaExhausted);
  const allSellsExhausted = sells.length === 0 || sells.every(isTradeLineQuotaExhausted);

  return allBuysExhausted && allSellsExhausted;
}

/** @param {object} partner */
export function getPartnerQuotaStatus(partner) {
  const exhaustedBuys = (partner.buysFromUs ?? [])
    .filter(isTradeLineQuotaExhausted)
    .map((line) => ({
      productId: line.productId,
      productName: line.productName,
      currentYearly: line.currentYearly || 0,
      yearlyQuota: line.yearlyQuota,
    }));

  const exhaustedSells = (partner.sellsToUs ?? [])
    .filter(isTradeLineQuotaExhausted)
    .map((line) => ({
      productId: line.productId,
      productName: line.productName,
      currentYearly: line.currentYearly || 0,
      yearlyQuota: line.yearlyQuota,
    }));

  return {
    exhaustedBuys,
    exhaustedSells,
    hasRemainingYearlyQuota: hasRemainingYearlyQuota(partner),
    isYearlyQuotaExhausted: isYearlyQuotaExhausted(partner),
  };
}
