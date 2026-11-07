/**
 * Whether a company has staff in post: some worker is assigned to it by a house that stands. One reading, for the settlement and the Health panel.
 * @param {Record<string, number>} assignedSources `{ houseId: workers }` of the company, the houses that no longer stand already left out
 * @returns {boolean}
 */
export function isStaffed(assignedSources) {
  return Object.values(assignedSources).some((workers) => workers > 0);
}

/**
 * Whether the law of compulsory insurance can be, and is, in force (see InsuranceCatalog.js). Read from the same facts wherever it is asked — the settlement of the month,
 * the Health panel — so they cannot disagree. An insurance that works is a company that stands, has staff in post, and is not in default (its debts open under the grace months).
 *
 * @param {object} params
 * @param {boolean} params.mandatory the player's setting
 * @param {Array<{ staffed: boolean, defaultMonths: number }>} params.companies the insurance companies that stand
 * @param {number} params.graceMonths the months of unpaid debts after which a company is liquidated (PayableCatalog's INSOLVENCY_GRACE_MONTHS)
 * @returns {{ mandatory: boolean, available: boolean, inForce: boolean, reasons: Array<'noCompany' | 'notStaffed' | 'allInDefault'> }}
 *   `available`: the law can be passed; `inForce`: it is set and available; `reasons`: why it is not available (empty when it is)
 */
export function insuranceLawStatusOf({ mandatory, companies, graceMonths }) {
  if (typeof mandatory !== 'boolean') throw new Error(`[insurance-law] the law is set or not, got ${mandatory}`);
  const reasons = [];
  if (companies.length === 0) reasons.push('noCompany');
  else if (!companies.some((company) => company.staffed)) reasons.push('notStaffed');
  else if (!companies.some((company) => company.staffed && company.defaultMonths < graceMonths)) reasons.push('allInDefault');
  const available = reasons.length === 0;
  return { mandatory, available, inForce: mandatory && available, reasons };
}
