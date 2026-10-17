import { buildRentBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { businessAccountOf } from '../../domain/policies/AccountKeyPolicy.js';
import { houseEnterpriseOf } from '../../../../shared/population/workforceQueries.js';
import { rentDebtsOf } from '../../domain/policies/RentPolicy.js';

/**
 * Application service — a house whose inhabitants have all left still carries the rent debt they left. There is no prosecution in the game: the owner
 * knows it will not be paid, so the debt is written off (`info_rent_written_off`, informative: it moves no money, the rents it never received were
 * already missing from its cash). The next inhabitants start clean. Once a month, after the departures; a debt is written off once.
 */
export class WriteOffVacantRentDebts {
  /**
   * @param {object} deps
   * @param {() => Promise<{ ownerId: string, ownerType: string, vacantIds: string[] } | null>} deps.getRentalHouses null when no house is an owner
   * @param {(turn: number) => { year: number, monthIndex: number }} deps.getTimeInfo
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number }} params the turn the lines are dated by */
  async execute({ time }) {
    const rentals = await this.deps.getRentalHouses();
    if (!rentals) return;
    const debts = rentDebtsOf(await this.deps.getJournalEntries());
    const timeInfo = this.deps.getTimeInfo(time);
    const ownerAccount = businessAccountOf(houseEnterpriseOf(rentals.ownerType, 'rental').id);
    for (const houseId of rentals.vacantIds) {
      const debt = debts.get(houseId) ?? 0;
      if (!(debt > 0)) continue;
      const result = await this.deps.recordLedgerEntry({
        turn: time,
        type: 'info_rent_written_off',
        amount: debt,
        description: `[Informatif] Loyer impayé abandonné, maison vidée - ${timeInfo.year}`,
        businessKey: buildRentBusinessKey('info_rent_written_off', houseId, rentals.ownerId, timeInfo.year, timeInfo.monthIndex),
        accountBuildingId: rentals.ownerId,
        accountKind: ownerAccount,
        counterpartyBuildingId: houseId,
      });
      if (!result.recorded && result.reason !== 'duplicate_business_key') {
        throw new Error(`[rent] the write-off of house ${houseId} was not recorded: ${result.reason}`);
      }
    }
  }
}
