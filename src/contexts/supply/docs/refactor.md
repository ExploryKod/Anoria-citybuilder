## Supply Chain BC

**Vision:** one bounded context for all city internal supply chains (food now; manufactured goods and external trade later). Use cases grouped by chain leg under `application/commands/`.

## Done

- **Harvest (S1):** `HarvestFarmCrop`, `HarvestAllFarmCrops`
- **Consumption (S3):** `ConsumeHouseFood`, `ConsumeAllHouseFood`
- **Surplus (S4):** `ProcessWindmillCollection`, `RunWindmillSurplusCycle`
- **Procurement (S5):** `RunCityMarketFoodCycle`
- **Pipeline (S6):** `RunMonthlyFoodSupplyCycle` + ECS `supply.monthlyFood`
- **Manufacturing (S7):** factory production cycle + ECS `supply.factoryProduction`
- **Manufacturing split (S7b):** `CollectFactoryResources`, `TransformFactoryMaterials`, `ProduceFactoryGoods`, `ProcessFactoryProductionStep`, `RunCityFactoryProductionCycle`; domain `FactoryTransformPolicy`
- **CQRS layout (S8):** `commands/{leg}/`, `queries/`, `workflows/` — business legs nested under commands, not alongside
- **Period-lock + hub-link genericization (S9):** once-per-period lock (producer/consumer) and hub-to-distributor link storage field names both moved from named `ResourceBookkeepingCatalog.js` exports (`PRODUCER_BOOKKEEPING`/`CONSUMER_BOOKKEEPING`/`HUB_TRANSFER_BOOKKEEPING`) to declarative `periodLock`/`hubLink` facts per `resourceRoles` entry — see [`period-lock-catalog-refactor.md`](period-lock-catalog-refactor.md). `ResourceBookkeepingCatalog.js` deleted; nothing named remains outside `buildingCatalog.js`.
- **`consumption: 'flag'` service coverage (S10):** non-depleting distribution mode alongside the original stock-based one — a service building (Chapel, `categories: ['faith']`, no hub leg) marks reached houses "served this period" via their own `periodLock` instead of moving any stock. First real second-role-entry-per-building case, which also fixed `ResourceRolePolicy`'s single-entry-per-role limitation and a silent field-dropping bug in the Dexie read path (`SupplyBuildingSnapshot`/`DexieSupplyBuildingRepository#toSnapshot` now pass through any catalog-declared field generically). See [`period-lock-catalog-refactor.md`](period-lock-catalog-refactor.md).
- **`servedFlags` shared field for flag-mode locks (S11):** `periodLock.field` is now optional — a flag-mode service (like Chapel's faith) omits it and uses the shared `servedFlags: { faith: 3, ... }` object instead (same "one field, many keys" shape `stocks` already uses), so a new flag-mode service never needs a new top-level field name invented per building type. See [`period-lock-catalog-refactor.md`](period-lock-catalog-refactor.md).
- **Economy catalog is the single source for goods, reach, ceilings and gathering (S12):** no good is named in code any more. `maxStock` is a role fact (market 500, silo 1000; none = unbounded, no hidden 500/1000 default), `range` is required on every distributor (no global distance, `foodDistributionDistance` and `SupplySimulationCatalog.js` are gone), and household gathering is a `producer` entry on houses (`scale: 'building' | 'population'`, `requiresOperational: false`) run by the generic `ProduceResource` — `HouseSubsistencePolicy` and `ProduceConsumerSubsistence` are deleted. Catalog-wide questions (stock shape, per-capita need, categories per role/aggregate) live in `shared/building-catalog/resourceRoleQueries.js` so Housing reads them without importing Supply. Guarded by `tests/shared/resourceCatalogIntegrity.test.js`.

## ECS simulation order

```
1. parcels.roadAccess
2. supply.monthlyFood
3. supply.factoryProduction   ← winery collect / transform / produce
```

## Folder layout

```
application/
  commands/
    harvest/
    consumption/
    procurement/
    distribution/
    surplus/
    manufacturing/
  queries/
  workflows/           ← cross-leg orchestrators (RunMonthlyFoodSupplyCycle)
  ports/
infrastructure/
  runtime/supplyMonthlyFoodSystem.js
  runtime/supplyFactoryProductionSystem.js
  presentation/SupplyFoodTraceability.js
  presentation/SupplyProductionJournal.js
  dexie/
```

## Removed legacy

- `FoodDistributionService.js`
- `WindmillService.js`
- `RoadConnectivityService.js`
- `FactoryService.js`
