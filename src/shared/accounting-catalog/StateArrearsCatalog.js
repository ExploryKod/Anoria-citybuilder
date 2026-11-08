/**
 * The payments the State owes and cannot make when its Treasury is empty become arrears, as a company's unpaid charges become debts (PayableCatalog.js): the State books
 * the expense against what it owes (401) and pays it, the lowest rank first, as soon as its Treasury holds the money. Each kind says:
 *   - `rank`: who is paid first when the money does not cover everyone (the households' pay and benefits, then the subsidies to the services);
 *   - `expenseAccount`: the account of the expense the State books when it falls due (the same its payment would have debited);
 *   - `creditorKind`: the line the one it owes books when it is finally paid (its usual receipt, without the withholding of the original payslip);
 *   - `household`: whether that creditor is a household (its personal account) or a company;
 *   - `label`: the words of the journal.
 * The kinds are those whose State line names the one paid. The upkeep and the subsidies that name no creditor (a house's upkeep, the subsidies to the companies and to the
 * housing owners) stay unpaid and are not carried: a limit still to lift.
 *
 * Three journal types are generated for each kind (PcgJournalCatalog.js): the arrears (an opération diverse), the payment, and the abandonment of the arrears owed to a
 * building that is gone. A debt is derived from them (StateArrearsPolicy), never stored.
 */
export const STATE_ARREARS_KINDS = Object.freeze({
  salary: Object.freeze({ rank: 1, expenseAccount: '6411', creditorKind: 'public_wage', household: true, label: 'Traitements' }),
  unemployment_benefit: Object.freeze({ rank: 1, expenseAccount: '4378', creditorKind: 'household_benefit', household: true, label: 'Allocations chômage' }),
  sickness_benefit: Object.freeze({ rank: 1, expenseAccount: '431', creditorKind: 'household_sickness_benefit', household: true, label: 'Indemnités maladie et invalidité' }),
  service_subsidy: Object.freeze({ rank: 2, expenseAccount: '65738', creditorKind: 'service_subsidy_received', household: false, label: 'Aides aux services publics' }),
});

/** @param {string} kind a key of STATE_ARREARS_KINDS @returns {{ payable: string, settlement: string, abandonment: string }} the journal types of its arrears */
export function stateArrearsTypesOf(kind) {
  if (!STATE_ARREARS_KINDS[kind]) throw new Error(`[state-arrears] "${kind}" is not a payment the State carries as arrears (${Object.keys(STATE_ARREARS_KINDS).join(', ')})`);
  return { payable: `od_state_arrears_${kind}`, settlement: `state_arrears_paid_${kind}`, abandonment: `od_state_arrears_abandoned_${kind}` };
}
