# Period-lock catalog refactor (2026-09-07)

## Why

While scoping a Caesar-3-style "service coverage" mechanic (a bathhouse-like
building marking nearby houses "served" without moving a depletable
stock — see the Caesar-3-mechanics-port discussion), we needed a
`consumption: 'flag' | 'quantity'` switch on `resourceRoles`. Building it
surfaced a naming problem in the existing once-per-period lock: producer and
consumer commands took an injected `bookkeeping` object selected from **named
exports** in `ResourceBookkeepingCatalog.js`
(`PRODUCER_BOOKKEEPING`/`CONSUMER_BOOKKEEPING`). That's a small library of
named services wearing a catalog costume — every new role or mode still
needed a programmer to add a new named constant *and* a new call site that
picks it by name.

Rule going forward: **`buildingCatalog.js` (via its theme files) is the only
place any name is allowed to appear** (`bathhouse`, `windmill`, `flag`,
`quantity`, a lock field name, ...). Everything downstream reads shape, not
name.

## What changed

- **New:** `contexts/supply/domain/policies/PeriodLockPolicy.js` — a generic
  once-per-period lock with **no notion of "producer"/"consumer"/anything
  else**, only "a field, a unit, a value": `isLockedForPeriod(building,
  periodLock, period)` and `buildLockUpdate(periodLock, period, extraFields)`.
- **New:** `periodLock: { field, unit }` fact on a `resourceRoles` entry (see
  `buildingCatalog.js` JSDoc `ResourceRoleFacts.periodLock`), declared per
  building in `shared/asset-economy/buildingEconomy.js` — e.g. farms declare
  `periodLock: { field: 'lastProductionYear', unit: 'year' }` on their
  `producer` role, houses declare `periodLock: { field:
  'lastConsumptionMonth', unit: 'month' }` on their `consumer` role.
- **New:** `getPeriodLockForRole(buildingType, role)` in `ResourceRolePolicy.js`,
  alongside the existing `getScheduleForRole`/`getAmountForRole` accessors.
- **Changed:** `ProduceResource.js` and `ConsumeResource.js` no longer take an
  injected `bookkeeping` param — they resolve their own `periodLock` from the
  building's catalog entry and call `PeriodLockPolicy` directly.
- **Changed:** `RunMonthlyResourceCycle.js` and `composition/createSupplyContext.js`
  no longer thread `producerBookkeeping`/`consumerBookkeeping` config through —
  that plumbing is gone, not replaced.
- **Removed:** `PRODUCER_BOOKKEEPING` and `CONSUMER_BOOKKEEPING` from
  `ResourceBookkeepingCatalog.js`.

No stored field names changed (`lastProductionYear`, `lastConsumptionMonth`,
`lastConsumption` are the same as before) — this is a pure refactor of *where
the shape is declared*, not of what's persisted. All 995 existing tests pass
unchanged in behavior (two test files updated only to drop the now-removed
`bookkeeping:` param from `execute()` calls).

## Update (same day, second pass): hub-link storage genericized too

`ResourceBookkeepingCatalog.js` still existed after the first pass above,
holding one remaining named export, `HUB_TRANSFER_BOOKKEEPING` — the same
disease in miniature (one named constant selected by the composition root
and injected into `TransferHubToHub.js` as a `bookkeeping` param). Fixed the
same way as the period lock: added a `hubLink` fact to `ResourceRoleFacts`
(see `buildingCatalog.js` JSDoc) — the `'distributor'` role declares
`sourceLinkField` (which of its own fields points at its assigned hub), the
`'hub'` role declares `linksField`/`linkTargetIdField`/`allocationField`
(its own linked-distributors list shape). Windmill-001's `hub` role and
Market-Stall*'s `distributor` role in `buildingEconomy.js` now carry these.

`ResourceRolePolicy.getHubLinkForRole(buildingType, role)` resolves it —
no separate policy module needed (unlike `periodLock`, there's no
computation here, just field names to read, so `TransferHubToHub.js` reads
them directly). `TransferHubToHub.execute()` no longer takes a `bookkeeping`
param at all, and calls `repository.saveHubLinkedDistributors(...)` directly
instead of through an injected `saveLinks` closure (that closure was never a
name choice — it always just called that one fixed repository-port method).

