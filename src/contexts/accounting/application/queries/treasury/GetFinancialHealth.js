import { assessFinancialHealth } from '../../../domain/policies/FinancialHealthPolicy.js';
import { GetTreasurySnapshot } from './GetTreasurySnapshot.js';

export class GetFinancialHealth {
  /** @param {GetTreasurySnapshot} getTreasurySnapshot */
  constructor(getTreasurySnapshot) {
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /** @returns {Promise<{ status: string, message: string, budget: object, netFlow: number }>} */
  async execute() {
    const budget = await this.getTreasurySnapshot.execute();
    const { status, message, netFlow } = assessFinancialHealth(budget);

    return {
      status,
      message,
      budget,
      netFlow,
    };
  }
}
