# Plan — real wages: a payroll from staffing, employer contributions, a deficit that shows

Decided 2026-10-11. The game is meant to teach accounting and economics, so a company's wages must work as in a real firm. Bankruptcy
(a closing, a replacement of the building) is **later**: for now a company that cannot cover its costs only shows a **deficit**, with no
effect on the building or its activity.

## 1. What is wrong today

A lucrative building pays its workers a **share of its sales** (`wagesPaidOf` in `ProducerChargePolicy.js` = sales × `WAGE_RATE_BY_ROLE`,
`ProducerChargeCatalog.js`: producer 15 %, hub 10 %, distributor 15 %, finance 10 %). It is backwards:

| Today | In a real firm |
|---|---|
| Wages follow sales | Wages follow staffing: a worker is paid whether the firm sells or not |
| A staffed building with no sale pays nothing (the nuclear plant with 8 workers) | It pays its payroll and shows a loss |
| A building is never loss-making through its payroll | A payroll above the margin is the usual cause of a loss |
| Wages cannot enter a price | Labour is a cost of each unit, so it enters the price |
| One rate per role, whatever the skill | A wage per qualification |
| No employer contribution; the unemployment benefit is paid by the city treasury | The firm pays contributions (645) that fund the benefit |

Consequence for the analysis tools: the break-even and the ratios (`ratiosOf`) already class wages as **fixed** charges; with a payroll that is
paid whatever the sales, that classification becomes true instead of a convention.

## Status (2026-10-11)

**Step 1 built, not yet played in the app.** `payrollOf` (ProducerChargePolicy.js) = staffed workers × `wagePerWorkerOf`; the grid is
`WAGE_FACTOR_BY_SKILL_LEVEL` (ProducerChargeCatalog.js: level 1 ×1, level 2 ×1.4, level 3 ×1.9). **Deviation from the plan:** the wage is the factor
times the city's **reference salary** (`salaryPerMonth`, 100 by default, the one the unemployment benefit and the income tax brackets are set on),
not a euro figure per skill: one lever moves every wage and the benefit with it (it is the minimum-wage lever of step 6 already). Per-skill
factors (a scholar paid more than an artisan) are not declared yet, only per level. `WAGE_RATE_BY_ROLE` and the sales basis are gone; the monthly
settlement computes the payroll from `workerSources` at the settlement, and the circular "wages ↔ sales ↔ bills" loop of the settlement now settles in
one pass. Houses' own businesses still pay no wage (the SCOP step).

**Calibration, still to do with a play-through.** The fiscal defaults (reference salary 100, benefit 70, brackets 50 / 150, citizen tax 25) assume a
wage near 100 a month. The economy's own scale is lower: a citizen's needs cost about 19 a month at today's prices (goods 17, water and
energy 1), and the whole city's final spending is about 19 × its population. A payroll of ~100 per worker therefore puts every company in
deficit by several times its sales, and the households richer than their needs. It is the expected consequence of "deficit only, no effect"; making
the figures plausible means choosing between a lower reference salary (and rescaling the benefit, the brackets and the citizen tax with it) and higher
prices or productivity (the labour in the price, step 3).

## 2. The target model

**Gross wage.** The catalog declares a **monthly gross wage per skill and skill level**, in one place (next to the skills, `skillCatalog.js`, or a
wage grid beside `ProducerChargeCatalog.js`). A building's payroll for a month is the sum, over the workers staffed in it that month, of the
wage of the skill and level its entry requires (`employment.requiredSkill`, `requiredSkillLevel`). No fallback: a skill with no wage throws.

**Employer cost.** Gross wage + **employer contributions** (a rate on the gross wage). Booked as:
- 641 *Rémunérations du personnel*: the gross wages, paid to the workers' houses;
- 645 *Charges de sécurité sociale*: the employer contributions, paid to a **social-security account** of the city.

**Net pay.** The household receives the gross wage less the **employee contributions** (a rate withheld at the source), then the existing income
tax withholding (`payroll_tax`) applies as today. The household's own accounting keeps reading the net wage received.

**Social-security account.** Employer and employee contributions land on a city account (PCG class 43, *organismes sociaux*). The
**unemployment benefit** is paid from it (today it comes from the treasury). The account can run in deficit; the city covers it, shown as a
transfer. This closes the loop: contributions → benefit → household income.

**Timing.** The payroll is settled with the other monthly charges (first day of the following month, as now), on the month's staffing, once per
building and month (the existing business key `type:hamletId:year:month` keeps it idempotent).

**Deficit, no bankruptcy.** A company whose cash goes negative keeps working and keeps paying its payroll; its account shows a negative cash
and a loss. The ratios and the break-even tell the player why. (Later: the bankruptcy system, bank loans and company starting funds — see
`PLAN_IMPORTS_PRICES_CAPITAL.md`, phase 5.)

## 3. Steps

1. **Wage grid and payroll from staffing.**
   - Declare the grid; remove `WAGE_RATE_BY_ROLE` and `wagesPaidOf`'s sales basis; compute a building's payroll from its staffed workers and
     their skill level; keep `wageSplitLines` to split it among the houses the workers come from.
   - **Calibrate** the grid against a household's needs (a house must be able to buy its food, water and energy from its wages) and against what
     the buildings earn today: every company's balance changes here, so this step is tuned together with step 3.
   - Fix the prefab (`src/shared/prefabs/anoria-tour-116/`): its stored wage lines and company balances were produced by the old rule; fix the JSON
     directly, no runtime migration.
   - Tests: payroll follows staffing and not sales (core rule); a staffed building with no sale pays its payroll.
