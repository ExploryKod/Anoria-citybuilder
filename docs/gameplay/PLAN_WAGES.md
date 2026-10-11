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

**Step 1 built, and the wages are now settled by the labour market (decided 2026-10-11), not played yet in the app.**
- **Payroll from staffing** (`payrollOf`, ProducerChargePolicy.js): staffed workers × the market wage of the skill and level their workplace requires.
  It is due whether or not the building sells. The circular "wages ↔ sales ↔ bills" loop of the settlement is gone (one pass).
- **A wage per (skill, level), settled by the market** (`WageRatePolicy.js`, `LabourMarketCatalog.js`): each month the worker distribution leaves,
  for each (skill, level) the workplaces ask for, the jobs, the ones filled, the vacancies and the qualified citizens left idle
  (`DistributeCityWorkers` → `employment.getLabourMarket()`). A shortage raises the wage, slack lowers it, `pressure × 0.5` capped at **5 % a month**,
  never under the minimum wage. The starting wages are 24 / 34 / 46 for levels 1 / 2 / 3.
- **Order in the monthly settlement:** the month is paid at the wages in force, then the market moves them for the month that opens
  (`ProcessTurnBudget` → `AdjustWageRates`). A move is a row of the append-only `wageRates` log (Dexie v21) with the reading that caused it. A wage not yet
  moved is at its starting wage; no reading yet (no distribution has run) moves nothing.
- **The city's levers:** the **minimum wage** (renamed from the "reference salary", `minimumWage`, default **20**, bounds 5–200) is the floor of every
  wage; the **unemployment benefit** is a share of it (70 % by default). The income tax brackets were rescaled to the economy (30 / 90).
