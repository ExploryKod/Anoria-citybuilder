## Supply Chain BC

**Vision:** one bounded context for all city internal supply chains (food now; manufactured goods and external trade later). Use cases grouped by chain leg under `application/`.

## Done

- **Harvest (S1):** `HarvestFarmCrop`, `HarvestAllFarmCrops` — autumn annual yield; wired in `FoodDistributionService` before market procurement; removed from `scene.js`.
- **Consumption (S3):** `ConsumeHouseFood`, `ConsumeAllHouseFood` — monthly house food use; wired in `FoodDistributionService` after distribution; traceability in facade; removed from `scene.js`.

## Next

- **ProductStock** — generalize beyond `FoodStock` when market distributes manufactured goods
- **Monthly pipeline** — explicit orchestration in composition root

## Building identity

**Source of truth:** [`src/shared/building-identity/README.md`](../../shared/building-identity/README.md)

Supply commands import `resolvePublishedBuildingIdFromRef` from the Shared Kernel directly.
