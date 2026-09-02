import { FOOD_CIRCUIT } from '../catalogs/FoodCircuitCatalog.js';

/**
 * Définit les besoins alimentaires selon le statut social (niveau de maison).
 * Les skills de production dictent les besoins de consommation.
 * 
 * Design: Si tu produis du fruit/game, tu en as BESOIN pour vivre.
 * Les artisans (level 2) gardent ces besoins + ajoutent variété (crops).
 */

/**
 * @typedef {object} FoodRequirement
 * @property {string[]} essential - Types de nourriture OBLIGATOIRES
 * @property {string[]} desired - Types de nourriture pour satisfaction/upgrade
 * @property {number} basketsPerCitizen - Paniers totaux par habitant/mois
 */

/**
 * Résout les besoins alimentaires selon le niveau de la maison.
 * 
 * @param {1 | 2} level
 * @returns {FoodRequirement}
 */
export function getHouseFoodRequirements(level) {
  return FOOD_CIRCUIT.houseFoodRequirementsByLevel[level] ?? FOOD_CIRCUIT.houseFoodRequirementsFallback;
}

/**
 * Calcule la demande détaillée par type de nourriture.
 * 
 * Stratégie: Distribuer équitablement la demande sur tous les types
 * (essential + desired disponibles), favorisant la variété.
 * 
 * @param {object} params
 * @param {number} params.population
 * @param {1 | 2} params.level
 * @param {ReturnType<import('../value-objects/FoodStock.js').createFoodStock>} params.stocks
 * @returns {Record<string, number>} Demande par type (peut être fractionnaire)
 */
export function computeFoodDemandByType({ population, level, stocks }) {
  const pop = Math.max(0, Math.floor(population));
  if (pop <= 0) {
    return { fruit: 0, game: 0, wheat: 0, carrot: 0, cabbage: 0 };
  }
  
  const requirements = getHouseFoodRequirements(level);
  const totalDemand = pop * requirements.basketsPerCitizen;
  
  // TOUS les types demandés (essential + desired), peu importe le stock
  const requestedTypes = [...requirements.essential, ...requirements.desired];
  
  // Distribuer la demande équitablement sur TOUS les types requis
  // Cela permet de calculer l'unfed même pour les types à 0 stock
  const demandPerType = totalDemand / requestedTypes.length;
  const demand = { fruit: 0, game: 0, wheat: 0, carrot: 0, cabbage: 0 };
  for (const type of requestedTypes) {
    demand[type] = demandPerType;
  }
  
  return demand;
}

/**
 * Vérifie si les besoins essentiels sont couverts.
 * 
 * @param {object} params
 * @param {1 | 2} params.level
 * @param {Record<string, number>} params.consumed
 * @returns {boolean}
 */
export function areEssentialNeedsMet({ level, consumed }) {
  const requirements = getHouseFoodRequirements(level);
  
  // Au moins un des essentiels doit être consommé
  return requirements.essential.some(type => (consumed[type] || 0) > 0);
}

/**
 * Calcule un score de satisfaction alimentaire (0-100).
 * 
 * @param {object} params
 * @param {1 | 2} params.level
 * @param {Record<string, number>} params.consumed
 * @param {number} params.population
 * @returns {number}
 */
export function computeFoodSatisfactionScore({ level, consumed, population }) {
  const requirements = getHouseFoodRequirements(level);
  const totalConsumed = Object.values(consumed).reduce((sum, qty) => sum + qty, 0);
  const totalDemand = population * requirements.basketsPerCitizen;
  
  if (totalDemand === 0) return 100;
  
  // Score de base: couverture de la demande totale
  const coverageRatio = Math.min(1, totalConsumed / totalDemand);
  let score = coverageRatio * 70; // 70% du score = quantité
  
  // Bonus variété (30% du score)
  const typesConsumed = Object.entries(consumed).filter(([_, qty]) => qty > 0).length;
  const maxTypes = requirements.essential.length + requirements.desired.length;
  const varietyBonus = (typesConsumed / maxTypes) * 30;
  
  score += varietyBonus;
  
  return Math.round(Math.min(100, score));
}
