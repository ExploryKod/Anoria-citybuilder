import { accumulateBuildingMaintenanceBreakdown } from '../../../domain/policies/BuildingMaintenanceBreakdownPolicy.js';

/**
 * Record building maintenance with legacy per-building breakdown metadata.
 */
export class RecordBuildingMaintenanceForCity {
  /**
   * @param {object} deps
   * @param {import('../../queries/treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} deps.getTreasurySnapshot
   * @param {{ execute: Function }} deps.recordMaintenanceExpense
   * @param {{ listHouses: () => Promise<Array<object>> }} deps.houseReadPort
   */
  constructor({ getTreasurySnapshot, recordMaintenanceExpense, houseReadPort }) {
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.recordMaintenanceExpense = recordMaintenanceExpense;
    this.houseReadPort = houseReadPort;
  }

  /**
   * @param {object} params
   * @param {number} params.amount
   * @param {string} [params.description]
   * @param {number|null} [params.turn]
   */
  async execute({ amount, description = 'Maintenance bâtiments', turn = null }) {
    const budget = await this.getTreasurySnapshot.execute();
    const effectiveTurn = turn ?? budget.turn;

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      console.error(`Invalid building maintenance amount: ${amount}`);
      return budget;
    }

    if (amount <= 0) {
      return budget;
    }

    const houses = await this.houseReadPort.listHouses();
    const maintenanceBreakdown = accumulateBuildingMaintenanceBreakdown(houses);

    await this.recordMaintenanceExpense.execute({
      turn: effectiveTurn,
      amount,
      description,
      maintenanceBreakdown,
    });

    return this.getTreasurySnapshot.execute();
  }
}
