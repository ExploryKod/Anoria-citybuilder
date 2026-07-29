# Bounded context: Housing

City **residential population**: growth, house evolution ladder, published demographics.

Code and ubiquitous language are **English**. UI copy may stay French.

## Scope

| Concern | Owner |
|---|---|
| Population growth | Housing |
| House evolution (Blue → Red → Purple → Palace) | Housing (logic); scene.js (meshes) |
| Total `pop`, residential capacity | Housing |
| Worker-eligible vs élite **labor split** | Employment (`LaborPoolPolicy`) |
| Food consumption | Supply |
| Road access | Parcels |
| Worker allocation | Employment |

## Ubiquitous language (Housing)

| Term | Definition |
|---|---|
| **Residential house** | Blue, Red, Purple, or Palace building |
| **Population (`pop`)** | Total residents at a house (persisted aggregate) |
| **Resident capacity** | Max `pop`: 6 (regular), 7 (palace = 6 + 1 additive slot) |
| **Growth** | +1 `pop`/month up to capacity when road connected |
| **Palace evolution** | Purple → Palace adds +1 to `pop` (additive slot, not a replacement) |

Worker-eligible **citizens** and **élites** (labor-market terms) are defined in **Employment** — see `contexts/employment/docs/rules.md`.

## Invariants (v1)

- Population grows **+1 per month** up to cap when road connected
- Growth is **not tied to food** (famished citizens allowed)
- No road → `pop = 0`
- Regular house cap: **6**; palace cap: **7**
- One growth tick per house per month (`lastPopulationGrowthMonth`)

## Use cases

### Growth (H1 — done)
- `GrowHousePopulation`, `GrowAllHousePopulation`, `GetCityPopulationSummary`

### Evolution (H2–H3 — done)
- `FoodAffluencePolicy`, `HouseEvolutionPolicy`
- `EvolveHouseBuilding`, `EvolveAllHouseBuildings`
- `GetResidentialHouseAtTile` — tile lookup after id rename
- ECS `housing.evolution`; UI food/evolution via Housing context queries (H5)

### Famished population (H4 — done)

- `FamishedPopulationPolicy`, `GetFamishedPopulation`
- Reads `stocks.food` (Supply writer) + `pop` (Housing writer) without cross-domain import
- Docs: `docs/famished-population.md`

### Food affluence (H5 — done)

- `EvaluateHouseFoodAffluence`, `PreviewHouseEvolution`
- Legacy UI (`scene.js`, `game.js`) → `housing.evaluateHouseFoodAffluence` / `previewHouseEvolution`
- Docs: `docs/food-affluence.md`

### City population summary (H6 — done)

- `GetCityPopulationSummary`; legacy UI → `getCityTotalPopulation(housesStore)`
- `HousesStore.getGlobalPopulation()` deprecated, delegates to Housing query
- Docs: `docs/city-population-summary.md`

## ECS simulation order

Each **simulation tick** (`game.update`) — see [`employment/docs/presentation.md`](../employment/docs/presentation.md) for full presentation flow:

```
game.update
  scene.update                    ← pass 1
  ECS:
    1. parcels.roadAccess
    2. supply.monthlyFood
    3. housing.populationGrowth
    4. housing.evolution
    5. employment.redistribute
    6. supply.factoryProduction
  services (RandomEvents, Commerce, …)
  scene.update                    ← pass 2
  refreshEmploymentPresentation   ← bar + no-work icons only
```

## Folder layout

```
application/
  commands/growth/
  commands/evolution/
  queries/
  ports/
domain/
  policies/
docs/
  famished-population.md
  refactor.md
infrastructure/dexie/
infrastructure/runtime/
```

## Relations

- **Shared Kernel**: `building-identity` only (not labor eligibility rules)
- **Supply (upstream writer)**: `stocks.food` on Dexie row — Housing reads for famished ([`docs/famished-population.md`](docs/famished-population.md))
- **Employment (downstream)**: reads `type` + `pop` — [`employment/docs/boundaries.md`](../employment/docs/boundaries.md)
- **ACL**: `src/js/acl/housing.js` (composition root only — no domain re-exports)
- **Composition**: `createHousingContext.js`, `createGameRuntime.js`

Rule: `src/js/**` must not import `contexts/housing/domain/**` directly.
Rule: Housing must not import `contexts/employment/domain/**`.
