# Optimisation : accès routier (Urban)

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
| `RecalculateAllRoadAccess` | `contexts/urban/application/commands/RecalculateAllRoadAccess.js` | Recalcule **tous** les bâtiments |
| `RecalculateRoadAccessForBuilding` | `contexts/urban/application/commands/RecalculateRoadAccessForBuilding.js` | Recalcule **un** bâtiment |

Appel legacy : `RoadConnectivityService` délègue à `RecalculateAllRoadAccess` à chaque tour (`game.update()`).

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

Nouveau use case possible :

```
RecalculateRoadAccessForNeighbors(tileX, tileY)
  → résout les buildingId des tuiles adjacentes
  → appelle RecalculateRoadAccessForBuilding pour chacun
```

### 2. Flag « dirty » (ECS / runtime)

Marquer les entités dont l'accès routier est potentiellement obsolète :

```
Composant Dirty { roadAccess: true }
```

- Pose route → marquer `Dirty` sur les entités voisines
- `roadAccessSystem` → ne traite que `query(Dirty, Neighbors)`
- Après traitement → `Dirty.roadAccess = false`

Réduit le travail au tick sans perdre le recalcul global occasionnel.

### 3. Recalcul global en filet de sécurité

Garder `RecalculateAllRoadAccess` mais moins souvent :

- au chargement de partie
- toutes les N tours (ex. tous les 10 tours)
- après une opération bulk (import sauvegarde, reset ville)

Évite les dérives silencieuses si un chemin de code oublie le recalcul ciblé.

### 4. Skip si inchangé (déjà en place)

Les deux use cases ne persistent que si `roadCount` a changé. Pas d'écriture IndexedDB inutile.

Amélioration possible : skip **avant** le calcul si `neighbors` n'a pas changé depuis le dernier recalcul (hash ou version sur le snapshot).

## Stratégie de migration suggérée

```
Phase actuelle (OK)
  └─ RecalculateAllRoadAccess à chaque tour

Phase 1 — Actions joueur
  └─ placement route/bâtiment → RecalculateRoadAccessForNeighbors
  └─ garder le recalcul global au tour (sécurité)

Phase 2 — Réduire le global
  └─ recalcul global → chargement + resync périodique
  └─ tick → uniquement entités Dirty (ECS)

Phase 3 — Mesure
  └─ profiler si n > 1000 bâtiments (villes plus grandes)
```

## Règle métier (inchangée par l'optimisation)

La policy `RoadAccessPolicy.evaluate(neighbors)` reste la source de vérité. Seul **quand** et **sur qui** on l'appelle change — pas la règle elle-même.

## Fichiers liés

- Domaine : `src/contexts/urban/domain/policies/RoadAccessPolicy.js`
- Legacy : `src/js/game/services/RoadConnectivityService.js`
- Composition : `src/composition/createUrbanContext.js`
- Rendu icônes : `src/infrastructure/roadAccessIcons.js`

## Migration legacy (terminée)

| Ancien | Nouveau |
|---|---|
| `checkRoadAccess(neighbors)` | `evaluateRoadAccess` (domaine) ou `hasRoadAccessFromCount(roads)` |
| `RoadAccessModule` | supprimé |
| `ModuleHelper.checkRoadAccess` | supprimé |
| `makeDbItemId(type, x, y)` | `toBuildingIdString(type, x, y)` (`BuildingId`) |
| Panneau info | `urban.getRoadAccess(buildingId)` |
| Icônes 3D | `setupRoadAccessIcons` + bus `RoadAccessChanged` |