2. **Contributions and the social-security account.**
   - Employer rate (645) and employee rate (withheld) in the catalog; new journal types in `PcgJournalCatalog.js` with their tone and account
     (645, 431/4375 as the PCG model asks); the statement's "Cotisations sociales" line starts to be fed.
   - The unemployment benefit paid from the social account; the city ledger shows the transfer that covers a deficit of that account.
3. **Labour in the price.** Each unit's price chain includes the payroll per unit (`PLAN_IMPORTS_PRICES_CAPITAL.md`, phase 3: margins and VAT), so
   a good made by well-paid workers costs more and a firm can price its way out of a deficit.
4. **Legibility.**
   - Finances tab: the wage line lists the payroll by skill and the contributions apart (the small grey items already do this); a staffed but
     idle building shows its loss.
   - Ratios: wages are fixed charges (done); add the wage cost per worker and the share of the value added going to wages (a classic ratio).
5. **SCOP participation and allocation (section 4).** The 691 line in the statement; the allocation of the result (legal and statutory
   reserves, dividends on the parts sociales, retained earnings) under the net result; `dividend_received` on the household's personal account;
   the household budget shows the salary and the dividends apart (the salary is the stable part).
6. **Wage policy (later).** A minimum wage set by the city, next to the customs duties, as a lever with a trade-off (households richer, firms
   squeezed). Competition between firms for workers comes after.

## 4. House businesses are SCOPs

A house's own business (an artisan's, a savant's, a merchant's) is a **cooperative (SCOP)**: the residents all work in it and are all its associates
(decided 2026-10-11, the social form particular to this game). It replaces the "SAS-like salaried associates" idea. The rules:

- **Salary.** The residents are paid like any employee: same wage grid, same contributions, same payroll from staffing (steps 1 and 2). A charge
  at 641 and 645, certain, whatever the profit. It settles the open point "does a house business pay a wage": yes.
- **Participation (the workers' share of profit).** A share of the profit goes to the workers as a charge booked before the tax on profits: PCG
  **691** *Participation des salariés aux résultats*. The compte de résultat gets one more line, just above the tax on profits (695).
- **Allocation of what is left after tax**, shown under "Bénéfice ou perte" and **not** a charge of the statement:
  - **reserves**: the legal reserve (1061) and the statutory reserves stay in the business and cannot be shared out; they are its equity;
  - **dividends on the parts sociales**: a capped share paid to the associates through 457 *Dividendes à payer*; it reaches the house's
    personal account as a new journal type `dividend_received` (household tone, like wages);
  - **retained earnings** for the rest.
- **Cooperative traits kept in the catalog:** one person, one vote (a decision of the business is the residents'), a majority of the capital held
  by the workers, reserves that are never distributed.
- **The rates** (source: entreprendre.service-public.gouv.fr/vosdroits/F31328, read 2026-10-11). The net profit is split in three parts:

  | Part | Rule | Usual | Game default |
  |---|---|---|---|
  | **Part entreprise** (reserves) | at least **15 %** to the legal reserve and at least **1 %** to a statutory reserve, the *fonds de développement*; the rest to other reserves | 40 % or 45 % | 45 % |
  | **Part salarié** (participation, 691) | at least **25 %**; employees need 3 months' presence in the year or 6 months' seniority | 40 % or 45 % | 40 % |
  | **Part associé** (interest on the parts sociales, 457) | only if the statutes provide for it; no hard cap, but lower than both other parts | 10 % or 15 % | 15 % |

  The 15 %, 1 % and 25 % are minimums, the page gives no maximum. The catalog declares the three shares of a house business (defaults above, the
  minimums are checked) so a later policy can let the residents change them within the minimums.
- **Capital and votes** (the page): the employee-associates hold at least **51 %** of the capital and **65 %** of the votes; outside investors keep
  at most 35 % of the votes. In a house business every resident is an associate, so both hold by construction.
- **Not on the page:** a probationary period before becoming an associate, and any pay-gap rule between highest and lowest salary: the game does
  not impose either.
- **Base to confirm:** the page speaks of the *excédent net de gestion*. Whether the shares apply before the participation and the tax (the
  accounting reading: participation 691 is a charge before the tax) or after must be settled when step 5 is written.

## 5. Decided / open

Decided:
- Payroll follows staffing, not sales; wages are fixed charges; contributions fund the unemployment benefit; a deficit has no effect on the
  building for now.

Open (to settle when step 1 starts):
- The wage grid values and the contribution rates (France as a reference, or a simplified game scale).
- The base the three SCOP shares apply to (section 4), and how the capital (parts sociales) of a house business starts (the company founding
  funds of `PLAN_IMPORTS_PRICES_CAPITAL.md`, phase 5, are an advance, not capital).
- What a building staffed by fewer workers than it needs pays and produces (production already follows staffing in places; check it follows it
  everywhere before the payroll relies on it).
