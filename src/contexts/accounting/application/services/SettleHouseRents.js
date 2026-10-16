import { buildRentBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { BUSINESS_ACCOUNT, PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { rentDebtsOf, rentOfMonth } from '../../domain/policies/RentPolicy.js';

/**
 * Application service — once a month, every house but the owner's pays its rent to the owner (the mayor's house, whose residents hold the owner
 * skill). The rent falls due whether or not the house can pay (`info_rent_due`); the house pays what it owes, its debt included, as far as its money
 * goes (`rent_paid` on its personal account, `rent_received` on the owner's business account), and what it cannot pay stays a debt, derived from the
 * journal (see RentPolicy.js). With no owner there is nobody to be paid: no rent falls due. Run after the month's other charges, so the money a house
 * has is what is left of its month. Each line is written once per house and per month: the business key refuses a second one.
 */
export class SettleHouseRents {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<{ ownerId: string, ownerName: string, tenants: Array<{ id: string, name: string }> } | null>} deps.getRentalHouses the house of the owner and the houses
   *   that pay it (named as the catalog names them, for the journal lines), or null when no house is an owner
   * @param {() => Promise<number>} deps.getRentPerHouse the monthly rent the hamlet sets
   * @param {() => Promise<Array<object>>} deps.getJournalEntries the journal lines (the debts are derived from them)
   * @param {(houseId: string) => Promise<number>} deps.fundsOf what a house has in its personal account now
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the lines are dated by
   * @param {number} params.deliveredTime a turn of the month being settled
   */
  async execute({ time, deliveredTime }) {
    const rentals = await this.deps.getRentalHouses();
    if (!rentals) return;
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const rent = await this.deps.getRentPerHouse();
    const debts = rentDebtsOf(await this.deps.getJournalEntries());
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const { ownerId } = rentals;

    for (const { id: tenantId, name } of rentals.tenants) {
      const month = rentOfMonth({
        rent,
        debt: debts.get(tenantId) ?? 0,
        funds: await this.deps.fundsOf(tenantId),
      });
      const names = `${name} → ${rentals.ownerName}`;

      if (month.due > 0) {
        await this.#record({
          turn: time,
          type: 'info_rent_due',
          amount: month.due,
          description: `[Informatif] Loyer dû ${names} - ${monthLabel}`,
          businessKey: buildRentBusinessKey('info_rent_due', tenantId, ownerId, timeInfo.year, timeInfo.monthIndex),
          accountBuildingId: ownerId,
          accountKind: BUSINESS_ACCOUNT,
          counterpartyBuildingId: tenantId,
        });
      }
      if (month.paid > 0) {
        await this.#record({
          turn: time,
          type: 'rent_paid',
          amount: month.paid,
          description: `Loyer payé ${names} - ${monthLabel}`,
          businessKey: buildRentBusinessKey('rent_paid', tenantId, ownerId, timeInfo.year, timeInfo.monthIndex),
          accountBuildingId: tenantId,
          accountKind: PERSONAL_ACCOUNT,
          counterpartyBuildingId: ownerId,
        });
        await this.#record({
          turn: time,
          type: 'rent_received',
          amount: month.paid,
          description: `Loyer perçu ${names} - ${monthLabel}`,
          businessKey: buildRentBusinessKey('rent_received', tenantId, ownerId, timeInfo.year, timeInfo.monthIndex),
          accountBuildingId: ownerId,
          accountKind: BUSINESS_ACCOUNT,
          counterpartyBuildingId: tenantId,
        });
      }
    }
  }

  /** A month already settled is not charged again; any other refusal is a defect, not a skipped line. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[rent] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}
