# Shared Kernel — Building identity

**Source de vérité unique** pour les identifiants de bâtiments, transverse à tous les bounded contexts.

## Published Language

```
{type}-{x}-{y}
```

Exemples : `House-Blue-3-7`, `Farm-Wheat-5-5`, `roads-2-4`

## Modules

| Module | Rôle |
|---|---|
| `TileCoord.js` | Coordonnées grille (entiers) |
| `BuildingId.js` | VO, parse, create, `resolvePublishedBuildingIdFromRef` |
| `BuildingRecord.js` | `canonicalizeHouseRecord` (write), `publishedIdFromHouseRow` (read) |

## Règles Dexie (`houses` table)

| Champ | Sémantique |
|---|---|
| `id` | Published Language (canonique) |
| `name` | Clé Dexie — **toujours égale à `id`** après écriture |
| `type` | Type seul (`House-Purple`, pas l'id complet) |
| `x`, `y` | Tuile |

## Qui importe quoi

```
src/shared/building-identity/     ← source de vérité
    ↑
    ├── contexts/parcels/         (re-exports compat)
    ├── contexts/supply/
    ├── contexts/employment/
    ├── contexts/parcels/infrastructure/
    ├── contexts/supply/infrastructure/
    └── contexts/employment/infrastructure/
    └── src/js/acl/building-identity.js  (legacy UI / stores)
```

**Legacy `src/js/**`** : importer uniquement via `src/js/acl/building-identity.js`.

**Bounded contexts & infrastructure** : importer directement depuis `src/shared/building-identity/`.

## API principale

```js
// Création
toBuildingIdString('House-Blue', 3, 7)  // → 'House-Blue-3-7'

// Écriture Dexie
canonicalizeHouseRecord({ name: 'House-Blue-3-7', type: 'House-Blue', ... })

// Lecture Dexie / legacy blob
publishedIdFromHouseRow(houseRow)
resolvePublishedBuildingIdFromRef(neighborBlob)

// Normalisation pour commandes BC
toPublishedBuildingId(buildingId)
```

## Tests

`tests/shared/building-identity/` — contrat du Shared Kernel.

Les tests sous `tests/contexts/parcels/buildingId.*` restent en re-export du même contrat.
