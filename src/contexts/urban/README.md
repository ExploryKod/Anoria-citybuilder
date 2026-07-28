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
- Identifiant métier : `{type}-{x}-{y}` (ex. `House-Blue-3-7`)

## Use cases (application)

- `RecalculateRoadAccessForBuilding` — recalcule l'accès routier d'un bâtiment
- `RecalculateAllRoadAccess` — recalcule pour toute la ville
- `GetBuildingRoadAccess` — lecture pour l'UI (query)

## Hors scope

- Évolution des maisons
- Distribution alimentaire
- Emploi

## Relations (context map)

- **ACL** vers `src/js/` (legacy POO)
- **Published Language** (futur) vers Economy : `buildingId: string`
