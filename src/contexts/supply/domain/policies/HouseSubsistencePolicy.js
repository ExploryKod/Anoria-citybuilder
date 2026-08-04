import { createFoodStock } from '../value-objects/FoodStock.js';

/** Baskets of foraged fruit credited per inhabitant each month. */
export function fruitBasketsPerCitizenPerMonth() {
  return 1;
}

/** Baskets of hunted game credited per inhabitant each month. */
export function gameBasketsPerCitizenPerMonth() {
  return 1;
}

/**
 * Monthly cueillette & chasse — independent from farms and markets.
 * Each inhabited house gains fruit and game baskets for every resident.
 *
 * @param {object} params
 * @param {number} params.pop
 * @param {import('../value-objects/FoodStock.js').ReturnType<typeof createFoodStock> | null | undefined} params.stocks
 * @returns {{
 *   nextStock: ReturnType<typeof createFoodStock>,
 *   credited: { fruit: number, game: number },
 * }}
 */
export function computeMonthlyGatheringCredit({ pop, stocks }) {
  const population = Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
  const current = createFoodStock(stocks);

  if (population <= 0) {
    return { nextStock: current, credited: { fruit: 0, game: 0 } };
  }

  const fruitAdded = population * fruitBasketsPerCitizenPerMonth();
  const gameAdded = population * gameBasketsPerCitizenPerMonth();

  const nextStock = createFoodStock({
    wheat: current.wheat,
    carrot: current.carrot,
    cabbage: current.cabbage,
    fruit: current.fruit + fruitAdded,
    game: current.game + gameAdded,
  });

  return {
    nextStock,
    credited: { fruit: fruitAdded, game: gameAdded },
  };
}

/** @deprecated Use computeMonthlyGatheringCredit */
export function computeSubsistenceFoodCredit({ pop, stocks }) {
  const { nextStock, credited } = computeMonthlyGatheringCredit({ pop, stocks });
  return {
    nextStock,
    credited: credited.fruit + credited.game,
  };
}
