# Bounded context : Parcels

Parcellaire : occupation de la grille, voisinage, voirie et desserte routière.

## Ubiquitous language

| Terme | Définition |
|---|---|
| Bâtiment | Construction placée sur une tuile de la grille |
| Route | Tuile de voirie (`roads`, `Road`, `isRoad`) |
| Voisin | Adjacent sur la grille — VO `Neighbor` (id, type, tuile, isRoad, zone) |
| Accès routier | ≥ 1 voisin route |
| Desserte | `roadCount` |

## Invariants

- Une route n'a pas besoin d'accès routier
- `roadCount` = nombre de voisins route
- `BuildingId` : `{type}-{x}-{y}` (Published Language = `.value`)
- `TileCoord` : `(x, y)` entiers
- `Neighbor` : pas de stocks / meshes / deltas Three.js
- Snapshot : `id` + `buildingId` + `tile` + `neighbors: Neighbor[]`

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
- `GetBuildingNeighbors` — read model plat `{ buildingId, type, x, y, isRoad, zone }`

**Ports**
- `BuildingRepository` (+ `deleteById`)
- `SpatialNeighborhoodPort` — découverte grille (adapter : `SceneSpatialNeighborhoodAdapter`)
- `DomainEventPublisher`

Raccourcis composition : `bindSpatialContext`, `getRoadAccess`, `getNeighbors`, `updateNeighbors`, `syncPlacedBuilding`, `syncRemovedBuilding`.

Tick simulation : `createGameRuntime` → system `parcels.roadAccess` (filet `RecalculateAllRoadAccess`).

## Tests

- `roadAccess.behavior.test.js`
- `buildingId.behavior.test.js`
- `neighbors.behavior.test.js`
- `placeRemove.behavior.test.js`

## Hors scope

- Paiement / budget (reste `addHouseAndPay` dans game.js)
- Meshes Three.js / `city.tiles` (scene.js)
- Évolution des maisons, food, emploi
- Liste `markets` en zone (hors Parcels, encore HousesStore)

## Relations (context map)

- **ACL** legacy : `src/js/acl/parcels.js`
- **Composition** : `createParcelsContext.js`
- **Infrastructure** : Dexie / events / spatial / rendu
- **Published Language** voisin persisté : `{ id, name, type, x, y, zone, isRoad }` (`name` = alias de `type`)

Règle : `src/js/**` n'importe jamais `contexts/parcels/domain/**` directement.
