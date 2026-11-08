# Instructions for Claude Code — Anoria

## No silent fallbacks

Never add a fallback that shows or returns a stand-in value when the real input is missing or wrong: a default
texture, an alias id, a guessed type, an implicit footprint, a `?? 'something'`, a default argument that
"keeps things working". Throw an explicit error (naming what is missing) so the real cause is visible right away.
A substitute value misleads: it hides the defect and sends the investigation in the wrong direction.

When you meet an existing silent fallback while working on something, say so and propose making it strict.

## Player wording comes from the catalog

Any word the player reads that the catalog decides must be read from the catalog, never written by hand in UI
code: a building's name (`displayName`), a good's name and unit (`ResourceCategoryCatalog`), a social category's
name (the name of its house), a month or season a schedule names, a capacity or range declared on a role. Use
`src/presentation/dom/shell/CatalogVocabulary.js` (`buildingName`, `goodLabel`, `goodAmount`, `namesOfBuildings`,
`scheduleLabel`, ...) so that changing the catalog changes the wording everywhere.

A term the catalog does not give is shown as "…" with a one-time `console.warn('[vocabulary] …')`, on purpose, so
what is still hardcoded or undeclared stands out (`pnpm console:tag vocabulary --follow` while `pnpm dev` runs). This
is the one exception to "no silent fallbacks": it is visible and warned about, never a made-up word.

Still hand-written on purpose: the tutorial and news narrative, generic role nouns ("Fermes"), the placeholder
report, accounting labels.

## Calendar: days per month has one source and is frozen in a game

A turn is a day. A year lasts `daysPerMonth × MONTHS_PER_YEAR` turns (12 months, fixed), and `daysPerMonth`
is a setting (default `VITE_DAYS_PER_MONTH` in `.env`). Its single source is `src/config/events.js`:
`.env` default → the player's pre-game choice on the settings page → **frozen in IndexedDB when the game is
created** (`initGameCalendar`). It cannot change during a game (the in-game panel only shows it), because a
different value would re-interpret every past turn. Never write a month/year length in code (no `5`, `30`,
`12 *`): use `getDaysPerMonth()` / `TimeManager.DAYS_PER_MONTH`, `turnsPerYear()`, `MONTHS_PER_YEAR`. When
you store a date, keep the year/month stamped at write time rather than recomputing it from the turn.

## Never commit automatically

Never run `git commit`. Never mention committing or suggest the user commit.
Just make the changes and stop.

## Tests: essential and non-regression only

Write few tests, and only for what must not break: the core rules (calendar, journal and treasury agreement,
year and rate labels) and a bug that was just fixed (a regression test). Never write a test that checks a
feature was removed, nor one per UI wording or per small change. A test is not a rule: the rule lives here.

## A catalog or default change that moves a building's stored fields updates the prefab too

`src/shared/prefabs/anoria-tour-107/` is a real city exported at a turn, bundled as the game's starter prefab.
When a change to the catalog or to a building's default fields (`employment.workerNeed`, a default `employees`
shape, a stat derived from the catalog, ...) means an existing building's *stored* data no longer matches what
the game would now compute for it, check whether the prefab's `city-*.json` holds that building type and fix its
JSON directly (not a runtime migration — see "No saved games to migrate" below): otherwise the starter city keeps
shipping the old, wrong values forever, exactly like a bug that was fixed in code but not in the save that
exposed it.

## A building wears when its upkeep is not paid, and may collapse

