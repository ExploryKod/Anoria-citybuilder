# Service coverage tier requirement (2026-09-07)

## What this is

A generic `serviceCoverage` requirement `kind` for `HouseTierRequirementPolicy.js`,
parameterized entirely by `requirement.category` — the counterpart, on the
Housing side, to Supply's `consumption: 'flag'` distribution mode (see
`contexts/supply/docs/period-lock-catalog-refactor.md`). A tier can now
require "this house is currently covered by service X" (a chapel's `faith`,
a school's `school`, ...) without any service name ever appearing
in `HouseTierRequirementPolicy.js`, `HouseLevelPolicy.js`,
`EvolveHouseBuilding.js`, or the ECS wiring — only `socialCategoryCatalog.js`
(via a tier's `requirements` list) and `buildingEconomy.js` (the service's
own `resourceRoles`) know any category names.

```js
serviceCoverage: (requirement, context) => {
  const servedAt = context.servedFlags?.[requirement.category];
  const met = context.periodKey - servedAt < requirement.coveragePeriods;
  return { current: met ? 1 : 0, target: 1, met };
}
```

`met` is true when Supply's `servedFlags[category]` (written by
`DistributeResourceToConsumers.js`'s flag-mode branch, same house row —
see `PeriodLockPolicy.js`) is no more than `requirement.coveragePeriods - 1`
periods behind the CURRENT one — not merely "ever served", and not
"served THIS EXACT period" either (see "Coverage window" below). Losing
coverage for good (a chapel destroyed, a house moved permanently out of
range) still demotes the requirement back to unmet, just after the window
runs out rather than the very next period — exactly like `roadAccess`
re-checks fresh every time rather than remembering a past state, only with
a tolerance built in.

## Coverage window: two independent catalog dials (2026-09-11)

