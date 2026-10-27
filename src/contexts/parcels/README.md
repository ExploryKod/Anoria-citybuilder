# Bounded context : Parcels

Parcellaire : occupation de la grille, voirie et desserte routière.

## Ubiquitous language

| Terme | Définition |
|---|---|
| Bâtiment | Construction placée sur une tuile de la grille |
| Route | Tuile de voirie (`roads`, `Road`, `isRoad`) |
| Portée routière | `roadRange` déclaré au catalogue : distance de Manhattan, mesurée depuis n'importe quelle tuile de l'emprise du bâtiment |
| Accès routier | ≥ 1 route dans la portée |
| Desserte | `roadCount` : le nombre de routes dans la portée |
| Display label | `{type}-{x}-{y}` — UI / logs uniquement (Shared Kernel `toDisplayLabel`) |

## Invariants

- Une route n'a pas besoin d'accès routier
- `roadCount` = nombre de routes à portée du bâtiment (`evaluateRoadAccessByRange`), jamais déduit d'une liste de voisins : la liste des voisins n'existe plus
- **PK Dexie** = `instanceId` (UUID) — Shared Kernel `src/shared/building-identity/`
- `TileCoord` : `(x, y)` entiers
- Snapshot : `id` (UUID) + `buildingId` (VO display, UI only) + `tile` + `roadCount`

## Use cases (application)

**Commands**
- `PlaceBuilding` — après persist : l'accès routier de toute la ville est recalculé
- `RemoveBuilding` — comptes clos (`liquidateBuilding`), `deleteById`, puis l'accès routier de toute la ville est recalculé
- `RecalculateRoadAccessForBuilding`
- `RecalculateAllRoadAccess` — tout le parc en une lecture des bâtiments et une lecture des routes ; appelé aussi chaque jour par le système `parcels.roadAccess`

**Queries (CQRS read)**
- `GetBuildingRoadAccess`

**Ports**
- `BuildingRepository` (+ `deleteById`)
- `DomainEventPublisher`

Raccourcis composition : `getRoadAccess`, `syncPlacedBuilding`, `syncRemovedBuilding`.

Tick simulation : `createGameRuntime` → system `parcels.roadAccess` (`RecalculateAllRoadAccess`).

## Tests

- `roadAccess.behavior.test.js`
- `buildingId.behavior.test.js`
- `houseRecordPolicy.behavior.test.js`
- `placeRemove.behavior.test.js`

## Hors scope

- Paiement / budget (reste `addHouseAndPay` dans game.js)
- Meshes Three.js / `city.tiles` (scene.js)
- Évolution des maisons, food, emploi
- Les bâtiments à portée d'un distributeur : c'est l'approvisionnement (`findBuildingsWithRoleInRange`), pas Parcels

## Infrastructure (adapters)

| Dossier | Rôle |
|---|---|
| `infrastructure/dexie/` | `DexieBuildingRepository` → port `BuildingRepository` |
| `infrastructure/spatial/` | `zoneBordersBuildings` : scan de la grille Three.js que lisent les marcheurs pour trouver la route d'entrée d'un bâtiment |
| `infrastructure/events/` | `InMemoryDomainEventPublisher` → port events |
| `infrastructure/runtime/` | ECS `parcelsRoadAccessSystem` |
| `infrastructure/presentation/` | `roadAccessIcons` (legacy Three.js) |

Les adapters **implémentent** les ports application et **dépendent** du domaine (Clean Architecture).

## Relations (context map)

- **ACL** legacy : `src/js/acl/parcels.js`
- **Infrastructure** : `contexts/parcels/infrastructure/` (adapters Dexie, spatial, events, runtime)
- **Composition** : `createParcelsContext.js`

Règle : `src/js/**` n'importe jamais `contexts/parcels/domain/**` directement.
