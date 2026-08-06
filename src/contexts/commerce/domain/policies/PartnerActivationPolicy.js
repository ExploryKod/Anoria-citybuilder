/**
 * @param {object} params
 * @param {object} params.partner
 * @param {Array<string>} params.activationConditions
 * @param {{ population: number, unemployment: number, stocksCheck: { hasStocks: boolean, missingProducts: string[] } }} params.metrics
 */
export function evaluatePartnerActivationConditions({
  partner,
  activationConditions,
  metrics,
}) {
  if (!activationConditions || activationConditions.length === 0) {
    return { canActivate: true, unmetConditions: [] };
  }

  const unmetConditions = [];

  for (const condition of activationConditions) {
    let conditionMet = false;
    let conditionMessage = '';

    switch (condition) {
      case 'population_min_5':
        conditionMet = metrics.population > 5;
        conditionMessage = `Population > 5 (actuelle: ${metrics.population})`;
        break;
      case 'unemployment_max_10':
        conditionMet = metrics.unemployment < 10;
        conditionMessage = `Chômage < 10% (actuel: ${metrics.unemployment}%)`;
        break;
      default:
        conditionMessage = `Condition inconnue: ${condition}`;
        break;
    }

    if (!conditionMet) {
      unmetConditions.push(conditionMessage);
    }
  }

  return {
    canActivate: unmetConditions.length === 0,
    unmetConditions,
  };
}