**`ResourceBookkeepingCatalog.js` has been deleted entirely** — nothing
named remains in the supply context's bookkeeping layer; every field name is
now a catalog fact on the building type that owns it. `refactor.md`/this doc
are the record to come back to if a second hub-and-spoke resource ever needs
a different link-storage shape (today only food's Windmill↔Market pair
exists, so `linksField`/`linkTargetIdField`/`allocationField` are declared
once, but nothing stops a second hub building from declaring its own).

## Update (2026-09-07, third pass): `consumption: 'flag'` shipped — Chapel serves houses

Implemented the coverage mode this refactor unblocked. `DistributeResourceToConsumers.execute()`
now branches on `getConsumptionModeForRole(source.type, 'distributor')`:
`'quantity'` (default) is the untouched original stock path; `'flag'` is a
new private `#distributeFlag` path with no stock at all — for each consumer
in range, it reads THAT CONSUMER's own `periodLock` (via
`getPeriodLockForRole(consumer.type, 'consumer', category, 'flag')`) and
writes it with `PeriodLockPolicy.buildLockUpdate` if not already served this
period. Same `{ distributed, transfers, totalUnits }` return shape as the
quantity path, so `RunCityResourceCycle`'s event publishing (→ walker
visualization via the existing `supply.resourceDelivered` → `walkerEventCatalog.js`
mapping) needed zero changes.

Chapel (`buildingEconomy.js`) is the first flag-mode distributor:
`{ role: 'distributor', categories: ['faith'], range: 5, schedule: {unit:'always'}, consumption: 'flag' }`
— no `hubLink`, so it distributes straight from itself exactly like the
"school distributing education" case `RunCityResourceCycle`'s own docstring
already anticipated. Each house gained a *second* `consumer` entry (alongside
its existing food one): `{ role: 'consumer', categories: ['faith'], consumption: 'flag', periodLock: {field: 'lastFaithServedMonth', unit: 'month'} }`.

**This surfaced two more places the same discipline had to reach, both fixed
as part of this pass, not deferred:**

