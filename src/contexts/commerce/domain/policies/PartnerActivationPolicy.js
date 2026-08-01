/**
 * @param {object} params
 * @param {object} params.partner
 * @param {{ population: number, unemployment: number, stocksCheck: { hasStocks: boolean, missingProducts: string[] } }} params.metrics
 */
export function evaluateDefaultActivationConditions({ partner, metrics }) {
  const unmetConditions = [];

  if (metrics.population <= 5) {
    unmetConditions.push(`Population > 5 (actuelle: ${metrics.population})`);
  }

  if (metrics.unemployment >= 10) {
    unmetConditions.push(`Chômage < 10% (actuel: ${metrics.unemployment}%)`);
  }

  if (!metrics.stocksCheck.hasStocks) {
    unmetConditions.push(`Stocks manquants: ${metrics.stocksCheck.missingProducts.join(', ')}`);
  }

  return {
    canActivate: unmetConditions.length === 0,
    unmetConditions,
  };
}

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
    if (partner.id === 'deserta') {
      return evaluateDefaultActivationConditions({ partner, metrics });
    }
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
      case 'windmill_stocks_available':
        conditionMet = metrics.stocksCheck.hasStocks;
        conditionMessage = metrics.stocksCheck.hasStocks
          ? 'Stocks disponibles dans les moulins'
          : `Stocks manquants: ${metrics.stocksCheck.missingProducts.join(', ')}`;
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