Every building but a road or the nature has a `solidity` bar (`src/shared/solidity/`, row field, strict: a missing bar throws). Each month `WearBuildings` wears the buildings whose
upkeep was not paid (`neglected`, told by the settlement: the State's refused upkeep, a company in difficulty), and a worn-out one may collapse: it is demolished as the player would,
and part of the people inside die under the cause `accident`. Plan and figures: `docs/gameplay/PLAN_COLLAPSE.md`.

## Who owns what is derived, and a loan names its lender

No row says who owns it: ownership is read (`OwnershipRegisterPolicy`, `getOwnershipRegister`, the admin "Patrimoine" section) from the journal and the buildings, never stored. A city loan
names its lender: a bank of the game (`lenderBuildingId`) or a partner city (`lenderCityId`, `ExternalLenderCatalog`); one that names neither throws. The city may sell the shares it holds to the property company (`SellCityStake`: `stake_sold`/`stake_bought`, at their cost); every holder is paid its dividend in January
(`SettleCompanyAid`), and the city has a balance sheet read from its account (`StateBalanceSheetPolicy`, never plugged). Plan: `docs/gameplay/PLAN_OWNERSHIP.md`.

## Prices follow the climate, supply and demand, and the world

A crop's yield is the catalog's times the year's climate (`src/shared/climate/`, drawn once and kept); the retail price of food is moved by how short or plentiful it is (`ScarcityPolicy`, applied by the `PriceBook` at the
shelf); every traded good has a world price index (`WorldMarket`) that multiplies what the cities pay and ask. All three are in the game's settings, read strictly. Figures are first values: `docs/gameplay/PLAN_CRISES.md`.

## No saved games to migrate

There are no saved games to keep. Never write a migration, a compatibility path, or a fallback for data written by an
earlier version of the code (an old stored balance, an old row shape, an old year label). If the data is wrong, fail
loudly; do not patch it at load time.

## Money: one flow, the journal

The journal is the only record of value. The accounting follows the French plan comptable (PCG) as a real double-entry
system. Every movement (cash, income, expense, loan, tax, construction, maintenance, salary, accrual, depreciation) is an
*écriture* in the journal, written to IndexedDB when it is recorded (write-through). An écriture is one record: a journal code
(`BQ` bank, `VT` sales, `AC` purchases, `PA` payroll, `OD` opérations diverses, `AN` à-nouveaux), a date (the turn, with the
year and month stamped at write time), an account (the entity it belongs to) and two or more legs, each
`{ compte, débit, crédit }` in centimes. The legs must balance; the write refuses an unbalanced écriture, naming it. A leg
never guesses its account: the writer names every compte (no implied bank leg, no counter-account looked up afterwards).
The treasury (balance, income, expenses, totals, daily flows, loans, last tax year) is derived from the legs, the cash being
the balance of the cash accounts (`CASH_ACCOUNTS` in `PcgJournalCatalog`: 512 a bank account, 515 a State's account at its central bank, 53 banknotes; never a
copy of the list, never a prefix match): there is no "money direction". The city is a State: its M57 lines book its money on 515. Never store a derived money figure, never write a
balance into a row, never update a second store alongside the journal. Monthly charges are idempotent per hamlet and per month
(business key `type:hamletId:year:month`): a second charge for the same key is refused, not silently recomputed.

## One clock: the turn

The turn is the game clock (`game.time`), saved once per turn in `gameSettings`/`clock`. Nothing stores a copy of it:
the accounting reads it live (`getSessionGameTime`, which throws when no game runs), and the treasury snapshot takes
its turn from that clock.

## Purge closes a year, it never changes the treasury

A purge (keeping the last N full years) never moves the balance. The purge is a performance device, not an accounting
act: it replaces the écritures of the years it drops with the year-end entry of the plan comptable, and nothing else.
For each full year and each account, the year closes into one *à-nouveaux* écriture (journal `AN`, the `year_closing` line): the
balance-sheet accounts' balances (capital, fixed assets, depreciation, stock, debts, receivables, loans, cash) against the carried
result (12), balanced, which the fold, the grand livre and the balance sheet read like any other écriture. A year's per-type totals
(the sub-totals the yearly summary shows), what moved its cash by account (what the city's ledger reads) and what each building
cost are kept in the line's `closing`, a read-only digest of the year dropped, never a leg. (The allocation of the result,
110/119 and dividends, is not written: the dividends are already écritures of the year closed.) Loan écritures are kept whole, since a loan's schedule runs past the purge; deposit écritures too, since a house's savings at a bank
are read from them pair by pair (house, bank) and the à-nouveaux has no counterparty. A purge changes neither
the treasury nor the balance sheet. Regression tests: `tests/contexts/accounting/yearClosing.regression.test.js` and
`tests/contexts/accounting/balanceSheet.test.js`.

