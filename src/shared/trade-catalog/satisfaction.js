/**
 * A relation's satisfaction, as the presentation reads it. Shared, so the views and the policy use one reader.
 */

/**
 * A relation's satisfaction, read strictly: a relation without one is a defect, not a neutral partner.
 * @param {{ satisfactionScore?: number }} relation
 * @returns {number}
 */
export function satisfactionOf(relation) {
  if (!Number.isFinite(relation?.satisfactionScore)) {
    throw new Error(`[trade] relation ${relation?.cityId ?? '?'} has no satisfactionScore`);
  }
  return relation.satisfactionScore;
}

/** @param {number} score @returns {string} the score with its sign: "+25", "-40", "0" */
export function formatSatisfaction(score) {
  return score > 0 ? `+${score}` : `${score}`;
}
