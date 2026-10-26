import { buildProducerLineBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { PAYABLE_KINDS } from '../../domain/catalogs/PayableCatalog.js';
import { hasCounterpart } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

/**
 * The lines a company's debts are written with, shared by the monthly settlement (SettleProducerCharges) and the liquidation of a demolished building
 * (LiquidateDemolishedBuilding): one way to write a line and to pay a debt, so the two never drift apart.
 */

/** The journal words of each line kind; the company's name is added in front. */
export const LINE_LABELS = Object.freeze({
  producer_revenue: 'Ventes HT',
  producer_purchase: 'Achats HT',
  producer_wage: 'Salaires des ouvriers',
  household_wage: 'Salaire perçu',
  employer_contribution: 'Cotisations patronales',
  social_contribution: 'Cotisations sociales perçues',
  maintenance: 'Entretien',
  premises_rent_paid: 'Loyer du local',
  premises_rent_received: 'Loyer du local perçu',
  wage_debt_paid: 'Salaires impayés réglés',
  contribution_debt_paid: 'Cotisations impayées réglées',
  corporate_tax_debt_paid: 'Impôt sur les sociétés impayé réglé',
  corporate_tax_debt_received: 'Impôt sur les sociétés impayé encaissé',
  contribution_debt_received: 'Cotisations impayées encaissées',
  premises_rent_debt_paid: 'Loyer du local impayé réglé',
  premises_rent_debt_received: 'Loyer du local impayé encaissé',
  subsidy_housing_received: 'Subvention entretien des maisons reçue',
  subsidy_companies: 'Subvention entretien entreprise',
  subsidy_housing: 'Subvention entretien habitation',
  corporate_tax: 'Impôt sur les sociétés',
  corporate_tax_revenue: 'Impôt sur les sociétés perçu',
  service_sales: 'Ventes de services',
  service_purchase: 'Achats de services',
  service_subsidy: 'Subvention versée',
  service_subsidy_received: 'Subvention reçue',
  subsidy_companies_received: 'Subvention entretien reçue',
  vat: 'TVA sur les services',
  income_tax: 'Impôt sur le revenu retenu',
  payroll_tax: 'Impôt sur le revenu perçu',
  income_tax_refund: 'Impôt sur le revenu remboursé',
  payroll_tax_refund: 'Impôt sur le revenu remboursé aux foyers',
  unemployment_benefit: 'Allocation chômage versée',
  household_benefit: 'Allocation chômage perçue',
  salary: 'Traitement versé',
  public_wage: 'Traitement perçu',
  liquidation_stock_sale: 'Stock vendu en liquidation',
  wage_guarantee: 'Salaires impayés avancés par la ville',
  liquidation_surplus_paid: 'Caisse rendue à la ville',
  liquidation_surplus_received: 'Capital rendu par une entreprise liquidée',
  aid_loan_repaid: 'Prêt de la ville remboursé',
  aid_loan_repayment_received: 'Prêt à une entreprise remboursé',
});

/**
 * A private movement is one journal line: the journal is the only record of value, and its business key makes the write idempotent.
 * @param {{ recordLedgerEntry: Function }} deps
 * @param {{ kind: string, amount: number, holder: string | null, counterparty: string | null, accountKind?: string | null, flow?: string | null, legs?: Array<object>, resource?: string }} line
 * @param {{ time: number, key: string, description: string, buildingInstanceId: string, timeInfo: { year: number, monthIndex: number } }} written
 * @param {{ refuseDuplicate?: boolean }} [options] `refuseDuplicate`: a line that was already written is a defect, not a month already settled (the liquidation, once)
 */
export async function recordLine(deps, line, { time, key, description, buildingInstanceId, timeInfo }, { refuseDuplicate = false } = {}) {
  // A line that is one side of a flow between accounts names the flow (null when the other side is booked elsewhere): the other account books its own écriture
  // of it with the same transactionId, so the two can be set against one another. A writer that forgets is a defect.
  if (line.flow === undefined && hasCounterpart(line.kind)) {
    throw new Error(`[producer] the ${line.kind} line for ${description} is one side of a flow between accounts and names no flow (set \`flow\`, or null when its other side is booked elsewhere)`);
  }
  const result = await deps.recordLedgerEntry({
    turn: time,
    type: line.kind,
    amount: line.amount,
    description,
    businessKey: key,
    buildingInstanceId,
    accountBuildingId: line.holder,
    accountKind: line.accountKind ?? null,
    counterpartyBuildingId: line.counterparty,
    resource: line.resource ?? null,
    // The legs of an écriture with more than two (a payslip that withholds); the journal gives the others their two.
    legs: line.legs ?? null,
    transactionId: line.flow ? `${timeInfo.year}:${timeInfo.monthIndex}:${line.flow}` : null,
  });
  // A month already settled is not charged again; any other refusal is a defect, not a skipped line.
  if (!result.recorded && (refuseDuplicate || result.reason !== 'duplicate_business_key')) {
    throw new Error(`[producer] the ${line.kind} line for ${description} was not recorded: ${result.reason}`);
  }
}

/**
 * A company's debt paid off, in whole or in part: the line of money against the debt account, and what the creditor receives (the house of the workers,
 * the city's social security or treasury, the owner).
 * @param {{ recordLedgerEntry: Function }} deps
 * @param {object} params
 * @param {{ kind: string, debtorId: string, creditorId: string | null, accountKind: string | null }} params.debt
 * @param {number} params.amount in euros
 * @param {{ businessAccount: string } | null} params.owner the property company that is owed the rents
 * @param {string} [params.keySuffix] tells this payment from the month's own settlement of the same debt (the liquidation pays in the month the building leaves)
 * @param {boolean} [params.refuseDuplicate]
 */
export async function recordDebtPayment(deps, { debt, amount, owner, time, timeInfo, hamletId, monthLabel, nameOf, keySuffix = '', refuseDuplicate = false }) {
  const settlement = PAYABLE_KINDS[debt.kind].settlement;
  const creditorKey = debt.creditorId ?? 'city';
  const write = (line, description) => recordLine(deps, line, {
    time,
    key: buildProducerLineBusinessKey(line.kind, `${debt.debtorId}:${creditorKey}${keySuffix}`, timeInfo, hamletId),
    description,
    buildingInstanceId: debt.debtorId,
    timeInfo,
  }, { refuseDuplicate });
  const to = debt.creditorId ? ` → ${nameOf(debt.creditorId)}` : '';
  // The debtor pays and the creditor receives: two écritures, one flow.
  const flow = `debt:${debt.kind}:${debt.debtorId}:${creditorKey}${keySuffix}`;
  await write({ kind: settlement, amount, holder: debt.debtorId, counterparty: debt.creditorId, accountKind: debt.accountKind, flow }, `${LINE_LABELS[settlement]} ${nameOf(debt.debtorId)}${to} - ${monthLabel}`);
  const credit = {
    wage: { kind: 'household_wage', amount, holder: debt.creditorId, counterparty: debt.debtorId, accountKind: PERSONAL_ACCOUNT, flow },
    // The city collects what it had booked as a receivable: not a product a second time.
    contribution: { kind: 'contribution_debt_received', amount, holder: null, counterparty: debt.debtorId, flow },
    corporate_tax: { kind: 'corporate_tax_debt_received', amount, holder: null, counterparty: debt.debtorId, flow },
    premises_rent: { kind: 'premises_rent_debt_received', amount, holder: debt.creditorId, counterparty: debt.debtorId, accountKind: owner?.businessAccount, flow },
  }[debt.kind];
  await write(credit, `${LINE_LABELS[credit.kind]} de ${nameOf(debt.debtorId)} - ${monthLabel}`);
}
