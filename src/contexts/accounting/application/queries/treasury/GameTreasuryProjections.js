/** @param {object} budget @param {number} amount */
export function canAffordFromBudget(budget, amount) {
  return budget.funds >= amount;
}
