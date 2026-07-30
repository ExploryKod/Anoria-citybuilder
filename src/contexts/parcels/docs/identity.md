# Building identity — canonical (Shared Kernel)

> **Source de vérité :** [`src/shared/building-identity/README.md`](../../../shared/building-identity/README.md)

Les slices A–F documentées ici sont implémentées dans le Shared Kernel.

| Slice | Statut |
|---|---|
| Shared Kernel `src/shared/building-identity/` | ✅ |
| ACL legacy `src/js/acl/building-identity.js` | ✅ |
| HousesStore writes via `canonicalizeHouseRecord` | ✅ |
| Dexie repos via `instanceIdFromHouseRow` | ✅ |
| Supply shim `resolveBuildingId.js` | ✅ supprimé |
| Parcels re-exports (compat) | ✅ |

Parcels `domain/value-objects/BuildingId.js` et `HouseRecordPolicy.js` ne sont plus que des re-exports.

## API Parcels

Tous les use cases / ports / events utilisent **`instanceId`** (UUID) comme clé — jamais `{type}-{x}-{y}`.
