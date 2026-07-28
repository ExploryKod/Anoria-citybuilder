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

**Queries**
- `GetBuildingSupplyView` — flat DTO for info panel (stocks, flags, sales, collection). Market « maisons à portée » still uses **neighbors** (legacy feature).

**Later**
- ECS pipeline system `supply.*`
- Wire remaining UI reads (scene sprites, buttons map) through Supply queries

## Ports

- `SupplyBuildingRepository` (`findById`, `findSupplyView`, …)
- `DomainEventPublisher` (optional events later)

## Relations

- **Parcels**: road access (`roads` count / `hasRoadAccessFromCount`) — do not own the road graph
- **ACL**: `src/js/acl/supply.js`
- **Composition**: `createSupplyContext.js`
- Legacy facade: `FoodDistributionService` / `WindmillService`
- Info panel: `game.js` reads Supply via `supply.getBuildingSupplyView` (not raw Dexie for Supply fields)

Rule: `src/js/**` must not import `contexts/supply/domain/**` directly.
