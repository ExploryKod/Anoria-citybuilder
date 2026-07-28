# Supply — to refactor later

## Building identity (`resolveBuildingId`)

**Symptom (fixed with a shim):** house food distribution failed because HousesStore rows use `name` as the published id (`House-Purple-3-7`), while neighbor blobs use `id` for that same value and `name`/`type` for the building type. Reconstructing `${name}-${x}-${y}` produced ghost ids like `House-Purple-3-7-3-7`.

**Current mitigation:** `application/commands/resolveBuildingId.js` heuristics (`id` → `buildingId` → published-looking `name` → `${type}-${x}-${y}`).

**Refactor goal:** one canonical building identity across Dexie stores, neighbors, and Supply ports — no dual meaning of `name`, no pattern sniffing. Prefer:

- always publish `id` (and keep `type` separate);
- or a shared ACL mapper at the Parcels / persistence boundary so Supply never sees legacy shapes.

Until then, treat `resolveBuildingId` as temporary compatibility debt, not domain logic.

## Presentation boundary (done)

Scene sprites, city map (`buttons.js`), storage windmill stocks, and the info panel now read Supply fields via ACL queries (`GetBuildingSupplyView`, `ListSupplyMapBuildings`, `ListWindmillSupplyViews`). Flag writes (`isBuying`, `isCollecting`, `noFarmsNearby`, `soldToWindmill`, `marketTooFar`) go through Supply commands. Remaining facade Dexie use is for non-Supply data (employees, pop, commerce settings, sales history arrays).

## Market reach: panel vs logistics (two definitions)

**Current behavior (do not change casually — player-facing):**

| Surface | Rule | Source |
|---|---|---|
| Logistics | House in range if Manhattan ≤ `foodDistributionDistance` (default 5) to a road-connected market | `UpdateHousesMarketReach`, `findHousesInRange`, distribute |
| Market info panel | « Maisons à portée » if any **neighbor** looks like a house | `GetBuildingSupplyView.hasHousesNearby` (neighbor filter) |

**Why it hurts**

- A market can buy from farms (neighbors) while all houses are `marketTooFar` and get no food — correct by Manhattan, confusing in the panel (« Aucune maison à portée » vs houses that look “nearby” on the map, or the reverse: neighbor house adjacent but still outside distribute range if we ever change neighbor radius).
- Debugging: console `Market reach via Supply BC` (`inRange` / `tooFar`) and the Approvisionnement panel can disagree; players/devs assume one meaning of « à portée ».
- Icons / `marketTooFar` follow Manhattan; the panel follows adjacency — two product stories for the same words.

**Desirable later (feature change, needs an explicit product decision)**

- Align the market info panel (and any UI copy) on the **same** Manhattan reach used by Supply (`isWithinMarketRange` / `UpdateHousesMarketReach`).
- Keep neighbor lists for placement / road / farm adjacency only — not as a synonym for distribution range.

**Risk if done without care:** players who learned « maison voisine du marché = desservie » will see different panel text and possibly different expectations after the change; treat as a deliberate UX/rules update, not a silent fix.
