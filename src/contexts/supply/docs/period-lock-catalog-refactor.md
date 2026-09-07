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

## What this unblocks

With `periodLock` now declarative, the `consumption: 'flag'` mode
(service coverage — see the Caesar-3-mechanics-port plan) can add a
non-depleting branch to `DistributeResourceToConsumers.js` that still uses
`PeriodLockPolicy` for its "served this period" write, driven entirely by a
`periodLock` + `consumption: 'flag'` fact on a service building's
`distributor` role in the catalog — no new named bookkeeping object needed.
That work has not started yet; this document is the checkpoint to resume
from.
