# Bug : placement maison, ConstraintError Dexie, commerce moulin, flash bulldoze

**Date :** 2026-08-01  
**Branche :** `refactor/on-ecs-ddd--stores-dependencies`  
**Commit :** `6e884a4` — `fix(game): stabiliser placement Dexie, trésorerie et bulldoze`  
**Statut :** corrigé

---

## Vue d’ensemble

Plusieurs symptômes liés à IndexedDB / `city.tiles` / DTO commerce, apparus après le refactor Construction / Accounting / identité UUID. Tous corrigés dans le même lot.

| # | Symptôme joueur | Cause courte |
|---|---|---|
| A | Impossible de poser une maison ; `ConstraintError` / « bâtiment déjà là » sur herbe vide | Course `budget.add` / fantômes d’ancre Dexie ; message UI trompeur |
| B | Erreurs console commerce moulin (`BuildingInstanceId: invalid "undefined"`) | DTO moulin sans `instanceId` / `id` |
| C | Flash d’une maison / sprite juste après bulldoze | `scene.update` ressuscite depuis Dexie une tuile déjà vidée |

Voir aussi l’entrée ouverte dans [`bug.history.accounting.md`](./bug.history.accounting.md) (premier placement) — partiellement liée aux races trésorerie (A).

---

## A — Placement maison + ConstraintError

### Symptômes

- Clic outil habitation sur herbe **sans** arbre / pierre visible → échec.
- Console :

```text
ConstraintError: Key already exists in the object store.
[game.js] Building placement failed: DexieError2 …
```

- Popup orange : *« Un bâtiment existe déjà à cet emplacement »* alors que la tuile est libre.
- Persiste parfois **après** vidage cache + suppression IndexedDB (donc pas seulement des données stale).
- Peut « se remettre à marcher » sans changement de code (bug intermittent de course).

### Causes

#### 1. Race trésorerie (`budget_current`)

`GetTreasurySnapshot` appelait `InitializeTreasury` quand la ligne manquait.  
`InitializeTreasury` faisait `clear` + `budget.add('budget_current')`.

Deux appels concurrents (boot `forceReinitialize` + `scene.update` / placement) → second `add` → **ConstraintError**.

Le `catch` de `game.js` traitait **tout** `ConstraintError` comme `building_already_exists` → message trompeur.

#### 2. Index d’ancre + lignes fantômes

Schéma Dexie :

```text
houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]'
```

Des lignes nature (arbres / rochers) ou placements ratés pouvaient rester en base alors que `city.tiles` montrait de l’herbe → conflit à l’insert / rejet « duplicate ».

#### 3. Bootstrap Dexie

Ancien `db.delete()` async au chargement (prod) → courses schéma / écritures. Remplacé par ouverture unique (`waitForDatabaseReady`).

### Corrections

| Zone | Changement |
|---|---|
| `DexieTreasuryRepository.createInitialBudgetRow` | `put` au lieu de `add` |
| `GetTreasurySnapshot` | ensure-only (`clearExisting: false`) |
| `InitializeTreasury` | option `clearExisting` (force reset vs ensure) |
| `DexieGameSessionRepository.addGameItems` | `put` (plus de clear+add concurrent) |
| `scene.update` | file d’attente sérialisée |
| `DexieConstructionBuildingRepository` | lookup ancre, `put` + reclaim occupant stale |
| `ReclaimStaleBuildingRecords` | purge Dexie sur tuiles `city.tiles` vides **avant** placement |
| `game.js` | reclaim avant paiement ; message `persistence_conflict` pour ConstraintError générique |
| Tests | `treasuryInitRace.behavior.test.js`, reclaim / ancre dans construction |

---

## B — Commerce moulin : `instanceId` undefined

### Symptômes

```text
[CommerceService] Error adding to windmill stock for wood:
Error: BuildingInstanceId: invalid "undefined"
  at instanceIdFromHouseRow …
  at WindmillStockOperations.addToStock / resetImportsDisplay
```

Tour commerce (`RunCommerceTurn`) en boucle tant qu’un moulin commercialisable existe.

### Cause

`ListWindmillSupplyViews` exposait un DTO avec seulement `buildingId` / `name`.  
`WindmillStockOperations` appelait `instanceIdFromHouseRow(windmill)` qui lit `instanceId ?? id` → **undefined**.

### Corrections

| Zone | Changement |
|---|---|
| `ListWindmillSupplyViews` | ajoute `instanceId` + `id` (= `view.id`) |
| `WindmillStockOperations` | `resolveWindmillInstanceId` (fallback `buildingId`) ; skip si invalide |

---

## C — Flash de maison après bulldoze

### Symptômes

- Suppression d’une ou deux maisons.
- Pendant une fraction de frame : maison ou sprite **réapparaît** sans clic.
- Visible même à vitesse de jeu basse.
- Ne se produisait pas avant la sérialisation de `scene.update` (qui a rendu la fenêtre de course plus nette).

### Cause

Ordre bulldoze dans `game.js` :

1. Vide `city.tiles[x][y].buildingId` / `instanceId`
2. `await scene.update(...)`

Pendant un `scene.update` (y compris un tick déjà en cours) :

1. Mesh encore présent + ligne encore en Dexie
2. `findBuildingAtTile` **réécrit** `instanceId` sur la tuile vide
3. `syncResidentialHouseMeshFromDb` / Housing **réécrit** `buildingId` et peut `createAsset` → **flash**
4. Branche bulldoze / orphelin supprime enfin le mesh

`city.tiles` est la source de vérité placement ; Dexie ne doit pas ressusciter une tuile volontairement vidée.

### Corrections

| Zone | Changement |
|---|---|
| `game.js` bulldoze | `parcels.syncRemovedBuilding` **immédiat** après clear tuiles (avant `scene.update`) |
| `scene.js` | pas de backfill Dexie / Housing si `!tileBuildingId` |
| `syncResidentialHouseMeshFromDb` | ne réécrit pas `city.tiles` si la tuile n’a plus de `buildingId` |

---

## Fichiers principaux

```
src/core/persistence/dexie/db.js
src/contexts/accounting/.../DexieTreasuryRepository.js
src/contexts/accounting/.../InitializeTreasury.js
src/contexts/accounting/.../GetTreasurySnapshot.js
src/contexts/construction/.../DexieConstructionBuildingRepository.js
src/contexts/construction/.../ReclaimStaleBuildingRecords.js
src/contexts/construction/.../PlaceBuildingWithPayment.js
src/contexts/supply/.../ListWindmillSupplyViews.js
src/contexts/commerce/.../WindmillStockOperations.js
src/presentation/three/game.js
src/presentation/three/scene.js
src/presentation/three/managers/ResourceManager.js
```

---

## Vérification manuelle

1. Hard refresh (Ctrl+Shift+R) après déploiement.
2. Nouvelle partie → poser Maison Bleue sur herbe libre → OK, pas de ConstraintError.
3. Poser un moulin commercialisable → imports commerce sans spam console `instanceId`.
4. Bulldoze 1–2 maisons à vitesse lente → pas de flash de mesh / sprite.
5. Console : plus de `Key already exists` au placement nominal.

---

## Notes

- `Orientation toast element not found` et `Unknown property type workshop` : bruit hors scope (DOM / assets).
- Le message joueur « bâtiment déjà là » ne doit plus être utilisé pour un `ConstraintError` générique (utiliser `persistence_conflict`).
