/** Canonical objective definitions (financial unlock rules). */
export const OBJECTIVE_CATALOG = Object.freeze({
  budget_challenge_5000: Object.freeze({
    id: 'budget_challenge_5000',
    title: '💰 Objectif Financier',
    description: 'Atteindre 5000€ de fonds pour déverrouiller la Maison Violette.',
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
