# Bounded context : Urban

Urbanisme, voirie, voisinage et desserte routière des bâtiments.

## Ubiquitous language

| Terme | Définition |
|---|---|
| Bâtiment | Construction placée sur une tuile de la grille |
| Route | Tuile de voirie (`roads`, `Road`, `isRoad`) |
| Voisin | Bâtiment ou terrain adjacent |
| Accès routier | Le bâtiment a ≥ 1 voisin route |
| Desserte | Nombre de routes adjacentes (`roadCount`) |

## Invariants

- Une route n'a pas besoin d'accès routier
- `roadCount` = nombre de voisins identifiés comme routes
- Identifiant métier : `{type}-{x}-{y}` (ex. `House-Blue-3-7`) — VO `BuildingId`, string `.value` en Published Language
- Tuile : VO `TileCoord` `(x, y)` entiers
- Snapshot Urban : `id` (string) + `buildingId` (VO) + `tile` (VO)

## Use cases (application)

- `RecalculateRoadAccessForBuilding` — recalcule l'accès routier d'un bâtiment
- `RecalculateAllRoadAccess` — recalcule pour toute la ville
- `GetBuildingRoadAccess` — lecture pour l'UI (query)

## Tests

Comportement métier (sociable, use cases / contrats) :

- `tests/contexts/urban/roadAccess.behavior.test.js` — desserte routière
- `tests/contexts/urban/buildingId.behavior.test.js` — identifiants / tuiles

Les tests décrivent des **scénarios**, pas une classe du domaine par fichier. Refactoriser `RoadAccessPolicy` ou les value objects ne doit pas casser ces tests tant que le comportement observable reste identique.

## Hors scope

- Évolution des maisons
- Distribution alimentaire
- Emploi

## Relations (context map)

- **ACL** vers `src/js/` (legacy POO) — `makeDbItemId` supprimé, call sites → `toBuildingIdString`
- **Published Language** : `buildingId: string` (`House-Blue-3-7`)