A single distributor visit only ever proved coverage for the ONE period it
landed in — the walker/service-building equivalent of "the town crier read
the news once and everyone instantly forgets it the next morning." A house
one period out of luck (schedule miss, chapel briefly unstaffed, the
round-robin didn't reach it that pass) lost the requirement immediately,
which reads as flicker rather than a real service interruption. Fixed by
splitting "how often a service attempts to visit" from "how long a visit's
coverage lasts" into two independent catalog numbers:

- **Period of visit** — already existed: the distributor's own `schedule`
  fact (Supply side, `matchesSchedule` in `DistributeResourceToConsumers.js`).
  How often the service building *attempts* to reach its consumers.
- **Period of coverage** — new: `requirement.coveragePeriods` on the
  `serviceCoverage` requirement itself (Housing side,
  `socialCategoryCatalog.js`). How many periods a single successful visit's
  flag stays valid before the requirement goes back to unmet.

Since coverage is checked as `periodKey - servedFlags[category] <
coveragePeriods`, a visit doesn't need to land every single period to keep
a house covered — only within the window. Once the gap reaches
`coveragePeriods` with no fresh visit, that's a true interruption of
service, not flicker. Both numbers are independently tunable per service
per tier — a stricter/harder game lowers `coveragePeriods` (or widens the
distributor's visit interval), a more forgiving one raises it. Convention
adopted 2026-09-11: `coveragePeriods: 2` (coverage lasts twice as long as
the visit cadence) on every existing `serviceCoverage` requirement.

**`coveragePeriods` is REQUIRED, with no code-side default.** A tier that
declares `{ kind: 'serviceCoverage', category: ... }` without it is a
catalog authoring mistake — `HouseTierRequirementPolicy.js` fails loud
(`console.error` naming the category) as well as closed (`met: false`)
rather than silently substituting some code-chosen number. This matches
the file's existing "unrecognized kind fails closed" philosophy, extended
to "recognized kind, missing required param" — see the descriptor's own
comment.

## Threading `periodKey` (the only new plumbing)

`servedFlags` was already on the house row (Supply writes it) but two things
had to change for Housing to read it correctly:

1. **`HousingBuildingSnapshot.js` / `DexieHousingBuildingRepository#toSnapshot`
   had the exact same silently-drops-unnamed-fields bug already found and
   fixed in Supply's equivalents** — fixed the same way, with a generic
   `...rest` passthrough. Without this, `servedFlags` would never have
   reached `HouseTierRequirementPolicy` at all.
2. **`periodKey` (current month index) didn't exist anywhere in the
   evolution call chain** — `EvolveAllHouseBuildings`/`EvolveHouseBuilding`
   took no time param at all. Threaded it through, mirroring exactly how
   `housingPopulationGrowthSystem.js` already gets `monthIndex` from
   `getTimeInfo`:
   `createGameRuntime.js` (has `getTimeInfo`) → `housingEvolutionSystem.js`
   (now takes `getTimeInfo` too, computes `timeInfo.monthIndex`) →
   `housing.evolveAllHouseBuildings({ periodKey })` (composition wrapper) →
   `EvolveAllHouseBuildings.execute({ periodKey })` → per house
   `EvolveHouseBuilding.execute({ houseId, periodKey })` →
   `resolveHouseLevel({ ..., servedFlags: house.servedFlags, periodKey })`.

**Ordering matters and is already correct**: the ECS pipeline
(`createGameRuntime.js`) registers `supply.monthlyResourceCycle` (writes
`servedFlags` for the current month) BEFORE `housing.evolution` in the same
tick — see `contexts/supply/docs/refactor.md` / this file. No change needed
there, just confirmed before relying on it.

## Wired uniformly across all 3 categories (2026-09-08)

`socialCategoryCatalog.js` now declares `{ kind: 'serviceCoverage', category:
'faith' }` on tiers 2-4 of all 3 categories (artisans, merchants, scholars) —
simplified on purpose so every group currently evolves under the same rule.
Each category still owns its own `requirements` array independently (see
`tests/shared/population/socialCategoryCatalog.test.js`'s "owns its own
requirements list" case), so giving one group a different service, an extra
requirement, or none at all later is a one-category catalog edit — no policy
or architecture change needed:

```js
scholars: Object.freeze({
  tiers: Object.freeze({
    2: Object.freeze({
      requirements: Object.freeze([
        Object.freeze({ kind: 'roadAccess' }),
        Object.freeze({ kind: 'population', min: 1 }),
        Object.freeze({ kind: 'serviceCoverage', category: 'education' }), // diverge here only
      ]),
      ...
    }),
  }),
}),
```

Tests: `tests/contexts/housing/houseTierRequirementPolicy.test.js` (3 cases:
met/stale-or-missing/category-independence) +
`tests/shared/population/socialCategoryCatalog.test.js` (uniform-requirement
+ per-category-independence cases). Full suite: 1026/1026.

## Three more service layers (2026-09-08): education, medical, entertainment

Same `consumption: 'flag'` distributor pattern as Chapel's `faith` — zero
engine changes, this was a pure catalog addition (see
`shared/asset-economy/buildingEconomy.js`). 8 buildings, grouped into 3
conceptual layers, but **each building distributes its OWN category** (not
one shared per-layer flag): the tier ladder below needs to tell "a doctor
visited" apart from "a public bath is nearby" apart from "a hospital
exists", so each gets its own `servedFlags` key, unlike `totalKey`-aggregated
resources (several farms CAN feed one `food` total; here they can't, by
design, because the tiers below care which specific building it was):

- **education**: `School` → `school`, `Library` → `library`
- **medical**: `Doctor` → `doctor`, `Hospital` → `hospital`, `PublicBath` → `publicBath`
- **entertainment**: `Theatre` → `theatre`, `Cinema` → `cinema`, `Pub` → `pub`

A tier's `requirements` list can still mix categories freely — "reach this
tier only with BOTH pub AND public-bath coverage" is just two
`serviceCoverage` entries (`category: 'pub'` and `category: 'publicBath'`)
in the same tier's array. `HouseTierRequirementPolicy.js` needed no change
for this — it already evaluates every requirement in the list independently
and ANDs them via `meetsTierRequirements`. A service layer never has to
"correspond" to a house level 1:1 (see the tier ladder below, where layers
and levels are deliberately staggered).

Every house/palace type holds one flag-mode `consumer` entry per category
(`faith` + the 8 above) so `servedFlags` is always populated regardless of
whether any tier requires it yet — same reasoning as Chapel's original
rollout. `Library`, `Hospital`, and `Theatre` aren't referenced by any tier
today; wiring one in is a `socialCategoryCatalog.js`-only edit.

## Tier ladder wired in (2026-09-08)

All 3 social categories share the exact same 5-tier ladder, each tier
**cumulative** — repeating every earlier tier's requirement, not just adding
a new one (`HouseLevelPolicy.js` only ever checks the CURRENT tier for
demotion or the NEXT tier for advancement, never further back, so nothing
merges automatically — see `socialCategoryCatalog.js`'s file-level comment):

| Tier | Label (cabane→manoir) | Requirements (cumulative) |
|---|---|---|
| 1 | cabane  | none (free starting tier) |
| 2 | masure  | road, population ≥1, **faith** |
| 3 | logis   | + population ≥4, **demandMet**, **doctor** |
| 4 | demeure | + population ≥8, **publicBath**, **pub** |
| 5 | manoir  | + population ≥12, **school**, **cinema**, **2 distinct food categories this period** |

Tier 5 ("manoir") and its population cap (`HOUSE_LEVEL_5_MAX_POP` in
`HouseCapacityPolicy.js`, `30`) are new — added because tier 1 is
unconditionally free (a house starts there, so a requirement placed on it
would never be evaluated for advancement, only for demotion below tier 1,
which `HouseLevelPolicy.js` already blocks) — every one of the 4 real
gates the ladder above describes needed its own tier, and tier 1 couldn't
be one of them.

Two requirement `kind`s are new in `HouseTierRequirementPolicy.js`, both
reading Supply's `lastConsumption` (already on the house row for the
"unfed citizens" HUD stat — now also threaded into `HouseLevelPolicy.js`'s
context, same as `servedFlags`). Named generically ("a good", not "food")
on purpose — a house's `resourceRoles` can declare any 'consumer'/'quantity'
good (only food exists today; a future pottery/wood/furniture chain would
work identically without either descriptor changing):

- **`demandMet`**: met when `lastConsumption.month === periodKey` (fresh)
  and `totalUnfed === 0` — i.e. every citizen's demand for that good was
  met this period.
- **`goodsVariety`** (`{ min }`): met when `lastConsumption.categoriesTaken`
  (which distinct categories of that good were actually drawn from — new
  field, see `ConsumeResource.js` / `ResourceStock.js#takeAcrossCategories`)
  has at least `min` entries this period.

Scope boundary, stated plainly rather than half-solved: a house currently
holds at most ONE quantity-consumer role, so `lastConsumption` is a single
flat record on the house row — the same "one dedicated field" mode
`periodLock: { field, unit }` already documents for quantity roles, as
opposed to `servedFlags`'s "one field, many keys" mode for flag-mode
services. If a house type is ever given a SECOND quantity-consumed good at
once, `lastConsumption` would need that same shared-key generalization —
**not done now**, and deliberately not built ahead of that real need:
`lastConsumption` is also read directly (still as a flat `{ totalUnfed,
month }` record) by pre-existing, unrelated famine/population-growth code
(`FamineConsequencesPolicy.js`, `FamishedPopulationPolicy.js`,
`GrowHousePopulation.js`) and the house info panel — restructuring it now
would ripple through all of those for a good that doesn't exist yet.

`serviceCoverage` (and now `demandMet`/`goodsVariety`) also got a
correctness fix while wiring this in: the freshness check
(`servedFlags?.[category] === periodKey`) was vacuously TRUE whenever a
caller forgot to pass `periodKey` at all (`undefined === undefined`) — now
guarded with `Number.isFinite(context.periodKey) && ...`, so a missing
period fails closed like everything else. This only ever mattered for
tests/callers that omit `periodKey`; production always threads a real one.

### Building id / mesh id bridge

All 8 buildings borrow their geometry from Kenney's commercial/industrial
city kits, following the exact pattern `Market-Stall` already established
for houses/markets: the **building id** (`School`, `Hospital`, ...) is the
one stable, transversal id every other catalog references (economy,
footprint, social-category requirements) — the **mesh id**
(`Kenney-Commercial-building-i`, ...) only exists in
`presentation/three/assets/buildingAssets.js`'s `geometry.buildingId` field,
copied (not moved) from the raw Kenney entry. Swapping a service's visual
later (a different Kenney building, or a bespoke GLB) means editing only
that one `geometry` block — nothing in Supply, Housing, or Employment ever
sees a mesh id. The raw Kenney entry whose geometry got borrowed has its own
`button` set to `null` (documented inline) so it no longer appears twice in
the carousel under two different names.
