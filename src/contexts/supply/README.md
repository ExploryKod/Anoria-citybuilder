# Bounded context: Supply Chain

City **internal logistics**: stocks, flows between buildings, and household consumption.

Code and ubiquitous language are **English**. UI copy may stay French.

## Scope

Supply Chain owns every **source → hub → sink** flow inside the city:

| Leg | Examples (now / later) |
|---|---|
| **Harvest** | Farm annual crop yield |
| **Manufacturing** | Factory output (future — absorb `FactoryService`) |
| **Procurement** | Market buys from farms (now), from factories (future) |
| **Distribution** | Market → houses (food now, winery/pottery/etc. later) |
| **Surplus** | Windmill city-wide collection |
| **Consumption** | House food use (next slice) |
| **External trade** | Partner import/export (future — optional module) |

**Out of scope** (read-only dependencies):

- **Parcels** — road access, neighborhood, distance
- **Employment** — staffing (`OperationalGatePolicy`)
- **Housing** — population, evolution (reads stocks) → `contexts/housing/` (H1: growth done)
- **Budget** — payments (reacts to flows later)

## Ubiquitous language

| Term | Definition |
|---|---|
| **Product** | Any stockable good (crop, manufactured, raw) |
| **Stock** | Quantities per product on a building |
| **Source** | Building that creates stock (farm harvest, factory output) |
| **Hub** | Market, windmill — collects / redistributes |
| **Sink** | House — consumes |
| **Harvest** | Annual crop creation on a farm (≠ factory manufacturing) |
| **Procurement** | Hub buys from a nearby source |
| **Distribution** | Hub sends goods to sinks within range |
| **Consumption** | Sink removes stock according to demand |
| Crop | `wheat` \| `carrot` \| `cabbage` |
| Basket | One unit of a crop |
| Operational | Road access and staffed when `worker_need > 0` |

## Invariants (food chain — v1)

- Farms harvest **only in autumn**, **once per year**, **78 baskets** of their crop
- Harvest requires road access and workers (`OperationalGatePolicy`)
- Houses consume **1 basket per citizen per month**, wheat → carrot → cabbage
- Consumption runs **once per month** per house (`lastConsumptionMonth`)
- Markets buy from farms **only in autumn**
- Windmills collect from **all** farms **only in December**
- `food` total on a stock is the sum of crop baskets (kept in sync on write)

## Use cases (by chain leg)

### Harvest
- `HarvestFarmCrop` — single farm annual yield
- `HarvestAllFarmCrops` — city-wide orchestration

### Consumption
- `ConsumeHouseFood` — single house monthly food use
- `ConsumeAllHouseFood` — city-wide orchestration

### Procurement
- `MarketBuysFromNearbyFarms` — farm → market (autumn)
- `MarkMarketBuyingSeason` — persist `isBuying` UI flag

### Distribution
- `DistributeFoodFromMarketToHouses` — market → house round-robin (not autumn)
- `UpdateHousesMarketReach` — persist house `marketTooFar`

### Surplus
- `WindmillCollectsFromAllFarms` — farm → windmill (December)
- `ProcessWindmillCollection` — one windmill + flags + sales history
- `RunWindmillSurplusCycle` — city-wide windmill monthly cycle
- `MarkWindmillCollectingSeason` / `SetWindmillCollectingFlag` / `MarkFarmSoldToWindmill` / `ResetFarmsSoldToWindmill`

### Proximity flags
- `UpdateMarketFarmProximity` — persist `noFarmsNearby`

### Queries
- `GetBuildingSupplyView`, `ListSupplyMapBuildings`, `ListWindmillSupplyViews`, `ListSupplyStockSnapshots`

`GetBuildingSupplyView` gates UI flags for presentation:

```javascript
isBuying: operational && view.isBuying      // OperationalGatePolicy
isCollecting: operational && view.isCollecting
```

→ `scene.update` reads these flags for market/mill sprites without checking `employees.worker` directly.  
Employment icons (`no-work`) : Employment BC via `refreshEmploymentPresentation` — see [`employment/docs/presentation.md`](../employment/docs/presentation.md).

### Manufacturing (factory)
- `UpdateFactoryWorkerDemandFromCaps` — publish `employees.worker_need` from player line caps (before Employment)
- `AllocateFactoryWorkersToCommodityLines` — split assigned workers across commodity lines (after Employment)
- `GetFactoryWorkerPlanView` — read model for factory admin UI (demand / allocation preview)

Domain: `FactoryCommodityProductionPolicy` — per-factory `commodityProductionEnabled` toggle (Cesar III style), independent of destination cap split.

### Planned
- Generic `ProductStock` + market distribution of manufactured goods
- ECS pipeline systems `supply.*`

## Monthly tick order (target)

```
1. harvestAll          ← autumn
2. markBuyingSeason
3. marketBuy           ← autumn procurement
4. distributeToHouses  ← outside autumn
5. windmillCollect     ← december + off-season flags
6. consumeAllHouses    ← monthly
```

Wired today: ECS pipeline `supply.monthlyFood` via `createGameRuntime`.

## Folder layout

```
application/
  commands/
    harvest/           ← source leg (farm yield)
    consumption/       ← sink leg (house food use)
    procurement/       ← market buys, proximity flags
    distribution/      ← market → houses
    surplus/           ← windmill collection cycle
    manufacturing/     ← factory collect / transform / produce
  queries/
  workflows/           ← cross-leg orchestrators (monthly food pipeline)
  ports/
domain/
  policies/          ← shared gates (season, operational, range, capacity)
  value-objects/     ← FoodStock (v1), ProductStock (future)
infrastructure/dexie/
```

CQRS rule: **commands** and **queries** are the top-level axes; chain legs (`harvest`, `procurement`, …) are subfolders under `commands/`, not siblings of `commands/`.

## Ports

- `SupplyBuildingRepository` — stocks, flags, harvest metadata (`lastProductionYear`), consumption metadata (`lastConsumptionMonth`)

## Infrastructure

- `infrastructure/dexie/DexieSupplyBuildingRepository.js`

## Relations

- **Shared Kernel**: `building-identity` for published ids
- **ACL**: `src/js/acl/supply.js`
- **Composition**: `createSupplyContext.js`, `createGameRuntime.js`, `createMonthlySupplyPipeline.js`
- **Traceability**: `SupplyFoodTraceability` → legacy `window.foodTraceabilityService`

Rule: `src/js/**` must not import `contexts/supply/domain/**` directly.