## The journal holds écritures only

The journal stores écritures (movements of value) and loan contracts, nothing else but the informative lines (`info_*`): they move
nothing, carry no legs and are no écriture (`isEcriture` is false for them), but the loan schedule and the player's warnings read them. A *total* is never written as a line:
no `cumul_*`, no `carry_forward`, no `balance`. A closing entry or an à-nouveau is not a total: it is an écriture with its
legs, as the plan comptable has it. A year's totals are read from its écritures, or from the à-nouveaux and the `summary` of its
closing once purged; the balance is derived.

The journal code says what kind of écriture it is, not whether money moves: `BQ`/`VT`/`AC`/`PA` are the daily ones, `OD` is
what the closing of a month writes once per account and month (business key), never a turn's code (the variation of stock, the
depreciation, the accruals, the disposals of assets). An écriture moves the treasury only through a leg on a cash account.
Every view reads the same legs: the grand livre, the balance, the compte de résultat, the balance sheet and the city's
ledger are sums of legs by compte. A type of écriture (what a sale, a wage, a depreciation posts, and to which comptes) is one
entry in `PcgJournalCatalog`, not a new rule.

A company that cannot pay a charge that is due to a creditor (wages, social contributions, tax, the rent of its premises) books it all
the same as an écriture against the debt it owes (the charge debited, the debt credited: 421, 431, 444, 401), and pays the debt,
oldest first, when it has the money (`PayableCatalog`, `DebtPolicy`). The debt is derived from those lines, never stored. A company starts with a founding capital the city pays it
once (`FOUNDING_CAPITAL_MONTHS` months of its charges at full staffing, `FundNewCompanies`): the company's equity (101) against the
city's holding in it (261), never repaid, an investment of the city rather than a running expense. A company that carries a stock also
gets a working capital, the share of its full stock the player's aid policy sets (`CompanyAidCatalog`, the admin panel's "Aide aux entreprises"), in three
forms the player splits: **participation** (capital with no return, as the founding capital), **loan** (274 for the city, 164 for the company; interest from a
date the player sets, repaid out of the month's profit by `SettleCompanyAid`; its terms stamped on the line when granted), **State shareholder** (capital that
gives a stake, so a January dividend: stake × payout rate × distributable result). The policy binds the player for 2 to 8 years he chooses; the stake is
computed (the shares it holds over all the shares), never set: capital put in later as a shareholder buys shares at the price of a share then (the company's book equity over its shares, `CompanyAidCatalog`), so a company that has grown costs more to enter, and a participation buys none. A liquidated company repays its loan from its cash before the capital goes back; the rest is abandoned
and lost by the city. The policy is global to the hamlet (one for all the companies); an aid to one company is a one-off contribution (`InjectCompanyAid`), made from the company's own sheet (Finances tab, "Aide de la ville") or from the admin panel's list. A policy per company or per sector is a limit still to lift. Whether a company is funded is read from the journal. A company already in a starter prefab carries its capital lines in the prefab's journal. An account below
nothing shows on the balance sheet as an overdraft (519), a debt.

Each hamlet is a State of one federation with one currency (`docs/gameplay/PLAN_BANK_MONEY.md`): the policy rate and the reserve ratio are the federation's, one
setting for all (`FederalMonetaryPolicyRepository`, never on a hamlet), moved while the central bank of some State works; each State's central bank refinances its
own State's bank only. A State's central bank is an institution, its books under the State (`centralBankAccountOf`), never a building's; it holds no money of its
own (what it is paid comes back to it, 1678; what it pays credits the Treasury's account, 1674), and once a month its Treasury's account is centralised to the
State's money (`BankRefinancing.centraliseTreasury`, from balances). A bank's customers' money (their 512) is its sight deposits (1651), its own money its reserves at
the central bank (5151); its reserves are its own cash plus its customers' money (a payment between customers moves no reserves, a credit to a customer creates the
deposit), read live from the fold, and centralised once a month (`BankRefinancing.centraliseBank`). The bank's constraint is its reserves against the reserve due on
its deposits, never its cash. What the central bank issued and the public holds is banknotes (all its customers' money when the State has no bank, none when it has
one); the difference is money that came from or went abroad, converted against its foreign reserves (2761), once a month (`BankRefinancing.centraliseExternal`). The
starter prefab's city lines are on 515 in its JSON, its private flows (customers' money) on 512. The State may not spend more than its account at its central bank holds: `RecordLedgerEntry` refuses a payment of the State (an écriture with no account) that would take
the Treasury below nothing, with the reason `treasury_insufficient`, after the idempotence check (`stateCanAfford`). A refusal is no defect, and whoever pays decides
what it means: the player is told (`insufficient_funds` on screen), a company waits for its whole founding capital (`FundNewCompanies`, all or nothing), and in the month's
settlement the State leaves the payment unpaid and its other side unwritten (`SettleProducerCharges` writes the State's line of a flow first, `stateFirst`), which is
announced once a month (`state-unpaid`). A payment that must be made (a liquidation's guarantees) stops with a sentence the player reads. The starter city's opening
capital is the founder's treasure (the State's dotation, 1021, money its own central bank created). A later gift is a partner city's: once per game and only in the game's first `firstYears` years, when the city has no
money left and a benefactor of `BenefactorGiftCatalog` (in order of priority) is a commercial partner, that city offers `amount` € and the player accepts or refuses
(`BenefactorGift`, a dépêche) — a last resort: only when the city can no longer borrow (`cityBorrowing`: no bank, lending frozen, no reserves or collateral, or its gross public debt at the ceiling `DEBT_CEILING_SHARE_OF_GDP` of its domestic product, never under `MINIMUM_DEBT_CEILING`; a loan past the ceiling is refused); accepted, it is a `benefactor_gift` écriture (M57 1025), foreign money that the central bank converts against its foreign reserves
(`centraliseExternal`), never a founding endowment. The central bank is the one place money is created: when the bank lacks cash for a withdrawal, or for a loan that leaves it the reserve the
ratio in force asks (`reserveRatio` of its deposits), its State's working central bank lends it the shortfall, only against collateral (its loans, 274, less `COLLATERAL_HAIRCUT`; refused with the reason `collateral` beyond), in a corridor of rates around the policy rate: the **marginal lending** (urgent, to lend; 1648; policy rate + `MARGINAL_LENDING_SPREAD`), the **main refinancing** (the reserve upkeep at the month's close; 1649; the policy rate), and the **deposit facility** (reserves above the reserve due earn the policy rate − `DEPOSIT_FACILITY_SPREAD`, paid by the central bank; `corridorOf`) (bank: 512 against 1648/1649; central bank: 274 against the money
issued, 1678, no cash), and the bank's repayment destroys it again (`BankRefinancing`). What the bank owes is the balance of its 1649, read from the fold. Every
January the central bank pays the city what it earned and holds in cash (457 on its side, 758 for the city: the ledger's own line). What the State cannot pay when its Treasury is empty and owes to a named creditor (a household's pay and benefits, a service's subsidy: `StateArrearsCatalog`) is booked all the same against what it owes
(401, the `od_state_arrears_*` lines) and paid later, the households first (`SettleStateArrears`, before the month's own payments); owed to a building that is gone, it is
abandoned. It counts in the gross public debt, so in the debt ceiling. The upkeep and the subsidies that name no creditor are still dropped, and the arrears are paid without the
withholding of the original payslip: limits to lift. A company short of cash for its
month borrows the shortfall from the bank (its 1643, the bank's 274) up to `COMPANY_CREDIT_CEILING_MONTHS` of its charges, the less of it the dearer the credit,
before any charge becomes a debt (`BankCompanyCredit`). Each month a household keeps a cash buffer (a month of the larger of its income and its spending), saves at
the bank a share of the rest that rises with the savings rate, and draws on its savings when short; one in debt pays before it saves (`SettleHouseholdSavings`).
This is how the policy rate reaches the city: never a hand-written reaction to a rate, always these catalog figures (`BankCatalog`). The supervisor reads the bank's equity against its loans (`capitalStatusOf`): warned under `CAPITAL_WARNING_RATIO` (a monthly dépêche), its lending frozen under
`MIN_CAPITAL_RATIO` (no loan to the State, no credit to a company: the reason `capital`), insolvent below nothing. The player recapitalises it (city capital, as a
founding capital, up to the warning ratio) in any of the three, or liquidates it once insolvent; a liquidated bank collects its loans back, repays its depositors as far
as its cash goes and the city guarantees each saver only up to `DEPOSIT_GUARANTEE_CAP` (`deposit_guarantee`; beyond it the saver loses, `od_deposit_lost`), a guarantee the banks
fund by a monthly premium on their savings (`DEPOSIT_GUARANTEE_PREMIUM_RATE`, `deposit_guarantee_premium`), and the central bank loses the refinancing it cannot repay. Every rate of money is per year (`LoanRatePolicy`, `BankCatalog`).

## The balance sheet is derived, never written

A company's balance sheet (`BalanceSheetPolicy`) is read at display time from the legs of its écritures (the opérations
diverses included), the cash being the balance of its cash accounts, and its stock valued at cost (the supply's `PriceBook`).
No écriture is added for a result or a total. The two sides must balance; a gap throws, it is never plugged. A
household has no balance sheet (it is not an entity of the plan comptable). Regression test:
`tests/contexts/accounting/balanceSheet.test.js`.

## One balance: the treasury derivation, for every scope

Every balance (the city's, a hamlet's, a year's flows) is read from one derivation of the journal's legs, in memory,
never stored: a single fold of the journal into the totals of each compte per account, per year and per month, kept up to date
by folding only the new écritures (the journal is append-only) and rebuilt on load and after a purge. `GetTreasurySnapshot`
with `{ hamletId }` (null = the whole city) reads it. Nothing computes a second balance from the journal, and no view
compares two balances. The city balance equals the sum of the hamlets' balances by construction. The fold never runs
inside a turn's hot path. A view that waits for the journal shows "…", never a stale or a zero figure.

## Two notions in the city ledger, two rows

The ledger's lines are read from the fold of the journal's legs (what moved the city's cash in the year, by M57 account, see
`CityLedgerLineMappingPolicy`): money that moved against an account no line takes throws. A new account the city books against
needs its line there.

"Trésorerie" is the cash in the till: at 31 December for a past year, now for the current one (the snapshot with
`untilYear`). "Résultat de l'année" is the year's net flow, the figure the net columns carry forward. Never show one
under the other's name, and never use the cash as a result.

## A skill belongs to one social category: avoid shared posts

A workplace's required skill is granted by exactly one social category (`groupsForSkill(skill)` has one entry). Do not add a skill that two
categories grant, and do not propose it as a design shortcut. Why, if the user asks (explain it, do not just refuse):

- The player reads who is out of work and which posts stay empty *per category* (the grid under each unemployment rate in the Emploi tab). A vacant
  post is attributed to a category by the skill it asks. With one provider that is exact; with several, nobody can say whose post it is.
- The only way left is a convention: `vacanciesShareOf` splits such a skill's vacant posts equally. The sum over the categories stays exact, but each
  category's figure is not: one shows fewer posts than it could take, so its unemployed look "without a post" when they are in fact one hire away;
  another shows more. The player is misled exactly where the screen is meant to explain.
- The honest fix (share the vacant posts in proportion to who already holds the posts of that skill, from `workerSources`) needs data that does not
  exist before the first hire, so it would need a "no one yet" rule: a fallback or a "…". It is more machinery, to repair something avoidable.
- A shared skill also blurs the staffing reasons ("who holds the skill it asks for") and the priority tabs (`shared`).

If a design truly needs a skill common to several categories, say so first and settle how its posts are attributed before touching the catalog.
Details: `src/contexts/employment/docs/rules.md` §5.6.

## A skill has one level: an advanced trade is a skill of its own

Every skill is granted by the houses and asked by the workplaces at level 1, never higher. A more advanced trade is another skill with its own name (local medicine
`medecine-proximite` for the dispensary, hospital medicine `medecine-hospitaliere` for the hospital; thermal energy `energie`, nuclear energy `energie-nucleaire`; crafts `artisanat`,
specialised crafts `artisanat-specialise`), granted by the house tier that opens it. Why: the "level" the player reads is the house level a skill comes with, the same number a workplace
shows on its card (`houseSkillTier`, `lowestHouseTierForWorkers`); a second scale (the skill's own level 1, 2...) said "niv. 1" on the house for a fire-fighting that the fire station
shows "niv. 2". A more advanced trade that pays more says so in `START_WAGE_BY_SKILL` (LabourMarketCatalog.js). Guarded by `tests/shared/population/socialCategoryCatalog.test.js`.

## UI: think mobile every time

Any screen, panel, table or card you add or change must work on a phone as well as on a desktop, and the change is not done until it does: design for the narrow
width first, then widen. No horizontal page scroll; touch targets of at least 40 px; text that wraps instead of overflowing; a table that cannot fit drops its secondary
columns (keep the essential ones) rather than shrinking everything. Add the `@media` rule in the same change as the markup, never "later". Style in the Material spirit,
"less is more": one level of frame, space and a thin divider to tell sections apart, labels and figures aligned on one grid.

## Texts in modals (dépêches, help, questions): structured, short, left-aligned

A text the player reads in a modal is written to be scanned, not read like a novel: short paragraphs that say one thing, **bold** on the words to catch first, a heading
only when a part needs one, and lists for anything that enumerates. One convention for all of them, laid out by `src/presentation/dom/shell/richText.js`: a blank line
starts a block, `## ` is a heading (h3 — the modal's own title is the h2, so the hierarchy is h2 then h3, never skipped), `- ` lines are a list (a quiet card per line,
no visible bullet), `**…**` is bold. It is built with the DOM (`renderRichText`, text nodes only), never with `innerHTML`: a text that holds markup (a name the player typed)
stays text, so there is no escaping to forget. Do not put a text a player or a catalog wrote into `innerHTML`. Everything reads from the left edge (title, paragraphs, lists), never centred. A new modal reuses `ConfirmModal.js`
(`confirmModal`, `noticeModal`) or the news modal and its classes; it does not write its own text styles. The explanations behind a "?" live in
`src/shared/help-catalog/HelpCatalog.js` (figures are put in bold automatically; shared sentences are `FRAGMENTS`), a dépêche's text in `NewsDraftCatalog.js`.

## What a player types, or another player sends, is text and never markup (XSS)

A profile name, a pseudo, a room or map name, a value read back from storage or the network: it reaches the page with `textContent`, `createElement`, `dataset`,
`replaceChildren`, or the `html` tagged template of `src/presentation/dom/shell/safeHtml.js` (values escaped by default, markup asked for with `raw()`), never concatenated
into `innerHTML`. Toasts go through `ToastNotifier.js`, which escapes (the library puts the message in innerHTML). A name follows `PlayerNamePolicy.js` on the form, on what
is read back, and on the multiplayer server (`isValidName`, which never trusts the client). The native platform is enough: no sanitizing library, because we never need
to render markup a player wrote. The barrier is `pnpm lint:security` (ESLint with `eslint-plugin-no-unsanitized`, `eslint.config.js`): it refuses an `innerHTML` given a value that
did not go through `html` / `escapeHtml`, and `deploy/deploy.sh` runs it before it builds and publishes. Regression tests: `tests/presentation/dom/shell/xssGuards.test.js`, `richText.test.js`.

## Keep the flow: no commands that make the user wait

The user is often away while a task runs; a command that stops for approval freezes the work. Change files with the Edit
and Write tools, never with `python3 - <<EOF`, `sed -i` or `cat >> file <<EOF`. Read files with Read, not `cat`/`sed`.
Run one simple command at a time (no `;`, `&&` or pipe chains that mix actions). Run the tests once the change is whole,
not after each small step. Never create a placeholder or empty file.
