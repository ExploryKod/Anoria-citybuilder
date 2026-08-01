/**
 * UI enrichment — building counts and per-type values for bilan detail lines.
 * Not the source of balance sheet totals (those come from BalanceSheet read model).
 */

import { formatEuroOrNa } from '../../../../contexts/accounting/presentation/index.js';

/**
 * @param {{ accounting: object, construction: object }} deps
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchBuildingBreakdownElementValues({ accounting, construction }) {
  const [{ totalValue: _totalBuildingValue, pricesByType: buildingPrices }, houses] =
    await Promise.all([
      accounting.getCityBuildingValuation(),
      construction.listAllBuildingRows(),
    ]);

  const buildingAnalysis = {
    redHouses: 0,
    blueHouses: 0,
    purpleHouses: 0,
    cabbageFields: 0,
    wheatFields: 0,
    carrotFields: 0,
    foodMarkets: 0,
    roads: 0,
  };

  houses.forEach((house) => {
    const type = house.type;
    if (type.includes('House-Red')) buildingAnalysis.redHouses += 1;
    else if (type.includes('House-Blue')) buildingAnalysis.blueHouses += 1;
    else if (type.includes('House-Purple')) buildingAnalysis.purpleHouses += 1;
    else if (type.includes('Farm-Cabbage')) buildingAnalysis.cabbageFields += 1;
    else if (type.includes('Farm-Wheat')) buildingAnalysis.wheatFields += 1;
    else if (type.includes('Farm-Carrot')) buildingAnalysis.carrotFields += 1;
    else if (type.includes('Market')) buildingAnalysis.foodMarkets += 1;
    else if (type.includes('roads')) buildingAnalysis.roads += 1;
  });

  const housePrices = {
    red: buildingPrices['House-Red'] ?? 'N/A',
    blue: buildingPrices['House-Blue'] ?? 'N/A',
    purple: buildingPrices['House-Purple'] ?? 'N/A',
  };

  const farmPrices = {
    cabbage: buildingPrices['Farm-Cabbage'] ?? 'N/A',
    wheat: buildingPrices['Farm-Wheat'] ?? 'N/A',
    carrot: buildingPrices['Farm-Carrot'] ?? 'N/A',
  };

  const marketPrice = buildingPrices['Market'] ?? 'N/A';
  const roadPrice = buildingPrices['roads'] ?? 'N/A';

  const redHousesValue = typeof housePrices.red === 'number' ? buildingAnalysis.redHouses * housePrices.red : 0;
  const blueHousesValue = typeof housePrices.blue === 'number' ? buildingAnalysis.blueHouses * housePrices.blue : 0;
  const purpleHousesValue =
    typeof housePrices.purple === 'number' ? buildingAnalysis.purpleHouses * housePrices.purple : 0;
  const totalHousesValue = redHousesValue + blueHousesValue + purpleHousesValue;

  const cabbageValue =
    typeof farmPrices.cabbage === 'number' ? buildingAnalysis.cabbageFields * farmPrices.cabbage : 0;
  const wheatValue = typeof farmPrices.wheat === 'number' ? buildingAnalysis.wheatFields * farmPrices.wheat : 0;
  const carrotValue = typeof farmPrices.carrot === 'number' ? buildingAnalysis.carrotFields * farmPrices.carrot : 0;
  const totalFarmsValue = cabbageValue + wheatValue + carrotValue;

  const marketsValue = typeof marketPrice === 'number' ? buildingAnalysis.foodMarkets * marketPrice : 0;
  const roadsValue = typeof roadPrice === 'number' ? buildingAnalysis.roads * roadPrice : 0;

  return {
    'total-houses-value': formatEuroOrNa(totalHousesValue),
    'red-houses-value': formatEuroOrNa(redHousesValue),
    'blue-houses-value': formatEuroOrNa(blueHousesValue),
    'purple-houses-value': formatEuroOrNa(purpleHousesValue),
    'total-farms-value': formatEuroOrNa(totalFarmsValue),
    'cabbage-fields-value': formatEuroOrNa(cabbageValue),
    'wheat-fields-value': formatEuroOrNa(wheatValue),
    'carrot-fields-value': formatEuroOrNa(carrotValue),
    'total-markets-value': formatEuroOrNa(marketsValue),
    'food-markets-value': formatEuroOrNa(marketsValue),
    'total-roads-value': formatEuroOrNa(roadsValue),
    'roads-value': formatEuroOrNa(roadsValue),
  };
}
