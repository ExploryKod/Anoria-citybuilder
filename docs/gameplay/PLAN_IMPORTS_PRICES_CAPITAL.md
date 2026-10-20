# Plan — imports, price chain, company funds

Status: reflection done, nothing built. This plan is built step by step; each phase is shippable on its own.
Goal: decisions (customs duty, VAT, taxes, later diplomacy) have a real economic impact, and every actor answers for its own money.

## 1. Rules of the model

### 1.1 One price rule for every actor
`sale price HT = unit cost × (1 + margin)`

- The margin covers the actor's own charges (wages, upkeep share, corporate tax) and its profit.
- The market price (reference) is the catalog base value (`getResourceBaseValue`). It is the first cursor of the chain.
- VAT is added only by the last seller (the houses are the last buyers). Between companies, prices are HT.
- "Margin" means a markup on cost (×1.20), one definition everywhere.

### 1.2 The import chain
1. A foreign city's merchants sell at `reference × the city's multiplier` (catalog `offers`, `baseMultiplier`), with a random spread like exports (`sale.spread`, `saleBias` is the diplomacy hook).
2. Our merchants are the importers of record: they buy, pay the customs duty (city income), and sell to the trade warehouse.
3. The merchants' price to the warehouse = (foreign price + transport + duty) × (1 + merchant margin). The transport and the duty are in the cost before the margin.
   - **Transport** has two parts in the catalog: a base price per unit for each mode (sea, land), and for each city its mode and a distance multiplier. Transport per unit = `base price of the mode × the city's multiplier × the good's weight/volume factor × the volume discount of the delivery`. The factor is one value per good in the resource catalog. The discount lowers the per-unit transport when a delivery is larger (economy of scale), declared as tiers in the catalog. It is a real charge of the merchants: a line in the merchant house's own business accounting, paid outside the city's economy.
   - **Customs base** = foreign price + every charge generated outside the city (today only transport). The merchants' commission is not in it: it is earned inside the city, for the city's economy.
   - Each of these amounts (foreign price, transport, duty, commission) is rendered in the accounting of whoever pays or earns it, so the player can follow every step.
   - So the merchant's margin differs by city through its charges, not through a separate rate: a city with a heavy transport cost gives dearer imports.
4. The warehouse sells to producers or markets with its margin. Producers add theirs, and so on to the houses, which pay VAT.
5. The deal's price is fixed when the deal is made. The duty applies on delivery (the border), so a change of duty between the deal and the delivery hits the merchants.

Worked example (duty 10%, every margin 20%, VAT 20%): foreign 1.00 → cost 1.10 → warehouse price 1.32 → producer price 1.584 → houses 1.901.

### 1.3 The warehouse's stock price (decision)
Options considered:
- **A. Weighted average cost** (chosen). Each delivery blends into the stock's unit cost. The selling price is `average cost × (1 + margin)`. It is the simplest in code, the most readable for the player, and close to real accounting. A duty change reaches the price progressively as new lots arrive, which gives the timing effect.
- B. FIFO lots: more faithful to timing, but a lot per delivery to store and trace.
- C. Replacement cost (sell at today's market): loses the timing effect.

No price depreciation over time. What a real warehouse does about slow stock is lower its margin to sell. So the one cursor is the warehouse's margin, driven by how full the stock is against its target (bounded by a floor at cost and a ceiling). Storage costs are already part of the warehouse's charges (wages and upkeep) and are covered by its margin. Spoilage of perishable goods is a separate feature, not part of this plan.

### 1.4 Limits and demand
- A buyer cannot buy beyond its cash (warehouse, producer, house).
- Quantities are bounded by need. The unit price is the same for everyone; the quantity is what is shared out.
- Margins move within a floor and a ceiling, and at a limited speed, so prices cannot oscillate wildly.
- Stocks sit in warehouses only (merchants anticipate the warehouse's room).

### 1.5 Cycles are separate
| Cycle | Rhythm |
|---|---|
| Imports | each city's ct (`trade.frequencyMonths`), quantity cq |
| Transformation | per day (tick) |
| Distribution | per delivery |
| Price revision (margins) | per month |
| Accounting settlement | per month, idempotent (`type:hamletId:year:month`) |

### 1.6 Company founding funds
Not `capital_funds`: that line is the city's free starting money, never repaid, folded into `initialFunds`, one per game.

- The city advances a company's first funds when it is built. The amount comes from the catalog and is derived: `(monthly input cost + wages + upkeep) × N months of buffer`, so a price change changes the need.
- It is a gift in spirit but the city is repaid, without interest, from a share of the company's monthly profit until the advance is cleared. No schedule, no default.
- New journal line types (an advance and a repayment). The outstanding amount is derived from the journal, never stored.
- The city's claim is not cash: "Trésorerie" ignores it, "Résultat de l'année" does not count the advance as an expense.
- The city pays the buildings (its asset). Open question: does a company pay the city rent for using one?
- A bank (later) will grant loans to companies. Out of scope.

### 1.7 Who ceases to deal, and why (decided)
Today a relation has a `status` (`active | suspended | expired`) and a satisfaction score built from a registry of factors (`TradeSatisfactionPolicy`). The catalog declares a `breakThreshold` per city, but I found no code that reads it, and nothing records why a relation stops.

- A merchant's "decision" is a rule, not a choice made by an AI: a registry of **cease reasons**, like `SATISFACTION_FACTORS`. Each reason is an id plus a pure test over the cycle's context. The first one that holds ends or suspends the deal.
- The deal (or relation) stores the **reason id and the turn** when it stopped. The commerce panel and the news show it, with wording from the catalog.
- Reasons to start with:
  - `satisfaction_too_low`: the city's satisfaction fell to its declared threshold (set per city in the catalog, for example −80).
  - `unprofitable`: the landed cost (foreign price + transport + duty) plus the merchants' minimum margin is above what the warehouse can sell at (reference price with a tolerance). This is where a higher duty can end an import, and the player sees why.
  - `warehouse_cannot_pay` or `warehouse_full`: repeated failures to deliver or pay (a count declared in the catalog).
  - `no_merchants`: the merchant house has no staff for the activity.
  - `contract_ended`: the relation's duration ran out without reaching the renewal threshold.
- A suspended deal is re-tested each cycle and resumes when its reason is gone, with a margin so it does not flip every month.
- Each reason also names **who ceases**: the city (`satisfaction_too_low`, `contract_ended`) or our merchants (`unprofitable`, `warehouse_cannot_pay`, `warehouse_full`, `no_merchants`). The deal stores `ceasedBy`, the reason id and the turn, and the player sees all three.
- Reasons are data, so a new one is one registry entry. A reason the registry does not know throws.
- Later feature (not now): a city that wants to sell can absorb part of the cost (accept a lower price) when the duty or the merchants' margin is high, so it keeps dealing. For now either side ceases and the player is told who and why.

## 2. Phases

### Phase 1 status (built, not yet played in the app)
Done: import deal goods (`dealCoal`, `dealPetrol`, `dealExoticWood`, `kind: 'importDeal'`, baseValue 0) made by the merchant houses with `requiresOpenDeal` (gate registered by the trade context, capped by one order's quantity); `TRADE_IMPORT` (merchant margin 10%, market ceiling ×2.2, transport modes, volume tiers, failures before ceasing), per-city `transport`, per-good `transportWeight`; `ImportPricePolicy` and `TradeCeasePolicy`; the cycle consumes deals and books, on each merchant house's business account, `import_<good>`, `freight_<good>`, `duty_paid_import_<good>`, and for the city `customs_import_<good>` (new ledger row "Douanes à l'importation"); the sale to the warehouse is a `source_to_hub` traceability row at the merchants' price, settled monthly like any goods flow; the commerce panel shows who ceased and why.
Known limits and leftovers:
- `warehouse_cannot_pay` is not in the registry: a warehouse has no working capital before phase 5, so a cash check would block every import. The sale is settled monthly, and the account may go negative until then.
- Deal goods sit in the warehouse and turn into the real good there, so they take the room the good will take; `warehouse_full` therefore only fires when no deal can even be filed.
- The old city-pays path (`RecordCommerceImportExpense` as the city's expense, the "Importations" ledger row) is no longer produced by the game: dead leftover to remove.
- Downstream prices still follow `MARGIN_BY_STAGE` from the catalog base value (`ValueChainCatalog.js`), not the real landed cost: that is phases 2 and 3.
- The gate reads the relations and the hubs on each producer tick; cache it if merchant houses become numerous.
- All numbers in `TRADE_IMPORT`, the transport weights and the per-city break thresholds are first guesses to tune.

Each phase ends with the app working and the ledgers consistent.

### Phase 0 — Catalog of margins and rates (declarative)
- Per building type (or role): target margin, its bounds, speed limit. Merchant margin per city or per merchant activity (decision below).
- Guard test for the catalog's integrity, as for the economy catalog.

### Phase 1 — Merchants as importers, duty on delivery
- Replace the unconditional `#buyOffer` in `RunMonthlyCityTradeCycle` by deal-driven deliveries.
- The transport charge (mode base price × the city's multiplier) is declared in the catalog and booked as a charge of the merchants' house; the duty line shows its base (price + transport).
- Import deals generated by the merchant house activity, only for goods an active city offers (mirror of the export deal goods).
- The merchants pay the city and the duty; the duty is a city income line; the warehouse pays the merchants.
- A deal the warehouse cannot pay stays waiting and costs satisfaction. Waiting deals expire after a delay from the catalog.
- Tests: a duty change changes who pays what; the journal lines agree with the treasury.

### Phase 1b — exports on the same model as imports (built, not yet played in the app)
Exports and imports are parallel but never mixed: their own line types, their own ledger rows, their own wording, their own rates.

Before phase 1b the export was the older design: the trade warehouse sells and keeps the price minus the duty, the merchant houses earn nothing on it, deals are made even when no city wants the good (each one consumes real goods), and nothing stops the trade when the duty makes it a loss. The new design:
1. **Merchant houses are the exporters of record.** They take the real goods from the warehouse at the chain's price (their cost), sell to the city at the drawn price, pay the export duty to the city, and keep the margin.
2. **Same gate as imports.** Export deals are made only while an active city wants the good, capped at one order's quantity, so no real goods are consumed for nothing.
3. **Same cease reasons, scope `export`.** `unprofitable` (cost + duty + transport above the price the city pays), no warehouse, no goods in stock, no merchants. The player sees who ceased and why, separately from the imports.
4. **Own money lines, never shared with imports.** The export duty paid by the merchants and received by the city has its own types (today the city's `export_<good>` line is the export duty and is labelled "Exportations" in the city ledger: relabel it "Douanes à l'exportation"); the merchants' sale has its own revenue line. The import types (`import_`, `freight_`, `duty_paid_import_`, `customs_import_`) are not reused.
5. **Hooks kept for the trade-policy phase (see "Phase 7"), cheap now and costly to add later:**
   - every duty is read through one function that names the **authority** (today only Anoria), the flow, the good and the **turn**: `getCustomsDuty(authority, flow, good, turn)`;
   - every customs line records the **rate that was applied** and what it was applied to (`dutyRate`, `customsBase`) at write time, never recomputed later;
   - a change of duty is a dated **policy event** (who, which good, from, to, turn), appended to a log, not an overwritten setting.
6. **Separate rates and effects.** Duties are already separate per flow (`CUSTOMS_FLOWS`). VAT differs by nature, as in reality: an export is zero-rated, an import carries VAT at the border on price + duty, which the importer recovers; the final VAT is paid by the last buyer (houses). Neither is the duty.
7. **Decided: the buying city pays the freight on our exports**, as our merchants pay it on the goods we import: the foreign city's own merchants bring their goods home. So an export carries no transport charge for us, and the model stays coherent if cities become other players (multiplayer).

Built: every recipe input drawn from a warehouse is now bought (a `hub_to_building` traceability row at the hub's price, settled monthly like any goods flow; `ProduceResource` throws when it has nothing to record it with); export deals are made only while an active city wants the good (same gate as imports); our merchant houses are the exporters (`abroad_sale_<good>` credit and `duty_paid_export_<good>` debit on their business account, the city's `export_<good>` duty line, no freight); the warehouse is no longer credited by the city (`merchant_sale` rows are statistics only); export reasons to cease (`export_unprofitable`, `export_no_merchants`, `export_no_warehouse`) kept apart from the imports' (`exportCeased`/`exportFailures` on the relation, shown as "Export <good> — …"); the city ledger row is "Douanes à l'exportation" and the journal names each trade line (`TRADE_LINE_WORDS`); the three phase 7 hooks: `getCustomsDuty(authority, flow, good, turn)` (only `anoria` exists, another authority throws), `dutyRate` and `customsBase` stamped on every customs line, and every duty change logged as an event in `tradePolicyEvents` (Dexie v20).
Known leftovers and consequences:
- Every recipe that draws inputs now pays for them (artisans, savants, workshops, merchants): their accounts and the warehouses' revenue change with it, and the economy needs a play-through to rebalance.
- Wood's export multiplier was raised from 1.65 to 1.9 so that exporting it is profitable at the default 15% duty; the other wants were already above their cost.
- `RecordCommerceExportIncome` and `RecordCommerceImportExpense` are no longer called by the game; the city ledger's "Importations" row never receives a line any more.
- The policy events are written but nothing reads them yet (phase 7).

### Phase 2 — Real unit prices and the warehouse's average cost (built, not yet played in the app)
- Transfers carry the real price (the `price` column of the traceability rows).
- **Changed from the first idea:** the unit cost is not stored with the stock. It is **derived from the deliveries logged**, so the log stays
  the single source (CLAUDE.md): a `PriceBook` (supply, `PriceBook.js`) reads, once a month, what each warehouse and market received over the last
  `COST_WINDOW_MONTHS` (3) months (`DexieSupplyTraceabilityRepository.sumInflowCosts`) and keeps the quantity-weighted average price per
  receiver and good. A warehouse and a market sell at `average cost × (1 + their margin)` (`priceFromCost`, margins in `ValueChainCatalog.js`); a
  producer still sells at the reference chain. So a customs duty or a longer freight (in the merchants' price to the warehouse) now reaches the
  shelf price a month after it starts, and fades as the old deliveries leave the window: the timing effect, without a lot per delivery.
- It is the average price of what came in, not of the exact units still on the shelf (a stock that stays long is priced on recent deliveries).
- **Opening cost:** a building with no delivery in the window values its stock at the reference chain's price of the stage before it
  (`openingUnitCost`): the starter city needs no stored cost, the prefab is unchanged.
- Wired at every seller's price: the traceability rows (`SupplyTraceability`), what the houses pay (`DistributeResourceToConsumers`, the
  consumers' purchases), the recipe inputs drawn from a warehouse, and the cost the merchants compare their export price with
  (`hubSellingPrice` in `RunMonthlyCityTradeCycle`).
- Still on the reference chain, for phase 3: the producers' price (no labour, no input cost), the margins as constants (not driven by the stock's
  fill), the import's `unprofitable` test against the reference price.

### Phase 3 — Margins along the chain, VAT at the last sale
Built (2026-10-12, not yet played in the app): a producer sells at its standard cost plus its 20 % margin, the warehouse and the market at the average cost of
their deliveries plus theirs (`PriceBook`, `StandardUnitCostPolicy`; see `PLAN_WAGES.md`, step 3). The VAT at the last sale was already in place
(`RecordConsumerPurchases`). Still on the reference chain: a house's own business (no workforce, no wage yet), a good with no reference value, the services no
producer makes; the margins are constants, not driven by the stock's fill (phase 6).
- Producers and markets price with the one rule; the houses pay VAT.
- Each actor's journal shows its purchase and sale HT; duty and VAT show in the city ledger.

### Phase 4 — Admin price panel
Built (first part, not yet played in the app): the **Prix** section of the administrator panel (`prices/`, nav button `admin-nav-prices`). One card per
good that reaches the shelves: a bar of what each step adds and a table, from the reference to what a house pays. An imported good (one card per
offering city) goes reference → the city's price → transport → customs duty → merchants' margin → warehouse → market → VAT; a good made here goes
reference → producer → warehouse → market → VAT; a good no market sells (the fuel of a plant) ends at the warehouse. The duty's share of the price
is shown. Built by `buildPriceWaterfall` (geography policy) from the catalogs, the duty and VAT in force and the prices of the warehouses and the
markets this month (`trade.getPriceWaterfalls`, `supply.listSellingPrices`); nothing is stored. The warehouse's step also carries a stock still held
at an older cost. Not built: the consumer price index, inflation/deflation/stagflation (stagflation still has to be defined), the levers on the
panel itself (duty and VAT are in their own sections).
- Price waterfall per good (reference, foreign margin, duty, merchant margin, warehouse margin, producer margin, VAT).
- Consumer price index over time; inflation, deflation and stagflation derived from it and from production and employment (never stored; define stagflation precisely first).
- Player levers: duty, VAT, corporate tax.

### Phase 5 — Company founding funds
- The advance and its repayment from profits (section 1.6).
- The catalog's derived funding need per building type.

### Phase 6 — Adaptive margins, foreign merchants' visits, diplomacy
- Margin driven by stock fill against target.
- Visits of foreign merchants as events; diplomacy moves `saleBias`.

### Phase 7 — world trade policy, retaliation and trade wars (later; hooks kept from phase 1b)
Goal: reproduce what happened between many countries and the USA from 2018 on, and still goes on: a country raises its duties (protectionism) or lowers them (liberal rules), the partners answer, tension escalates or negotiations calm it, and every step can be traced back.

- **Every authority has a tariff.** Anoria and each trade city (and, if cities become other players, each of them) holds a tariff table: duty per flow and per good, in force from a turn. The rate in force at a turn is read from the append-only log of policy events, never stored as a derived figure.
- **Foreign duties reach us.** A city's import duty on our goods lowers what its merchants can pay, so the price drawn for our exports moves (the `saleBias` hook of the trade cycle is where it plugs in) and so does the volume the city asks for. A city's export duty or ban raises the price it asks for its goods (the offer's multiplier). Neither is modelled today: only Anoria's own duties exist.
- **World events change tariffs.** A declarative catalog of events (tariff hike, tariff cut, embargo, sanction, trade truce) and of rules that produce them. Retaliation is a rule: when Anoria raises its duty on a city's goods beyond a threshold, that city answers after a delay, in proportion, on the goods it chooses (often those that hurt most); escalation follows when the answer is answered. Diplomacy (a mission for better deals) lowers or lifts a measure.
- **Everything is traced.** Each event stores its cause (the event that triggered it), so a trade war reads as a chain: who raised what, who answered, what each step cost. Each customs line in the journal carries the rate applied and the event in force; a history view lists the events, the rates over time and the duties collected.
- **Player decisions have a price.** Raising our import duties collects more at first, raises prices at home (the price chain of phases 2-3) and may bring retaliation on our exports. Lowering them does the opposite. The player sees which of these is happening and why (the same "who and why" as the cease reasons).
- **To decide then:** the shape of a scenario (a catalog entry per crisis, started by a date or by a player move), how fast retaliation answers, how a truce ends a war, and how much of it is visible to the player at once.

## 3. Decisions

### Decided
- The buying city pays the freight on exports (our merchants pay it on imports): no transport charge on our exports.
- Merchant cost differs per city through the transport charge declared in the city's catalog entry; the margin rate itself stays the merchants' (skill later).
- Customs base = foreign price + charges generated outside the city (transport today), never the merchants' commission (real customs valuation, CIF).
- Transport per unit = mode base price (sea, land) × the city's distance multiplier × the good's weight/volume factor × the delivery's volume discount. Paid outside the economy, booked in the merchant house's accounting.
- Volume discount: tiers declared in the catalog, applied per delivery.
- Company founding funds: a city advance repaid without interest from a share of profit (not `capital_funds`).
- Stock price: weighted average cost, no depreciation; the warehouse's margin falls as its stock fills.
- Cease reasons, who ceases, and the list in section 1.7. The deal's price is fixed at deal time.
- The merchant's margin goes to the merchant house's own business account. Whether its net result can reach the house's citizen accounting (dividend or other mechanism) is for later.

### Open
1. Wording of each cease reason (from the catalog), and the per-city satisfaction threshold values (rewrite `breakThreshold` as "break below this score", for example −80).
2. Rent for company use of a city-owned building: yes or no? (phase 5)
3. Repayment share of profit (for example 50%) and the buffer months (N) for the funding need. (phase 5)
4. Definition of stagflation for the panel. (phase 4)

## 4. Rules from CLAUDE.md that apply throughout
- The journal is the only record of money; the treasury and the outstanding advance are derived.
- No silent fallbacks: a missing price, rate or margin throws, naming what is missing.
- Player wording from the catalog (`CatalogVocabulary`), "…" and a warning when the catalog doesn't give a term.
- Few tests, only for core rules and fixed bugs.
- Never commit.
