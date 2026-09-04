/**
 * Food circuit data: the tunable numbers/tables driving the food loop
 * (harvest yield/season, farm→crop mapping, market range, house food
 * requirements by level). Policies read from here instead of hardcoding
 * values, so tuning or extending the food circuit is a one-file change.
 */
export const FOOD_CIRCUIT = Object.freeze({
  crops: Object.freeze(['wheat', 'carrot', 'cabbage']),
  gatheredCategories: Object.freeze(['fruit', 'game']),

  /** Food requirements per house level: essential (must-have) vs desired (variety). */
  houseFoodRequirementsByLevel: Object.freeze({
    1: Object.freeze({ essential: ['fruit', 'game'], desired: [], basketsPerCitizen: 1 }),
    2: Object.freeze({
      essential: ['fruit', 'game'],
      desired: ['wheat', 'carrot', 'cabbage'],
      basketsPerCitizen: 1,
    }),
  }),

  /** Used when a house level has no explicit entry above. */
  houseFoodRequirementsFallback: Object.freeze({
    essential: ['fruit', 'game'],
    desired: [],
    basketsPerCitizen: 1,
  }),
});
