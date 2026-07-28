# Bounded context: Supply

City food **logistics**: market buying/selling and windmill surplus collection.

Code and ubiquitous language are **English**. UI copy may stay French.

## Ubiquitous language

| Term | Definition |
|---|---|
| Crop | `wheat` \| `carrot` \| `cabbage` |
| Basket | One unit of a crop |
| Stock | Per-building crop quantities + total `food` |
| Market | Buys from farms in **autumn**; distributes to houses outside autumn |
| Buying season | Autumn — markets purchase from farms |
| Market reach | House is within Manhattan range of a road-connected market |
| Windmill | December city-wide surplus collector |
| Operational | Road access and staffed (workers) |

## Invariants

- Markets buy from farms **only in autumn**
- Purchase amount ≤ farm available stock and ≤ market remaining capacity
- Farm and market must have road access to trade
- Windmills collect from **all** farms **only in December** (after autumn market buys)
- Windmill and farm must have road access; windmill must be staffed
- `marketTooFar` is true when no road-connected market is within distribution distance
- `food` total on a stock is the sum of crop baskets (kept in sync on write)

## Use cases

**Commands**
- `MarketBuysFromNearbyFarms` — farm → market stock transfer (autumn)
- `MarkMarketBuyingSeason` — persist `isBuying` UI flag from season
- `DistributeFoodFromMarketToHouses` — market → house round-robin (not autumn)
- `WindmillCollectsFromAllFarms` — farm → windmill stock transfer (December, city-wide)
- `UpdateHousesMarketReach` — persist house `marketTooFar` from market Manhattan range
- `UpdateMarketFarmProximity` — persist `noFarmsNearby`
- `MarkWindmillCollectingSeason` / `SetWindmillCollectingFlag` — `isCollecting`
- `ResetFarmsSoldToWindmill` / `MarkFarmSoldToWindmill` — farm sprite flags

**Queries**
- `GetBuildingSupplyView` — per-building DTO (info panel + sprites)
- `ListSupplyMapBuildings` — city map cells (`hasFood`, `marketTooFar`, layout)
- `ListWindmillSupplyViews` — storage section stocks

**Later**
- ECS pipeline system `supply.*`

## Ports

- `SupplyBuildingRepository` (`findById`, `findSupplyView`, `listAllSupplyViews`, `findWindmills`, `findFarms`, …)

## Relations

- **Parcels**: road access — do not own the road graph
- **ACL**: `src/js/acl/supply.js` (also exports `isWithinMarketRange`)
- **Composition**: `createSupplyContext.js`
- Legacy facades: `FoodDistributionService` / `WindmillService` (sales traceability side-effects)
- UI: `game.js` info panel, `scene.js` sprites, `buttons.js` map, `storage-section.js` stocks — via Supply queries

Rule: `src/js/**` must not import `contexts/supply/domain/**` directly.
