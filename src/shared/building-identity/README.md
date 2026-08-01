# Shared Kernel — Building identity

**Source de vérité unique** pour les identifiants de bâtiments, transverse à tous les bounded contexts.

## Clés vs labels

| Concept | Format | Usage |
|---|---|---|
| **instanceId** (PK Dexie) | UUID v4 | `getHouse`, `updateHouseFields`, voisins, events ECS, repos BC |
| **Display label** | `{type}-{x}-{y}` | UI, logs uniquement — **jamais** comme clé Dexie |

## Voisins persistés (`neighbors[]`)

Chaque entrée :

```js
{
  instanceId: 'uuid-v4',   // référence au bâtiment voisin
  type: 'Farm-Wheat',      // label asset (filtres, isRoad)
  x: 4, y: 7,              // tuile (calculs spatiaux)
  zone: 1,
  isRoad: false,
}
```

Pas de fallback `type-x-y` : un voisin sans UUID est ignoré à la normalisation.

## API principale

```js
// PK
createBuildingInstanceId()
instanceIdFromHouseRow(houseRow)
resolveBuildingInstanceIdFromRef(rowOrUuidString)

// Voisins / scan grille
resolveInstanceIdFromNeighborRef(neighborBlob)

// UI only
toDisplayLabel('House-Blue', 3, 7)
displayLabelFromHouseRow(houseRow)
```

## Règle d'or

**Tout accès Dexie et toute référence voisin → `instanceId` UUID.** Les coordonnées servent aux calculs spatiaux, pas à identifier un bâtiment.
