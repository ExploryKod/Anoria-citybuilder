const RESIDENTIAL_HOUSE_MARKERS = ['House-Blue', 'House-Red', 'House-Purple'];

/**
 * @param {Array<{ type?: string, pop?: number }>} houses
 * @param {number} taxPerCapita
 */
export function computeCitizenTaxBreakdown(houses, taxPerCapita) {
  const taxBreakdown = {
    'House-Blue': 0,
    'House-Red': 0,
    'House-Purple': 0,
    total: 0,
    population: 0,
  };

  for (const house of houses) {
    if (!house.type || !RESIDENTIAL_HOUSE_MARKERS.some((marker) => house.type.includes(marker))) {
      continue;
    }

    const pop = house.pop || 0;
    if (pop <= 0) {
      continue;
    }

    const taxPerHouse = Math.round(pop * taxPerCapita);

    if (house.type.includes('House-Blue')) {
      taxBreakdown['House-Blue'] = Math.round(taxBreakdown['House-Blue'] + taxPerHouse);
    } else if (house.type.includes('House-Red')) {
      taxBreakdown['House-Red'] = Math.round(taxBreakdown['House-Red'] + taxPerHouse);
    } else if (house.type.includes('House-Purple')) {
      taxBreakdown['House-Purple'] = Math.round(taxBreakdown['House-Purple'] + taxPerHouse);
    }

    taxBreakdown.total = Math.round(taxBreakdown.total + taxPerHouse);
    taxBreakdown.population += pop;
  }

  return taxBreakdown;
}
