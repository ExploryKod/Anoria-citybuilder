import { buildProducerLineBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { payByRank } from '../../domain/policies/DebtPolicy.js';
import { stateArrearsOf } from '../../domain/policies/StateArrearsPolicy.js';
import { STATE_ARREARS_KINDS, stateArrearsTypesOf } from '../../../../shared/accounting-catalog/StateArrearsCatalog.js';
import { recordLine } from './DebtLines.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — each month, before the month's own payments, the State pays what it owes from the months it could not pay (StateArrearsCatalog.js), the lowest
 * rank first and in proportion within a rank, as far as its Treasury holds the money. The one it owes receives its usual receipt (without the withholding of the original
 * payslip, a limit). Arrears owed to a building that is gone are abandoned. Each line once (business key per creditor, kind and month).
 */
export class SettleStateArrears {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {() => Promise<number>} deps.stateCash the Treasury's money now, in centimes
   * @param {() => Promise<Array<{ id: string, type: string }>>} deps.listBuildings the hamlet's buildings
   * @param {(buildingType: string) => string | undefined} deps.getBuildingDisplayName
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number }} params */
  async execute({ time }) {
    const debts = stateArrearsOf(await this.deps.getJournalEntries());
    if (debts.length === 0) return;
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const buildings = await this.deps.listBuildings();
    const nameOf = (id) => {
      const building = buildings.find((candidate) => candidate.id === id);
      return building ? this.deps.getBuildingDisplayName(building.type) ?? (() => { throw new Error(`[state-arrears] building ${id} has no catalog name for its journal lines`); })() : null;
    };
    const write = (line, suffix, description) => recordLine(this.deps, line, {
      time,
      key: buildProducerLineBusinessKey(line.kind, `${line.counterparty ?? line.holder}:${suffix}`, timeInfo, hamletId),
      description,
      buildingInstanceId: line.counterparty ?? line.holder,
      timeInfo,
    }, { stateMayBeShort: true });

    // The one a debt is owed to is gone (a house the player demolished): no one is left to be paid, the State is released.
    const alive = [];
    for (const debt of debts) {
      if (nameOf(debt.creditorId)) {
        alive.push(debt);
        continue;
      }
      await write(
        { kind: stateArrearsTypesOf(debt.kind).abandonment, amount: debt.centimes / 100, holder: null, counterparty: debt.creditorId, flow: null },
        `${debt.kind}:abandoned`,
        `[OD] ${STATE_ARREARS_KINDS[debt.kind].label} dus à un bâtiment disparu : dette abandonnée - ${monthLabel}`,
      );
    }

    const claims = alive.map((debt) => ({ id: `${debt.kind}|${debt.creditorId}`, rank: debt.rank, amount: debt.centimes }));
    const { paid } = payByRank(await this.deps.stateCash(), claims);
    for (const debt of alive) {
      const centimes = paid.get(`${debt.kind}|${debt.creditorId}`);
      if (!(centimes > 0)) continue;
      const facts = STATE_ARREARS_KINDS[debt.kind];
      const flow = `state_arrears:${debt.kind}:${debt.creditorId}`;
      const description = `${facts.label} impayés réglés : ${nameOf(debt.creditorId)} - ${monthLabel}`;
      const stateSide = await write({ kind: stateArrearsTypesOf(debt.kind).settlement, amount: centimes / 100, holder: null, counterparty: debt.creditorId, flow }, `${debt.kind}:paid`, description);
      if (!stateSide) continue;
      await write(
        { kind: facts.creditorKind, amount: centimes / 100, holder: debt.creditorId, counterparty: null, accountKind: facts.household ? PERSONAL_ACCOUNT : null, flow },
        `${debt.kind}:received`,
        description,
      );
    }
  }
}
