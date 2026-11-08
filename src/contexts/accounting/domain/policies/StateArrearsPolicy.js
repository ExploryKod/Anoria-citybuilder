/**
 * The State's arrears, DERIVED from the journal and never stored (StateArrearsCatalog.js).
 *
 * The State books what it could not pay as an opération diverse `od_state_arrears_<kind>` on its own account, naming the one it owes (`counterpartyBuildingId`: the house of
 * the households, the company of the services). The payment `state_arrears_paid_<kind>` and the abandonment `od_state_arrears_abandoned_<kind>` (the creditor is gone) lower
 * it. What is left is the debt. Sums are in centimes, so the figures are exact.
 */
import { STATE_ARREARS_KINDS, stateArrearsTypesOf } from '../../../../shared/accounting-catalog/StateArrearsCatalog.js';

const toCentimes = (amount) => Math.round(amount * 100);

/** The arrears' line types, each with the kind it belongs to and which way it moves the debt. */
const TYPES = new Map(Object.keys(STATE_ARREARS_KINDS).flatMap((kind) => {
  const { payable, settlement, abandonment } = stateArrearsTypesOf(kind);
  return [[payable, { kind, sign: 1 }], [settlement, { kind, sign: -1 }], [abandonment, { kind, sign: -1 }]];
}));

/** @param {string} type @returns {boolean} true for a line of the State's arrears (raising, paying or abandoning them) */
export function isStateArrearsType(type) {
  return TYPES.has(type);
}

/**
 * @param {Array<{ type: string, amount: number, accountBuildingId: string | null, counterpartyBuildingId?: string | null, description?: string }>} entries the journal lines
 * @returns {Array<{ kind: string, creditorId: string, rank: number, centimes: number }>} the arrears still open, by kind and creditor
 */
export function stateArrearsOf(entries) {
  const open = new Map();
  for (const entry of entries) {
    const facts = TYPES.get(entry.type);
    if (!facts) continue;
    if (entry.accountBuildingId) throw new Error(`[state-arrears] the ${entry.type} line "${entry.description}" is on an account (${entry.accountBuildingId}): the arrears are the State's`);
    if (!entry.counterpartyBuildingId) throw new Error(`[state-arrears] the ${entry.type} line "${entry.description}" names no creditor`);
    const key = `${facts.kind}|${entry.counterpartyBuildingId}`;
    const debt = open.get(key) ?? { kind: facts.kind, creditorId: entry.counterpartyBuildingId, rank: STATE_ARREARS_KINDS[facts.kind].rank, centimes: 0 };
    debt.centimes += facts.sign * toCentimes(entry.amount);
    open.set(key, debt);
  }
  return [...open.values()].filter((debt) => debt.centimes > 0);
}
