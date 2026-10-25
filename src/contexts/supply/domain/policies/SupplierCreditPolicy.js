/**
 * What a company can still buy from its suppliers this month, in euros: the money it has (negative when it is overdrawn), plus the credit
 * its suppliers give it (months of its own sales, see SUPPLIER_CREDIT_MONTHS), less what it has already bought this month and has not paid
 * yet (the settlement pays it at the end of the month). The credit is what the company sold over the last months its stage's credit covers (see
 * SUPPLIER_CREDIT_MONTHS_BY_STAGE). A company that sells little is lent little; one that has the money is not held back by
 * the credit. Never negative: a company at its limit buys nothing more until its sales bring money in.
 *
 * @param {object} params
 * @param {number} params.cash The company's cash, in euros
 * @param {number} params.creditLine What it sold over the past months its credit covers, in euros
 * @param {number} params.committed Purchases of the current month, not yet paid, in euros
 * @returns {number}
 */
export function purchasingPower({ cash, creditLine, committed }) {
  for (const [name, value] of Object.entries({ cash, creditLine, committed })) {
    if (!Number.isFinite(value)) throw new Error(`[supply] the purchasing power needs a number for ${name}, got ${value}`);
  }
  return Math.max(0, Math.round((cash + creditLine - committed) * 100) / 100);
}
