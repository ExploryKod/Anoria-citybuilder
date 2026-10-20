/**
 * The trace of one company's account: every journal line that moves its own money, in the order it was written, with the
 * other company it traded with (null for the houses and the city). The account is the money (see GetTreasurySnapshot);
 * this is the record of how it got there.
 * @param {Array<object>} entries the journal lines
 * @param {string} buildingId the company
 * @returns {Array<{ id: number, turn: number, type: string, amount: number, description: string, counterpartyBuildingId: string | null }>}
 */
export function buildingAccountTrace(entries, buildingId) {
  if (!buildingId) throw new Error('[trace] an account trace needs its company');
  return entries
    .filter((entry) => entry.accountBuildingId === buildingId)
    .sort((a, b) => a.id - b.id)
    .map((entry) => ({
      id: entry.id,
      turn: entry.turn,
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
      counterpartyBuildingId: entry.counterpartyBuildingId ?? null,
    }));
}
