## Housing BC

**Vision:** residential population — growth, house evolution ladder, published demographics (`type`, `pop`, `roadCount`), welfare reads (famished).

## Done

- **Population growth (H1):** `GrowHousePopulation`, `GrowAllHousePopulation`, `GetCityPopulationSummary`
- **Evolution (H2–H3):** `FoodAffluencePolicy`, `HouseEvolutionPolicy`, `EvolveHouseBuilding`, `EvolveAllHouseBuildings`, `GetResidentialHouseAtTile`
- **Famished population (H4):** `FamishedPopulationPolicy`, `GetFamishedPopulation` — see [`docs/famished-population.md`](famished-population.md)
- **Food affluence (H5):** `EvaluateHouseFoodAffluence`, `PreviewHouseEvolution` — see [`docs/food-affluence.md`](food-affluence.md)
- **City population summary (H6):** `GetCityPopulationSummary`, UI peel via `getCityTotalPopulation` — see [`docs/city-population-summary.md`](city-population-summary.md)
- **ECS:** `housing.populationGrowth`, `housing.evolution` (after food consumption + growth)
- **Legacy peel:** evolution persistence removed from `scene.js`; famished + food icons via Housing context queries

## ECS simulation order

```
1. parcels.roadAccess
2. supply.monthlyFood
3. housing.populationGrowth
4. housing.evolution
5. employment.redistribute
6. supply.factoryProduction
--- scene.update (mesh sync, food icons, famished UI) ---
--- scene.refreshEmploymentPresentation (bar + no-work icons) ---
```

## DDD — boundaries with Employment

Housing **owns what it mutates** and publishes **facts**. It does **not** own Employment’s labor-market language.

| Housing (upstream) | Employment (downstream) |
|---|---|
| `pop`, house `type`, capacity 6/7 | `workerPool`, `elitePool`, chômage |
| growth, evolution, palace +1 pop | `LaborPoolPolicy` — who is worker-eligible |
| famished read (pop + `stocks.food` read-only) | — |

**Do not** move `citizenPopFromHouse` / `workerPopFromHouse` into Housing. See [`employment/docs/boundaries.md`](../employment/docs/boundaries.md).

## DDD — boundaries with Supply (H4)

| Field | Writer | Housing H4 |
|---|---|---|
| `stocks.food` | Supply | read-only via Dexie port |
| famished formula | Housing | `FamishedPopulationPolicy` |

No `import` from `contexts/supply/domain/**`.

## Next slices

_(Housing v1 core complete.)_

## Housing v1 — definition of done

| Criterion | Status |
|---|---|
| Growth + evolution in ECS | ✅ |
| Famished query + scene peel | ✅ |
| Food affluence queries + UI peel (H5) | ✅ |
| City population summary peel (H6) | ✅ |
| DDD boundaries documented | ✅ |

## Folder layout

```
application/
  commands/growth/
  commands/evolution/
  queries/              ← GetFamishedPopulation, EvaluateHouseFoodAffluence, …
  ports/
domain/
  policies/             ← FamishedPopulationPolicy, …
  HouseTypeCatalog.js
  HousingBuildingSnapshot.js
docs/
  famished-population.md
  food-affluence.md
  city-population-summary.md
  refactor.md
infrastructure/dexie/
infrastructure/runtime/
```
