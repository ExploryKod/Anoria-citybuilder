import { GetFinancialStatementsAtTurn } from './GetFinancialStatementsAtTurn.js';
import { GetTreasurySnapshot } from '../treasury/GetTreasurySnapshot.js';

/**
 * Query: bilan (actif / passif) linked to CR at current turn.
 */
export class GetBalanceSheet {
  /**
   * @param {GetFinancialStatementsAtTurn} getFinancialStatementsAtTurn
   * @param {GetTreasurySnapshot} getTreasurySnapshot
   */
  constructor(getFinancialStatementsAtTurn, getTreasurySnapshot) {
    this.getFinancialStatementsAtTurn = getFinancialStatementsAtTurn;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /** @returns {Promise<import('../../../domain/read-models/BalanceSheet.js').BalanceSheet>} */
  async execute() {
    const snapshot = await this.getTreasurySnapshot.execute();
    const bundle = await this.getFinancialStatementsAtTurn.execute(snapshot.turn ?? 0);
    return bundle.balanceSheet;
  }
}
