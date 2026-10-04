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

## No saved games to migrate

There are no saved games to keep. Never write a migration, a compatibility path, or a fallback for data written by an
earlier version of the code (an old stored balance, an old row shape, an old year label). If the data is wrong, fail
loudly; do not patch it at load time.

## Money: one flow, the journal

The journal is the only record of money. Every money movement (cash, income, expense, loan, tax, construction,
maintenance, salary) is a journal line, written to IndexedDB when it is recorded (write-through). The treasury
(balance, income, expenses, totals, daily flows, loans, last tax year) is derived from the journal lines
(`GetTreasurySnapshot` → `TreasuryFromJournalPolicy`). Never store a derived money figure, never write a balance
into a row, never update a second store alongside the journal. Monthly charges are idempotent per hamlet and per month
(business key `type:hamletId:year:month`): a second charge for the same key is refused, not silently recomputed.

## One clock: the turn

The turn is the game clock (`game.time`), saved once per turn in `gameSettings`/`clock`. Nothing stores a copy of it:
the accounting reads it live (`getSessionGameTime`, which throws when no game runs), and the treasury snapshot takes
its turn from that clock.

## Purge closes a year, it never changes the treasury

A purge (keeping the last N full years) never moves the balance. Each full year is closed per hamlet into one
`year_closing` line: its net flow (the balance effect) and its totals per journal type (the sub-totals the yearly
summary shows). Loan lines are kept whole, since a loan's schedule runs past the purge. The yearly summary reads a
closed year from its closing; nothing else keeps a year's result (no localStorage copy). Regression test:
`tests/contexts/accounting/yearClosing.regression.test.js`.

## The journal holds movements only

The journal stores money movements and loan contracts, nothing else. Totals are never written as lines: no `cumul_*`,
no `carry_forward`, no `balance`. A year's totals are read from its lines, or from its `year_closing` line once purged;
the carried result is the previous year's net flow; the balance is derived.

## One balance: the treasury derivation, for every scope

Every balance (the city's, a hamlet's, a year's flows) is read from one derivation of the journal lines:
`GetTreasurySnapshot` with `{ hamletId }` (null = the whole city). Nothing computes a second balance from the journal,
and no view compares two balances. The city balance equals the sum of the hamlets' balances by construction.
A view that waits for the journal shows "…", never a stale or a zero figure.

## Two notions in the city ledger, two rows

"Trésorerie" is the cash in the till: at 31 December for a past year, now for the current one (the snapshot with
`untilYear`). "Résultat de l'année" is the year's net flow, the figure the net columns carry forward. Never show one
under the other's name, and never use the cash as a result.
