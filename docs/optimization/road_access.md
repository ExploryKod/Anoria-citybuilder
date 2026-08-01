# Optimisation : accès routier (Parcels)

## Contexte

L'accès routier d'un bâtiment = **nombre de routes adjacentes** (`roadCount`) et dérivé `hasAccess` (`roadCount > 0`).

Ce n'est pas une propriété intrinsèque du bâtiment : elle dépend de ses **voisins**. Quand une route est posée ou retirée, ce sont les bâtiments autour qui changent, pas la route elle-même.

```
[Avant]  Maison — herbe — Maison
[Après]  Maison — Route — Maison
         ↑ roadCount +1    ↑ roadCount +1
```

## Use cases actuels

| Use case | Fichier | Rôle |
|---|---|---|
| `RecalculateAllRoadAccess` | `contexts/parcels/application/commands/RecalculateAllRoadAccess.js` | Recalcule **tous** les bâtiments |
| `RecalculateRoadAccessForBuilding` | `contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js` | Recalcule **un** bâtiment |

Appel tick : pipeline ECS `parcels.roadAccess` via `createGameRuntime` / `game.update()` (ex-`RoadConnectivityService`).

## À quoi sert le recalcul « toute la ville » ?

Synchroniser le champ `roads` en IndexedDB avec l'état réel de la grille pour **chaque bâtiment**.

Usages gameplay qui en dépendent :

- évolution des maisons (accès routier requis)
- panneau info (« routes desservies »)
- icônes 3D (`no-road`)
- marchés, moulins (même logique de desserte)

## Approche actuelle

```
Chaque tour de simulation :
  listAllHouses()
  pour chaque bâtiment (hors routes) :
    roadCount = compter voisins route
    si roadCount ≠ house.roads → updateHouseFields()
```

**Avantages :** simple, robuste, pas besoin de tracer les dépendances entre tuiles.

**Inconvénients :** O(n) bâtiments à chaque tick, même si rien n'a changé.

À l'échelle actuelle d'Anoria (grille 16×16, quelques centaines de bâtiments max), le coût est négligeable : la règle métier est une simple boucle sur les voisins.

## Pistes d'optimisation

### 1. Recalcul ciblé (recommandé en premier)

Ne recalculer que les bâtiments **impactés** par une action :

| Action | Bâtiments à recalculer |
|---|---|
| Pose / destruction d'une **route** | Voisins de la tuile (4–8 bâtiments max) |
| Pose / destruction d'un **bâtiment** | Le bâtiment + ses voisins |
| Mise à jour des `neighbors` | Bâtiments dont la liste a changé |

Use case existant : `RecalculateRoadAccessForBuilding`.

Use case ciblé :

```
RecalculateRoadAccessForNeighbors(buildingIds[])
  → appelle RecalculateRoadAccessForBuilding pour chaque id unique
```

Orchestration actions joueur :

- `PlaceBuilding` / `RemoveBuilding` (via `parcels.syncPlacedBuilding` / `syncRemovedBuilding`)
- Port `SpatialNeighborhoodPort` + adapter scène Three.js
- Filet : `RecalculateAllRoadAccess` au tick via ECS (`parcels.roadAccess`)

## Stratégie de migration

```
Phase 1 (en place)
  └─ placement / bulldoze → PlaceBuilding / RemoveBuilding (voisins + road ciblé)
  └─ recalcul global au tour (sécurité)

Phase 2 — Réduire le global
  └─ recalcul global → chargement + resync périodique
  └─ tick → uniquement entités Dirty (ECS)

Phase 3 — Mesure
  └─ profiler si n > 1000 bâtiments
```

## Règle métier (inchangée par l'optimisation)

La policy `RoadAccessPolicy.evaluate(neighbors)` reste la source de vérité. Seul **quand** et **sur qui** on l'appelle change — pas la règle elle-même.

## Fichiers liés

- Domaine : `src/contexts/parcels/domain/policies/RoadAccessPolicy.js`
- Legacy (deprecated) : `src/js/game/services/RoadConnectivityService.js`
- Composition : `src/composition/createParcelsContext.js`, `createGameRuntime.js`
- Spatial : `src/contexts/parcels/infrastructure/spatial/SceneSpatialNeighborhoodAdapter.js`
- Runtime ECS : `src/contexts/parcels/infrastructure/runtime/parcelsRoadAccessSystem.js`
- Rendu icônes : `src/contexts/parcels/infrastructure/presentation/roadAccessIcons.js`

## Migration legacy (terminée)

| Ancien | Nouveau |
|---|---|
| `checkRoadAccess(neighbors)` | `evaluateRoadAccess` (domaine) ou `hasRoadAccessFromCount(roads)` |
| `RoadAccessModule` | **supprimé** — remplacer par use cases Parcels + ACL |
| `ModuleHelper.checkRoadAccess` | **supprimé** |
| `makeDbItemId(type, x, y)` | `toBuildingIdString(type, x, y)` (`BuildingId`) |
| Panneau info | `parcels.getRoadAccess` / `parcels.getNeighbors` |
| Icônes 3D | `setupRoadAccessIcons` + bus `RoadAccessChanged` |
| `userData.neighbors` (UI) | query Parcels ; meshes hover = `userData.neighborsMeshs` |
