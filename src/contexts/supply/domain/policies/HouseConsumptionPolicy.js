import {
  createFoodStock,
  getFoodCategoryAmount,
  takeFoodCategory,
} from '../value-objects/FoodStock.js';
import { computeFoodDemandByType } from './HouseFoodRequirementsPolicy.js';

/** @typedef {import('../value-objects/FoodStock.js').FoodCategory} FoodCategory */

/** One basket per citizen per month. */
export function basketsPerCitizenPerMonth() {
  return 1;
}

/**
 * Applique la consommation alimentaire avec détails par type.
 * 
 * @param {object} params
 * @param {ReturnType<typeof createFoodStock>} params.stock
 * @param {number} params.population
 * @param {1 | 2} params.level - Niveau de la maison (détermine les besoins)
 * @returns {{
 *   nextStock: ReturnType<typeof createFoodStock>,
 *   consumed: Record<string, number>,
 *   demanded: Record<string, number>,
 *   unfed: Record<string, number>,
 *   totalUnfed: number,
 * }}
 */
export function applyHouseFoodConsumption({ stock, population, level }) {
  const pop = Math.max(0, Math.floor(population));
  
  // Demande détaillée par type (selon le profil de la maison)
  const demanded = computeFoodDemandByType({ population: pop, level, stocks: stock });
  
  let nextStock = createFoodStock(stock);
  const consumed = { fruit: 0, game: 0, wheat: 0, carrot: 0, cabbage: 0 };
  const unfed = { fruit: 0, game: 0, wheat: 0, carrot: 0, cabbage: 0 };
  
  // Consommer de chaque type selon la demande
  for (const [type, demandQty] of Object.entries(demanded)) {
    if (demandQty <= 0) continue;
    
    const available = getFoodCategoryAmount(nextStock, type);
    const taken = Math.min(demandQty, available);
    
    consumed[type] = taken;
    unfed[type] = Math.max(0, demandQty - taken);
    
    if (taken > 0) {
      nextStock = takeFoodCategory(nextStock, type, taken);
    }
  }
  
  // Total unfed = habitants non nourris (arrondi)
  const totalDemanded = Object.values(demanded).reduce((sum, qty) => sum + qty, 0);
  const totalConsumed = Object.values(consumed).reduce((sum, qty) => sum + qty, 0);
  const totalUnfed = Math.ceil(Math.max(0, totalDemanded - totalConsumed));
  
  return {
    nextStock,
    consumed,
    demanded,
    unfed,
    totalUnfed,
  };
}

/** 
 * Calculate total consumed baskets from a consumption record.
 * @param {Record<string, number>} consumed 
 */
export function totalConsumedBaskets(consumed) {
  return Object.values(consumed).reduce((sum, qty) => sum + qty, 0);
}
