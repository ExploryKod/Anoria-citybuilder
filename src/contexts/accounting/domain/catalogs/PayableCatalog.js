/**
 * The operating debts a company can owe, declared once. A charge a company cannot pay for lack of money becomes a debt to the one it is due to; the
 * debt is paid, oldest first, as soon as the company has the money. Each kind says:
 *   - `rank`: who is paid first when the money does not cover everyone (the lowest rank first; the creditors of one rank share what is left in
 *     proportion to what they are owed): the workers' wages, then the city (social contributions, taxes), then the owner (the rent of the premises);
 *   - `payable`: the opération diverse that records the debt (the charge to pay, against the debt account);
 *   - `settlement`: the line of money that pays it off (see PcgJournalCatalog).
 *
 * A debt is derived from these lines (see DebtPolicy), never stored.
 */
export const PAYABLE_KINDS = Object.freeze({
  wage: Object.freeze({ rank: 1, payable: 'od_payable_wage', settlement: 'wage_debt_paid', forgiven: 'od_forgiven_wage', badDebt: null, label: 'Salaires' }),
  contribution: Object.freeze({ rank: 2, payable: 'od_payable_contribution', settlement: 'contribution_debt_paid', forgiven: 'od_forgiven_contribution', badDebt: 'od_bad_debt_contribution', label: 'Cotisations sociales' }),
  corporate_tax: Object.freeze({ rank: 2, payable: 'od_payable_corporate_tax', settlement: 'corporate_tax_debt_paid', forgiven: 'od_forgiven_corporate_tax', badDebt: 'od_bad_debt_corporate_tax', label: 'Impôt sur les sociétés' }),
  premises_rent: Object.freeze({ rank: 3, payable: 'od_payable_premises_rent', settlement: 'premises_rent_debt_paid', forgiven: 'od_forgiven_premises_rent', badDebt: 'od_bad_debt_premises_rent', label: 'Loyer du local' }),
});

/**
 * A liquidated company sells its stock to the market for this share of what it cost it (a forced sale). The money pays its creditors by rank, like any
 * money it holds; what it cannot pay is then forgiven (see LiquidationPolicy). First value, to tune with a play-through.
 */
export const LIQUIDATION_RECOVERY_RATE = 0.5;

/**
 * The founding capital the city pays a company when it is created, in months of its own charges at full staffing (wages, the employer's contributions,
 * upkeep or rent). It is the company's equity (capital, 101), not a loan: it is never repaid. It is what lets a company start with money: it pays its
 * first wages with it, sells, and earns it back; a company that earns nothing spends it in about this many months, which is when its debts begin.
 * First value, to tune with a play-through.
 */
export const FOUNDING_CAPITAL_MONTHS = 2;

/** How the building's problems say a company cannot pay what it owes: an icon and a short word (the detail goes in the tooltip). */
export const INSOLVENCY_DISPLAY = Object.freeze({ icon: '💸', label: 'impayés' });

/** How the building's problems say a company has been liquidated (closed for good). */
export const LIQUIDATION_DISPLAY = Object.freeze({ icon: '🔒', label: 'liquidée' });

/**
 * How many months in a row a company may go on without paying what it owes before it is liquidated (the end of the grace period; see the
 * bankruptcy plan, docs/gameplay/PLAN_BANKRUPTCY_PAYABLES.md).
 */
export const INSOLVENCY_GRACE_MONTHS = 3;
