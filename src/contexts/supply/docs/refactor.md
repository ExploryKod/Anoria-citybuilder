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
