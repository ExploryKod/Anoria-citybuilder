import { DEBT_CEILING_SHARE_OF_GDP, MINIMUM_DEBT_CEILING } from '../catalogs/PublicDebtCatalog.js';

/**
 * Where a State stands with its lenders: what it owes against the ceiling its economy allows.
 * @param {{ debt: number, gdp: number }} params euros: `debt` the State's gross public debt now (HamletEconomyPolicy.publicDebtOf); `gdp` its domestic product over a year
 *   (0 while none is measured yet; below nothing while the companies lose more than the State's administration produces, as in a young economy: the ceiling then rests on its minimum)
 * @returns {{ debt: number, gdp: number, ceiling: number, headroom: number }} `headroom`: what it can still borrow (never negative)
 */
export function debtCeilingOf({ debt, gdp }) {
  if (!Number.isFinite(debt) || debt < 0) throw new Error(`[public-debt] debt must be an amount of zero or more, got ${debt}`);
  if (!Number.isFinite(gdp)) throw new Error(`[public-debt] gdp must be a number, got ${gdp}`);
  // A domestic product below nothing (the companies' value added is negative in their first months) lends no ceiling of its own: only the minimum stands.
  const ceiling = Math.max(MINIMUM_DEBT_CEILING, Math.round(Math.max(0, gdp) * DEBT_CEILING_SHARE_OF_GDP));
  return { debt, gdp, ceiling, headroom: Math.max(0, ceiling - debt) };
}
