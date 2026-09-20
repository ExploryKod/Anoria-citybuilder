import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

/** The building an objective unlocks, named as the catalog names it — the player's word, not the id. */
const UNLOCKED_BUILDING = 'House-Purple';
const unlockedBuildingName = getBuildingDefinition(UNLOCKED_BUILDING)?.displayName ?? UNLOCKED_BUILDING;

/** Canonical objective definitions (financial unlock rules). */
export const OBJECTIVE_CATALOG = Object.freeze({
  budget_challenge_5000: Object.freeze({
    id: 'budget_challenge_5000',
    title: '💰 Objectif Financier',
    unlockedBuilding: UNLOCKED_BUILDING,
    unlockedBuildingName,
    description: `Atteindre 5000€ de fonds pour déverrouiller les ${unlockedBuildingName}.`,
    fundThreshold: 5000,
    requirementText: 'Les fonds doivent atteindre au moins 5000€',
  }),
});

/**
 * @param {keyof typeof OBJECTIVE_CATALOG | string} objectiveId
 * @param {{ currentFunds?: number }} data
 */
export function isObjectiveRequirementMet(objectiveId, data) {
  const definition = OBJECTIVE_CATALOG[objectiveId];
  if (!definition) {
    return false;
  }

  if (objectiveId === 'budget_challenge_5000') {
    return (data.currentFunds ?? 0) >= definition.fundThreshold;
  }

  return false;
}

/** @param {keyof typeof OBJECTIVE_CATALOG | string} objectiveId */
export function getObjectiveFundThreshold(objectiveId) {
  return OBJECTIVE_CATALOG[objectiveId]?.fundThreshold ?? null;
}
