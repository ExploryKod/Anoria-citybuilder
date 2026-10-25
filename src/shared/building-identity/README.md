# Shared Kernel — Building identity

**Source de vérité unique** pour les identifiants de bâtiments, transverse à tous les bounded contexts.

## Clés vs labels

| Concept | Format | Usage |
|---|---|---|
| **instanceId** (PK Dexie) | UUID v4 | `getHouse`, `updateHouseFields`, events ECS, repos BC |
| **Display label** | `{type}-{x}-{y}` | UI, logs uniquement — **jamais** comme clé Dexie |

## API principale

```js
// PK
createBuildingInstanceId()
instanceIdFromHouseRow(houseRow)
resolveBuildingInstanceIdFromRef(rowOrUuidString)

// Bâtiment à portée / scan grille
resolveInstanceIdFromBuildingRef(buildingRef)

// UI only
toDisplayLabel('House-Blue', 3, 7)
displayLabelFromHouseRow(houseRow)
```

## Règle d'or

**Tout accès Dexie et toute référence à un bâtiment → `instanceId` UUID.** Les coordonnées servent aux calculs spatiaux, pas à identifier un bâtiment.