- **The player is told:** a "Salaires" section of the administrator panel (the two levers, and per skill and level: the wage, its last move, the jobs,
  the ones filled, the idle, and the market's reading); the wage and the monthly payroll in each workplace's Personnel tab; the journal line of a payroll
  carries "n ouvriers à x €".
- **Not done:** the ceiling of what firms can afford (it needs the labour in the price, step 3), employer-specific wages, wages in a house's own business
  (the SCOP step), per-skill starting wages (only per level).
- **An older game still loads:** every session start writes the default of each fiscal rate a hamlet lacks (`ensureRates`), so an older hamlet
  gets the minimum wage and the contribution rates; its other rates (brackets, benefit) keep the values it had.

**Step 3, labour in the price: first half built (2026-10-12), the feedback on prices NOT built, on purpose.**
- **Built:** the cost of a unit is read, not yet charged. The Ratios pill of a company's account has a "Coût de revient d'une unité" block: the units sold
  the month of the activity (`sumUnitsSoldBySeller`, from the supply log), the average sale price, the operating charges over the units (wages and
  purchases included), and the result per unit. It is where a wage shows in a unit.
- **Correction (2026-10-12).** The first version of this plan set the wages on a scale of 24 and said a citizen's needs cost about 19 a month. That figure
  was wrong: it counted every good of a shared need (food is one unit a citizen, shared between wheat, carrot and cabbage, and the same for the other
  groups). A citizen's needs cost **about 5.8 a month** (food 1.1, goods 3.6, heat and light 0.5, water and energy 0.6), and what a worker produces is
  worth **6 to 15 a month** at the producers' price. So the catalog's productivity is not the problem; the wage scale was 3 times too high. The starting
  wages are now **8 / 11 / 15** (levels 1 / 2 / 3), the minimum wage **6**, the benefit 70 % of it, the income tax brackets 10 / 30 per household.
- **The unit cost at a wage of 8** (workers × wage + upkeep + inputs, over the units a month; the price is the producer's today, base value × 1.2):

  | Producer | Cost of a unit | Price today | Cost ÷ price |
  |---|---|---|---|
  | Farm of wheat / carrot / cabbage | 1.08 | 0.96 / 0.72 / 0.60 | 1.1 / 1.5 / 1.8 |
  | Olive field (120 a year) | 2.40 | 0.48 | 5.0 |
  | Plate / pot / amphora workshop | 3.20 | 6.0 / 3.6 / 4.8 | 0.5 / 0.9 / 0.7 |
  | Oil press / candle workshop | 3.8 / 4.4 | 2.4 / 1.8 | 1.6 / 2.4 |
  | Furniture workshop | 4.6 | 24 | 0.2 |
  | Lumberjack / industrial lumberjack | 1.6 / 2.2 | 1.2 | 1.3 / 1.8 |
  | Water tank | 0.04 | 0.125 | 0.3 |
  | Coal / petrol / nuclear plant (a MWh) | 0.30 | 0.10 | 3.0 |

  Most sectors are within a factor of two of their price: the catalog was built on a scale close to a wage of 8. The outliers are the olive field (a low
  yield), the candle workshop, the energy (priced at 0.1 a MWh against a cost of 0.3) and, the other way, the furniture workshop and the water tank.
- **Feedback on prices: built (2026-10-12, not played yet).** A producer's price is its **standard cost plus its margin (20 %)** (`standardUnitCostOf`,
  `PriceBook`): its month at full staffing (workers × the labour market's wage for the skill and level, its upkeep, the inputs it draws at the price its
  warehouse sells them at) over the units it makes in the month (a harvest spread over the year, a quantity a month, a cycle's output over its interval). So a wage, the
  minimum wage, a customs duty on the fuel, reach the producer's price, then the warehouse's and the market's (their margin on what they paid). The energy
  and the water that a plant or a tank makes are priced the same way and billed at that price (a service no producer makes, a school's lessons, keeps its
  base value). A house's own business (no workforce yet) keeps the reference chain. It is a standard cost: it does not move with how busy the building
  is, only with the wage, the upkeep and the price of its inputs.
- **The one catalog fix:** the olive field's yield went from 120 to 288 a year (the harvest of any other farm: its olives cost five times a wheat otherwise).
  The other outliers (candle, furniture, energy) are left as they are: the price now follows the cost.
- **What it does to the prices** (computed on the catalog with the starting wages, no import): the shelf prices move as
  wheat / carrot / cabbage 1.44 / 1.08 / 0.90 → 1.95 each; plate / pot / amphora 9.0 / 5.4 / 7.2 → 5.8 each; furniture 36 → 9.9; wood 1.8 → 2.9; oil / candle
  3.6 / 2.7 → 8.4 / 7.9; energy 0.10 → 0.36 a MWh; water 0.125 → 0.05 a m³. A citizen's monthly basket goes from 5.8 to about 5.3: the households can pay.
  Furniture and the goods lose most of their price, the staples, the light and the energy rise: a worker is paid the same in every sector, so a good
  that takes many workers per unit costs more.
- **Consequence for trade:** the world prices of the trade cities stay on the base values (`reference × the city's multiplier`), so the domestic prices
  now differ from them: furniture costs 9.9 here and a city pays 20 × 1.6: exporting it is very profitable, importing coal is dearer than burning
  domestic labour. The comparative advantage is real now and may need a tuning of the cities' multipliers.

**Calibration, still to do with a play-through.** The 5 % step, the starting wages and the minimum wage are first values on the corrected scale.

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

**Status (2026-10-12): all the steps below are built and covered by tests; none is played yet.** What differs from the text:
- **Step 2:** the social security has no cash account of its own. Contributions (employer 25 %, employee 10 %, levers of the "Salaires" section) are
  city lines (`social_contribution`, PCG 431) and the unemployment benefit stays a city expense: the "Sécurité sociale" card of the section and the new
  "Cotisations sociales" row of the city ledger show contributions against benefits; a deficit is the treasury's, shown as such. The employer's share
  is a charge of the company (645, deductible, in its price); the employee's is withheld from the household's personal account and the income tax is on the wage after it.
- **Step 5:** a house's cooperative has **no payroll**: its residents are also the labour pool of every other workplace, so paying them a wage for the
  same work would double count them (or leave no unemployed to draw a benefit). They are paid out of the surplus instead, as the SCOP rules say
  (section 4): the participation (40 %, charge 691), the tax on what is left (25 %), the interest on the parts (15 %, after the tax, 457) and the rest in
  reserves; only the cash the business holds can leave it. A house's personal account shows the participation and the dividends apart from its wages.
- **Step 4:** the ratios gained "Coût du personnel" and "Part des salaires dans la valeur ajoutée"; the company statement lists the wages and the
  contributions under their lines (small grey rows).
- **Step 6 (minimum wage):** built early, it is the floor of the labour market (see the status above).
- Open for a later play-through: the shares and the rates (first values), and whether the cooperative should staff its own work (see above).

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
