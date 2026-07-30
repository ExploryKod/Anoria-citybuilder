# Bounded context : Parcels

Parcellaire : occupation de la grille, voisinage, voirie et desserte routière.

## Ubiquitous language

| Terme | Définition |
|---|---|
| Bâtiment | Construction placée sur une tuile de la grille |
| Route | Tuile de voirie (`roads`, `Road`, `isRoad`) |
| Voisin | Adjacent sur la grille — VO `Neighbor` (`instanceId` UUID, type, tuile, isRoad, zone) |
| Accès routier | ≥ 1 voisin route |
| Desserte | `roadCount` |
| Display label | `{type}-{x}-{y}` — UI / logs uniquement (Shared Kernel `toDisplayLabel`) |

## Invariants

- Une route n'a pas besoin d'accès routier
- `roadCount` = nombre de voisins route
- **PK Dexie** = `instanceId` (UUID) — Shared Kernel `src/shared/building-identity/`
- Legacy UI : `src/js/acl/building-identity.js`
- `TileCoord` : `(x, y)` entiers
- `Neighbor` : pas de stocks / meshes / deltas Three.js
- Snapshot : `id` (UUID) + `buildingId` (VO display, UI only) + `tile` + `neighbors: Neighbor[]`

## Use cases (application)

**Commands**
- `UpdateNeighborsForBuilding` — normalise → `Neighbor[]`, persiste forme sérialisée
- `PlaceBuilding` — après persist legacy : scan spatial → voisins self+adjacents → road access ciblé
- `RemoveBuilding` — `deleteById` → refresh adjacents → road access ciblé
- `RecalculateRoadAccessForBuilding`
- `RecalculateRoadAccessForNeighbors` — batch d'ids (actions joueur)
- `RecalculateAllRoadAccess` — filet de sécurité (tick)

**Queries (CQRS read)**
- `GetBuildingRoadAccess`
- `GetBuildingNeighbors` — read model plat `{ instanceId, type, x, y, isRoad, zone }`

**Ports**
- `BuildingRepository` (+ `deleteById`)
- `SpatialNeighborhoodPort` — découverte grille (adapter : `SceneSpatialNeighborhoodAdapter`)
- `DomainEventPublisher`

Raccourcis composition : `bindSpatialContext`, `getRoadAccess`, `getNeighbors`, `updateNeighbors`, `syncPlacedBuilding`, `syncRemovedBuilding`.

Tick simulation : `createGameRuntime` → system `parcels.roadAccess` (filet `RecalculateAllRoadAccess`).

## Tests

- `roadAccess.behavior.test.js`
- `buildingId.behavior.test.js`
- `houseRecordPolicy.behavior.test.js`
- `neighbors.behavior.test.js`
- `placeRemove.behavior.test.js`

## Hors scope

- Paiement / budget (reste `addHouseAndPay` dans game.js)
- Meshes Three.js / `city.tiles` (scene.js)
- Évolution des maisons, food, emploi
- Liste `markets` en zone (hors Parcels, encore HousesStore)

## Infrastructure (adapters)

| Dossier | Rôle |
|---|---|
| `infrastructure/dexie/` | `DexieBuildingRepository` → port `BuildingRepository` |
| `infrastructure/spatial/` | `SceneSpatialNeighborhoodAdapter` → port spatial |
| `infrastructure/events/` | `InMemoryDomainEventPublisher` → port events |
| `infrastructure/runtime/` | ECS `parcelsRoadAccessSystem` |
| `infrastructure/presentation/` | `roadAccessIcons` (legacy Three.js) |

Les adapters **implémentent** les ports application et **dépendent** du domaine (Clean Architecture).

## Relations (context map)

- **ACL** legacy : `src/js/acl/parcels.js`
- **Infrastructure** : `contexts/parcels/infrastructure/` (adapters Dexie, spatial, events, runtime)
- **Composition** : `createParcelsContext.js`
- **Voisin persisté** : `{ instanceId, type, x, y, zone, isRoad }`

Règle : `src/js/**` n'importe jamais `contexts/parcels/domain/**` directement.
