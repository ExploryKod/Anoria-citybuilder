# Bounded context: Employment

City **workforce allocation**: houses supply labor; workplaces receive workers by sector priority.

Code and ubiquitous language are **English**. UI copy may stay French.

## Ubiquitous language

| Term | Definition |
|---|---|
| Labor source | House with road access; contributes `pop` as available workers |
| Workplace | Non-house, non-road building with `workerNeed > 0` |
| Sector | Static employment sector on a workplace (set at creation) |
| Sector priority | Ordering for hiring — **1 = highest** (looked up outside the domain) |
| Staffing | Assigned `worker` count vs `workerNeed` |
| Road access | Persisted `roadCount` from Parcels — Employment does not own the road graph |

## Invariants

- Only houses with `roadCount > 0` contribute to the labor pool
- Only workplaces with `roadCount > 0` and `workerNeed > 0` receive workers
- Houses and roads are never workplaces
- Allocation is greedy by ascending sector priority (1 before 6)
- Assigned workers never exceed `workerNeed`
- Redistribution resets workplace `worker` to 0 before allocating

## Use cases

**Commands**
- `DistributeCityWorkers` — monthly city-wide reset + priority allocation

**Later**
- Elite workers, distance-based hiring, admin priority commands, UI queries

## ECS

- `employment.redistribute` — monthly worker allocation (after `housing.evolution`, before `supply.factoryProduction`)
- `infrastructure/runtime/synchronizeFactoryWorkerDistribution.js` — Winery productWorkerDistribution sync after allocation

## Ports

- `EmploymentBuildingRepository` — labor sources, workplaces, reset / save workers

## Infrastructure

- `infrastructure/dexie/DexieEmploymentBuildingRepository.js` → port `EmploymentBuildingRepository`

## Relations

- **Housing** (upstream): reads persisted `type` + `pop`; owns `LaborPoolPolicy` locally — see [`docs/boundaries.md`](docs/boundaries.md)
- **Parcels**: road access via persisted `roadCount` (no Parcels domain import)
- **Supply**: reads staffing (`worker` / `workerNeed`) from persistence for operational gates — no Employment→Supply coupling
- **ACL**: `src/js/acl/employment.js`
- **Composition**: `createEmploymentContext.js`, `createGameRuntime.js`

Rule: `src/js/**` must not import `contexts/employment/domain/**` directly.