1. **`ResourceRolePolicy.js` couldn't handle two entries of the same role.**
   Every accessor did `.find(entry => entry.role === role)` — the FIRST
   match only. A house needing both a 'quantity' consumer entry (food) and a
   'flag' one (faith) would have silently lost the second. Fixed by adding
   a shared `findRoleEntry(buildingType, role, {category, consumption})`
   used by every accessor, with `category`/`consumption` now optional
   disambiguating params (`ConsumeResource.js` explicitly asks for the
   `'quantity'` entry so it never touches a flag entry's non-existent stock).
2. **`SupplyBuildingSnapshot.js` / `DexieSupplyBuildingRepository#toSnapshot`
   silently dropped any field not on their hardcoded named-parameter list.**
   Writes (`updateBuildingFields`) were already fully generic, but reads
   were not — a brand-new `periodLock.field` name like `lastFaithServedMonth`
   would write fine and then vanish on the next read, since the snapshot
   constructor only forwarded the same fixed whitelist
   (`lastProductionYear`, `lastConsumptionMonth`, ...) that happened to
   cover food's two fields already. Fixed with a generic `...rest`
   passthrough in both files, named fields still validated/coerced as
   before. This bug was invisible until now because every prior periodLock
   field name was already on that whitelist by coincidence, and the test
   suite's in-memory repositories already spread raw fields generically —
   only the real Dexie adapter had the gap.
3. **`UpdateConsumerDistributorReach` would have conflated "too far for
   food" with "too far for any service"** once Chapel joined the generic
   'distributor' pool — it queried `findByResourceRole('distributor')` with
   no category filter, so a house near a chapel but far from any market
   would have wrongly cleared its `distributorTooFar` flag. Fixed by adding
   an optional `category` param (threaded through to
   `findBuildingsWithRoleInRange`) and scoping `RunMonthlyResourceCycle`'s
   call to it via a new `reachCategories` config field, kept equal to the
   pre-existing food-only category list — so this flag's meaning is
   unchanged even though `RunMonthlyResourceCycle.categories` itself
   broadened (`createSupplyContext.js`'s `distributionCategories =
   getAllCategoriesForRole('distributor')`) to include Chapel in the actual
   distribution cycle.

Tests: `tests/contexts/supply/chapelServesHouses.behavior.test.js` (unit,
5 cases) + a third case added to `runCityResourceCycle.behavior.test.js`
(full orchestration, including the no-hub-leg path). 1001/1001 passing.

## Update (2026-09-07, fourth pass): `periodLock.field` made optional for flag services — `servedFlags` shared field

User caught that `periodLock: { field: 'lastFaithServedMonth', unit: 'month' }`,
repeated verbatim across all 4 house entries, was proliferation-prone: every
NEW flag-mode service (a school, a bath house, ...) would need its own
invented top-level field name, repeated on every consumer type that needs
it. That's exactly the shape `stocks` already solved for quantity resources
(`{ wheat, carrot, food }` — one field, many keys), just not yet applied to
period locks.

Fixed in `PeriodLockPolicy.js`: `periodLock.field` is now optional.
- `{ field, unit }` (unchanged): one dedicated building field — still used
  for the two quantity locks (`lastProductionYear`, `lastConsumptionMonth`),
  which will only ever have one lock each.
- `{ unit }` (no `field`, new): the shared `SHARED_FLAG_FIELD` export
  (`'servedFlags'`) object, keyed by category — `{ faith: 3 }`,
  `{ faith: 3, education: 4 }`, etc. `isLockedForPeriod`/`buildLockUpdate`
  both take an extra `category` param for this shape;
  `buildLockUpdate` reads the building's *current* `servedFlags` first and
  merges the one key it's setting, so writing one service's flag can never
  clobber another's.

Chapel's houses now declare `periodLock: { unit: 'month' }` (no field) for
`faith` — adding a second flag-mode service (a school for 'education', say)
needs a distributor building's catalog entry plus one more `{ role:
'consumer', categories: ['education'], consumption: 'flag', periodLock:
{ unit: 'month' } }` line per house type, and NOTHING ELSE — no new field
name, no code change anywhere. `lastFaithServedMonth` no longer exists
anywhere in the codebase (grepped clean).

New tests: `periodLockPolicy.test.js` (8 unit cases, including the
merge-doesn't-clobber case). `chapelServesHouses.behavior.test.js` and
`runCityResourceCycle.behavior.test.js` updated to assert `servedFlags:
{ faith: N }` instead of the old bespoke field. **1009/1009 passing.**

## Related fix (2026-09-07): Kenney-sourced house mesh resync was silently no-op

Not part of this refactor's own scope, but discovered testing the tier
system live: `scene.js`'s `syncResidentialHouseMeshFromDb` (the per-tick
mesh resync for a residential tile) called `assetManager.createAsset(...)`
unconditionally — but `VillageTownAssetManager`'s `#assets` factory
dictionary is only ever populated for `source: 'villageTown'` catalog
entries (its own registration loop explicitly skips anything else). Every
House-Blue/Red/Purple level-variant id is `source: 'kenneyCityKit'`, so
`createAsset` always failed for them (`does not exist` console warning) —
this had been dormant because house `type` never changes after placement,
so the mesh-swap branch essentially never fired before level-aware
resync existed. Fixed by branching on `ASSET_CATALOG[id]?.source`: Kenney
ids now go through `resolveAndCreateBuildingMesh` (the same adapter-based
resolver `placeTileMeshIfNeeded` already used for initial Kenney
placement), villageTown ids (the palace) keep using `createAsset`.
Wrapped in try/catch so one bad id can't break the whole scene sync tick.

**Follow-up (same day):** the user pushed back on this fix reintroducing a
`source === 'kenneyCityKit'` branch in `scene.js` at all — `resolveAndCreateBuildingMesh`
is already fully source-agnostic (routes through `buildingSourceAdapterRegistry`,
whose `'villageTown'` adapter itself delegates to `assetManager.createAsset`
internally), so nothing outside the adapter registry should ever branch on
source. Simplified `syncResidentialHouseMeshFromDb` back to one unconditional
call. This also surfaced a real, separate, longstanding bug in
`placeTileMeshIfNeeded` (initial placement): its own pre-existing
`source === 'kenneyCityKit'` branch `return`ed early, skipping
`mesh.userData.instanceId = placedInstanceId` and `parcels.syncPlacedBuilding(...)`
— meaning every Kenney-sourced building placement (all houses, farms,
windmill, market stalls) never got its immediate neighbor/road-access sync.
Confirmed via `parcels.roadAccess`'s periodic full-city recompute
(`RecalculateAllRoadAccess`, runs every tick regardless of source) that this
was self-healing within one tick rather than a hard gameplay break, but a
real UX/correctness gap for a newly-placed Kenney building until the next
tick. Fixed by merging both branches into one flow — no source check
anywhere in `scene.js` at all now.

**Second follow-up (same day):** user reported houses visibly shifting
position on evolution — Caesar 3's don't. Two real causes found and fixed
(later partly superseded — see the third follow-up below):
1. The `levelVariants` Kenney ids assigned earlier had MISMATCHED
   footprints vs. their base house (e.g. artisans' level-4 `type-f` is 2×2
   while the base `type-a` is 2×1) — footprint size drives placement
   centering, so a mismatch shifts the mesh. Re-picked all 9 variants to
   match their base house's footprint exactly (verified against
   `kenneyCityKitRegistry.generated.js`'s per-id sizes). Added a permanent
   regression test (`resolveVisualBuildingId.test.js`) that checks every
   declared `levelVariants` entry against `resolveFootprint` — this class
   of bug can't silently recur. (This part still stands.)
2. Even with matching footprints, `syncResidentialHouseMeshFromDb` never
   applied the multi-tile centering offset (`(gridSize-1)/2` on
   `position.x/z`) that `placeTileMeshIfNeeded` applied at initial
   placement — added the same centering step to the resync path. (This part
   was REMOVED again in the third follow-up below, once the real fix
   — adapters self-positioning — made it redundant.)

**Third follow-up (2026-09-08): the actual root cause — adapters weren't
consistently self-positioning.** User reported the placement GHOST looked
"slightly uncentered" relative to where a house actually lands. Root cause
was the opposite of what that phrasing suggests: `buildingSourceAdapterRegistry.js`'s
own documented contract says `createMesh` must return a FULLY positioned
mesh (footprint centering included) — `KenneyCityKitMeshAdapter.createBuilding`
already does this correctly (anisotropic, footprint- and rotation-aware:
`centerX=(footprintWidth-1)/2`, `centerZ=(footprintDepth-1)/2`), but
`villageTownBuildingAdapter.createMesh` did not (just placed the mesh at
the tile's raw x,y). `placementGhost.js` already correctly trusts adapters
to self-position (skips its own `setTilePosition` whenever
`getGhostAdapter(assetId)` returns one) — so the ghost for a Kenney house
was already right. `scene.js`'s REAL placement/resync paths, however, both
added their OWN external `(gridSize-1)/2` isotropic centering on top of
whatever `resolveAndCreateBuildingMesh` returned (added in the second
follow-up's point 2, and pre-existing in `placeTileMeshIfNeeded` since
before this whole refactor) — for Kenney houses this double-centered them
(shifted further than intended), making the real building diverge from the
ghost's (correct) preview position, not the other way around.

Fixed at the source instead of patching every caller: made
`villageTownBuildingAdapter.createMesh` also self-center (reusing its
existing `setTilePosition` helper, footprint via the same
`resolveGridSize` scene.js/ghost already used), so BOTH adapters now
honor the "fully positioned" contract identically. Removed the external
centering from both `placeTileMeshIfNeeded` and
`syncResidentialHouseMeshFromDb` entirely (including the step added in the
second follow-up above) — no caller anywhere adjusts an adapter-returned
mesh's position anymore. `resolveAndCreateBuildingMesh` now also passes
`buildingId` through to `createMesh` (adapters that don't carry their own
footprint catalog, i.e. villageTown, need it to call `resolveGridSize`).
No real villageTown building is multi-tile today (only the 3 Kenney houses
are), so this had never visibly manifested for villageTown itself — but
the contract violation was real and the fix is needed for the actual
Kenney-house bug regardless. New tests: `villageTownBuildingAdapter.test.js`.
**1025/1025 passing.**

**Not done yet (Phase 2/3 of the Caesar-3-mechanics-port plan):** plugging
`servedFlags.faith` coverage into `HouseTierRequirementPolicy` as a new
requirement kind (the `hasChapelNearby` placeholder test already anticipates
this), and labor-allocation road-reachability in Employment — neither
touched by this pass.
