import { DEBT_CEILING_SHARE_OF_GDP, MINIMUM_DEBT_CEILING } from '../catalogs/PublicDebtCatalog.js';

/**
 * Where a State stands with its lenders: what it owes against the ceiling its economy allows.
 * @param {{ debt: number, gdp: number }} params euros: `debt` the State's gross public debt now (HamletEconomyPolicy.publicDebtOf); `gdp` its domestic product over a year
 *   (0 while none is measured yet)
 * @returns {{ debt: number, gdp: number, ceiling: number, headroom: number }} `headroom`: what it can still borrow (never negative)
 */
export function debtCeilingOf({ debt, gdp }) {
  for (const [name, value] of Object.entries({ debt, gdp })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`[public-debt] ${name} must be an amount of zero or more, got ${value}`);
  }
  const ceiling = Math.max(MINIMUM_DEBT_CEILING, Math.round(gdp * DEBT_CEILING_SHARE_OF_GDP));
  return { debt, gdp, ceiling, headroom: Math.max(0, ceiling - debt) };
}
