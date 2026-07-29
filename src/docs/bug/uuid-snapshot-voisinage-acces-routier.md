# Bug : voisinage et accès routier cassés après migration UUID

**Date :** 2026-07-29  
**Contexte :** refactor identité bâtiments (`instanceId` UUID v4, PK Dexie)  
**Statut :** corrigé

---

## Symptômes observés

Après la migration vers les UUID :

- Les maisons adjacentes à des routes affichent **« Maison isolée »** dans le panneau info (`neighbors.length === 0`).
- **Routes desservies : 0** alors qu’une route est visible à côté.
- Icône **no-road** persistante au-dessus des maisons.
- Pas d’arrivée de population, pas d’évolution Blue → Red (conséquence : `house.roads` reste à 0).
- Même comportement pour marchés, fermes, etc. dépendants de l’accès routier.

Le scan spatial (grille Three.js) voyait bien les routes ; le problème était **en aval**, à la persistance Dexie.

---

## Cause racine

### Confusion entre deux identifiants

| Identifiant | Rôle |
|---|---|
| `instanceId` (UUID) | **Clé primaire Dexie** — immuable |
| `{type}-{x}-{y}` | **Label d’affichage** uniquement (`toDisplayLabel`) |

### Bug dans `createBuildingSnapshot`

Fichier : `src/contexts/parcels/domain/BuildingSnapshot.js`

Quand Dexie chargeait une maison avec un UUID :

```javascript
// Entrée Dexie
{ instanceId: "a1b2c3d4-e5f6-4789-a012-3456789abcde", type: "House-Blue", x: 8, y: 10 }
```

Le snapshot **remplaçait** l’id persisté par le label dérivé :

```javascript
// Snapshot (bugué)
{ id: "House-Blue-8-10", ... }  // ← plus l’UUID !
```

### Chaîne d’échec silencieux

1. `UpdateNeighborsForBuilding.execute(UUID)` → `findById(UUID)` → **OK** (lecture Dexie).
2. `saveNeighbors(building.id, neighbors)` → écrit sous `"House-Blue-8-10"`.
3. `HousesStore.updateHouseFields("House-Blue-8-10", …)` → `db.houses.get("House-Blue-8-10")` → **undefined**.
4. `updateHouseFields` retourne sans erreur (`if (!house) return;`).
5. `neighbors` et `roads` **jamais mis à jour** en base.

Même mécanisme pour `saveRoadAccess` → `house.roads` bloqué à 0.

### Bug secondaire (événements icônes)

`RecalculateRoadAccessForBuilding` publiait `RoadAccessChanged` avec :

```javascript
buildingId: building.buildingId ?? building.id  // label legacy en priorité
```

Or `setupRoadAccessIcons` enregistre les vues sous l’**UUID** (`syncRoadAccess({ buildingId: instanceId })`).  
Les événements ne matchaient pas → icônes non rafraîchies même après correction partielle.

---

## Correction

### 1. `BuildingSnapshot` — conserver l’UUID comme `id`

```javascript
const persistedId = isBuildingInstanceId(id)
  ? id
  : (buildingId?.value ?? id);
```

- **UUID** → `snapshot.id` = UUID (clé Dexie).
- **Legacy** `House-Blue-3-7` → comportement inchangé (rétrocompat tests).
- `buildingId` (VO `{type}-{x}-{y}`) reste disponible pour tuile / affichage.

### 2. Événements Parcels — publier `building.id`

Fichiers :

- `RecalculateRoadAccessForBuilding.js`
- `RecalculateAllRoadAccess.js`
- `UpdateNeighborsForBuilding.js`

→ `buildingId: building.id` (UUID quand la ligne vient de Dexie).

### 3. Ajustements pipeline scene / game (symptômes associés)

Non causés par le bug UUID, mais nécessaires pour un feedback immédiat à la pose :

- Sync `instanceId` mesh ← `city.tiles` avant scan voisins.
- 2e passe voisins après placement de tous les meshes.
- `game.update` : `scene.update` → ECS → `scene.update` (voisins avant road access + evolution).
- Après pose bâtiment/route : idem (scene → simulation → scene).

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `contexts/parcels/domain/BuildingSnapshot.js` | Fix `persistedId` UUID |
| `contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js` | Event `building.id` |
| `contexts/parcels/application/commands/RecalculateAllRoadAccess.js` | Event `building.id` |
| `contexts/parcels/application/commands/UpdateNeighborsForBuilding.js` | Event `building.id` |
| `contexts/parcels/domain/value-objects/Neighbor.js` | Détection `StonePath-*` |
| `js/utils/utils.js` | `isRoad` + fallback `city.tiles.instanceId` dans scan |
| `js/game/scene.js` | Pipeline voisins / icônes |
| `js/game/game.js` | Ordre scene / ECS |

---

## Tests ajoutés

- `tests/contexts/parcels/buildingId.behavior.test.js` — snapshot conserve UUID.
- `tests/contexts/parcels/neighbors.behavior.test.js` — persistance voisins sous UUID.

---

## Prévention

1. **Ne jamais utiliser `{type}-{x}-{y}` comme clé Dexie** après migration UUID.
2. Dans les BC, **`snapshot.id` = PK persistée** ; le label display vit dans `buildingId` / `toDisplayLabel`.
3. Les commandes Parcels doivent appeler `saveNeighbors(building.id, …)` où `building.id` est l’UUID issu du repository.
4. Les événements UI (icônes) doivent utiliser le même identifiant que `syncRoadAccess` / `game.js` (`instanceId`).

---

## Vérification manuelle

1. Poser une maison, puis une route adjacente (StonePath ou `roads`).
2. Ouvrir le panneau info : **Voisins immédiats** listés, **Routes desservies ≥ 1**.
3. Icône no-road disparue.
4. Après croissance pop (tick + accès routier) : evolution Blue → Red si `pop > 0`.

---

## Références

- Shared Kernel : `src/shared/building-identity/README.md`
- Identité Parcels : `src/contexts/parcels/docs/identity.md`
- Accès routier : `docs/optimization/road_access.md`
