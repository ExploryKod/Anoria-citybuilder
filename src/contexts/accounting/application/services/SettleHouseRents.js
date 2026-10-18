import { buildRentBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { PERSONAL_ACCOUNT, businessAccountOf } from '../../domain/policies/AccountKeyPolicy.js';
import { houseEnterpriseOf, houseEnterprises } from '../../../../shared/population/workforceQueries.js';
import { rentDebtsOf, rentOfMonth } from '../../domain/policies/RentPolicy.js';
import { payablesOf, planCompanyPayments } from '../../domain/policies/DebtPolicy.js';
import { PAYABLE_KINDS } from '../../domain/catalogs/PayableCatalog.js';

/**
 * Application service — once a month, every house (the owner's own included) pays its rent to the owner (the mayor's house, whose residents hold the owner
 * skill). The rent falls due whether or not the house can pay (`info_rent_due`); the house pays what it owes, its debt included, as far as its money
 * goes (`rent_paid` on its personal account, `rent_received` on the owner's business account), and what it cannot pay stays a debt, derived from the
 * journal (see RentPolicy.js). With no owner there is nobody to be paid: no rent falls due. Run after the month's other charges, so the money a house
 * has is what is left of its month. Each line is written once per house and per month: the business key refuses a second one.
 */
export class SettleHouseRents {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<{ ownerId: string, ownerType: string, ownerName: string, tenants: Array<{ id: string, name: string }> } | null>} deps.getRentalHouses the house of the owner and the houses
   *   that pay it (named as the catalog names them, for the journal lines), or null when no house is an owner
   * @param {(rentals: object) => Promise<{ rent: number }>} deps.getRentQuote the monthly rent the owner asks each house: it deduces it from the upkeep it bears,
   *   within the hamlet's rent control (see rentQuoteOf)
   * @param {(rentals: object, houseType: string) => Promise<number>} deps.getPremisesRent the monthly rent of the premises a house's business works in (see premisesRentOf)
   * @param {(houseId: string, businessAccount: string) => Promise<number>} deps.businessFundsOf what a business account of a house holds now
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
    const { rent } = await this.deps.getRentQuote(rentals);
    const entries = await this.deps.getJournalEntries();
    const debts = rentDebtsOf(entries);
    const payables = payablesOf(entries);
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const { ownerId } = rentals;
    // The rents are the income of the owner's property company: its business account, not the house's other enterprises'.
    const ownerBusinessAccount = businessAccountOf(houseEnterpriseOf(rentals.ownerType, 'rental').id);

    for (const { id: tenantId, type, name } of rentals.tenants) {
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
          accountKind: ownerBusinessAccount,
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
          accountKind: ownerBusinessAccount,
          counterpartyBuildingId: tenantId,
        });
      }

      await this.#settlePremises({ tenant: { id: tenantId, type, name }, rentals, ownerBusinessAccount, payables, time, timeInfo, monthLabel });
    }
  }

  /**
   * The business of a house (its cooperative) rents the premises it works in from the owner, apart from the household's rent. It pays its old debt of
   * rent first, then the rent of the month, as far as its own account goes; what it cannot pay is a debt (see DebtPolicy.js), booked on both sides: a charge
   * to pay for the business, an income to collect for the owner.
   */
  async #settlePremises({ tenant, rentals, ownerBusinessAccount, payables, time, timeInfo, monthLabel }) {
    const business = houseEnterprises(tenant.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
    if (!business) return;
    const rent = await this.deps.getPremisesRent(rentals, tenant.type);
    const businessAccount = businessAccountOf(business.id);
    const { ownerId } = rentals;
    const owed = [...payables.values()].find((debt) => debt.debtorId === tenant.id && debt.accountKind === businessAccount && debt.kind === 'premises_rent' && debt.creditorId === ownerId);
    if (!(rent > 0) && !owed) return;
    const rank = PAYABLE_KINDS.premises_rent.rank;
    const plan = planCompanyPayments({
      cash: Math.round((await this.deps.businessFundsOf(tenant.id, businessAccount)) * 100),
      debts: owed ? [{ id: 'debt', rank, amount: owed.centimes }] : [],
      charges: [{ id: 'rent', rank, amount: Math.round(rent * 100) }],
    });
    const names = `${tenant.name} · ${business.label} → ${rentals.ownerName}`;
    const pay = async (paidType, receivedType, centimes, label) => {
      if (centimes <= 0) return;
      const key = (type) => buildRentBusinessKey(type, tenant.id, ownerId, timeInfo.year, timeInfo.monthIndex);
      await this.#record({ turn: time, type: paidType, amount: centimes / 100, description: `${label} payé ${names} - ${monthLabel}`, businessKey: key(paidType), accountBuildingId: tenant.id, accountKind: businessAccount, counterpartyBuildingId: ownerId });
      await this.#record({ turn: time, type: receivedType, amount: centimes / 100, description: `${label} perçu ${names} - ${monthLabel}`, businessKey: key(receivedType), accountBuildingId: ownerId, accountKind: ownerBusinessAccount, counterpartyBuildingId: tenant.id });
    };
    await pay(PAYABLE_KINDS.premises_rent.settlement, 'premises_rent_debt_received', plan.debtPaid.get('debt') ?? 0, 'Loyer du local impayé');
    await pay('premises_rent_paid', 'premises_rent_received', plan.chargePaid.get('rent') ?? 0, 'Loyer du local');
    const unpaid = plan.chargeUnpaid.get('rent') ?? 0;
    if (unpaid > 0) {
      await this.#record({ turn: time, type: PAYABLE_KINDS.premises_rent.payable, amount: unpaid / 100, description: `[OD] Loyer du local non payé ${names} - ${monthLabel}`, businessKey: buildRentBusinessKey(PAYABLE_KINDS.premises_rent.payable, tenant.id, ownerId, timeInfo.year, timeInfo.monthIndex), buildingInstanceId: tenant.id, accountBuildingId: tenant.id, accountKind: businessAccount, counterpartyBuildingId: ownerId });
      await this.#record({ turn: time, type: 'od_receivable_premises_rent', amount: unpaid / 100, description: `[OD] Loyer du local à encaisser ${names} - ${monthLabel}`, businessKey: buildRentBusinessKey('od_receivable_premises_rent', tenant.id, ownerId, timeInfo.year, timeInfo.monthIndex), buildingInstanceId: tenant.id, accountBuildingId: ownerId, accountKind: ownerBusinessAccount, counterpartyBuildingId: tenant.id });
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
