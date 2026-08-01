/**
 * Delete budget_turn_* snapshots older than a turn window.
 */
export class CleanupOldBudgetTurnSnapshots {
  /**
   * @param {object} deps
   * @param {{ listBudgetTurnRows: () => Promise<Array<object>>, deleteBudgetRow: (name: string) => Promise<void> }} deps.budgetCleanupPort
   * @param {() => Promise<number>} deps.getCurrentTurn
   * @param {number} [retentionTurns=60]
   */
  constructor({ budgetCleanupPort, getCurrentTurn, retentionTurns = 60 }) {
    this.budgetCleanupPort = budgetCleanupPort;
    this.getCurrentTurn = getCurrentTurn;
    this.retentionTurns = retentionTurns;
  }

  async execute() {
    const allStates = await this.budgetCleanupPort.listBudgetTurnRows();
    const currentTurn = await this.getCurrentTurn();
    const cutoffTurn = currentTurn - this.retentionTurns;
    const oldStates = allStates.filter((state) => state.turn < cutoffTurn);

    if (oldStates.length === 0) {
      return {
        deleted: 0,
        message: 'Aucun état ancien à supprimer',
      };
    }

    for (const state of oldStates) {
      await this.budgetCleanupPort.deleteBudgetRow(state.name);
    }

    return {
      deleted: oldStates.length,
      message: `🧹 Nettoyage automatique : ${oldStates.length} état(s) de plus de ${this.retentionTurns} jours supprimé(s) (tours < ${cutoffTurn})`,
      deletedTurns: oldStates.map((s) => s.turn).sort((a, b) => a - b),
    };
  }
}
