# Bug : fantôme de placement ne suit pas la souris (Kenney + terrain)

**Date :** 2026-08-30  
**Contexte :** intégration terrain Kenney (`ground_grass.glb`), `SceneTilePort`, frustum culling par zone  
**Statut :** corrigé

---

## Vue d’ensemble

Après le remplacement des tuiles herbe par des meshes Kenney (`Group` + GLB), le **fantôme de placement** (preview semi-transparente) ne suivait plus correctement la souris, alors que le **clic** plaçait toujours le bâtiment au bon endroit.

| # | Symptôme joueur | Cause courte |
|---|---|---|
| A | Le fantôme reste figé ; le bâtiment se pose sous le curseur | `placementGhost.show()` ne repositionnait pas les meshes **Kenney** quand seule la tuile `(x, y)` changeait |
| B | Pas de fantôme / impossible de construire sur certaines zones | Frustum culling masquait des `zoneGroup` (`visible = false`) → le raycast Three.js ignorait le terrain |
| C | Fantôme en retard sur le curseur (sensation de lag) | Le focus tuile était mis à jour chaque frame, mais le fantôme ne se synchronisait que sur `mousemove` |

Voir aussi [`tarrain_plan.md`](../tarrain_plan.md) (Phase 0–1 : alignement ghost / terrain / caméra).

---

## A — Fantôme Kenney figé (cause principale rapportée)

### Symptômes

- Outil bâtiment Kenney actif : la preview **ne bouge pas** quand on déplace la souris.
- Clic gauche : le bâtiment apparaît **à la position du curseur** (logique placement OK).
- Bâtiments **legacy** (non Kenney) : le fantôme suivait normalement.

### Cause racine

Dans `placementGhost.js`, la méthode `show()` optimise les mises à jour : si l’asset, la validité et la taille de grille sont inchangés, elle **déplace** le mesh existant au lieu de le recréer.

Pour les assets legacy, `setTilePosition()` était appelé. Pour les assets Kenney (`isKenneyBuildingId`), ce repositionnement était **volontairement sauté** (le mesh était créé une seule fois via `createBuilding()` asynchrone). Seuls `lastX` / `lastY` internes étaient mis à jour — pas la position Three.js du fantôme.

```text
sync(focusedObject)  →  ghost.show(assetId, x, y, …)  →  lastX/lastY mis à jour
                                                      ↳ mesh Kenney : position inchangée
placement au clic     →  utilise focusedObject.userData.x/y (correct)
```

### Correction

| Fichier | Changement |
|---|---|
| `placementGhost.js` | `setKenneyTilePosition()` + `repositionGhost()` : même logique de centre / footprint / rotation que `KenneyCityKitMeshAdapter.createBuilding()` |
| `placementGhost.js` | `show()` appelle `repositionGhost()` pour **tous** les assets quand seule la tuile change |
| `tests/presentation/three/placementGhost.test.js` | non-régression : déplacement Kenney sans respawn du mesh |

---

## B — Zones mortes (pick / fantôme absent)

### Symptômes

- Sur certaines parties de la carte : pas de tuile sous le curseur, fantôme effacé, placement impossible.
- Zones variables selon la position de la caméra.

### Cause

`PerformanceManager.updateFrustumCulling()` met `zoneGroup.visible = false` pour les zones hors frustum.  
`raycaster.intersectObjects()` **ignore** les objets dont un ancêtre a `visible === false`.

Les tuiles Kenney sont des `THREE.Group` dans ces zones ; le culling rendait le pick impossible même si la zone était encore « jouable » à l’écran (boîtes de bounds très plates, seuil caméra, etc.).

### Correction

| Fichier | Changement |
|---|---|
| `scene-board/tileRaycast.js` | `pickTileFromRaycast` : raycast direct sur les meshes pickables, **sans** tenir compte de la visibilité des parents |
| `PerformanceManager.js` | hauteur minimale des AABB de zone pour le frustum (évite de cacher trop tôt le terrain plat) |
| `tests/presentation/three/tileRaycast.test.js` | pick sur mesh dans un `zoneGroup` invisible |

Le frustum culling reste actif pour le **rendu** ; seul le **pick** contourne `visible`.

---

## C — Synchronisation fantôme / focus (fluidité)

### Symptômes

- Fantôme qui « traîne » derrière la souris à déplacement rapide.
- Décalage perceptible entre tuile focus et preview.

### Cause

- `updateFocusedObject()` tourne dans la boucle `draw()` (60 fps, position souris via `inputManager`).
- `placementGhostSession.sync()` n’était appelé que depuis `onMouseMove` (événements moins fréquents que les frames).

### Correction

| Fichier | Changement |
|---|---|
| `scene.js` | après `updateFocusedObject()` dans `draw()`, appeler `onPlacementHoverHandler(focusedObject)` chaque frame |

---

## Fichiers touchés (récap)

```text
src/presentation/three/placementGhost.js
src/presentation/three/scene.js
src/presentation/three/scene-board/tileRaycast.js
src/presentation/three/managers/PerformanceManager.js
tests/presentation/three/placementGhost.test.js
tests/presentation/three/tileRaycast.test.js
tests/presentation/three/managers/PerformanceManager.test.js
```

---

## Non-régression / pièges

1. **Nouveau bâtiment Kenney** : vérifier que le fantôme suit la souris **sans** recharger le GLB à chaque tuile (reposition in-place, respawn seulement si asset / validité / rotation / grille changent).
2. **Footprint multi-tuiles** : `setKenneyTilePosition` doit utiliser `footprintWidth` / `footprintHeight` et `rotationStep` comme l’adapter (swap largeur/profondeur si rotation impaire).
3. **Mode ancré (touch)** : `placementGhostSession.sync` retourne toujours si `ghost.anchored` — ne pas casser le flux rotation mobile.
4. **`suppressGhostAtFootprint`** : après un placement, le fantôme reste masqué sur la tuile posée jusqu’à sortie du footprint — comportement voulu.
5. **Frustum vs pick** : ne pas réintroduire `intersectObjects(roots, true)` pour le pick terrain sans ignorer `visible`, sinon réapparition des zones mortes.
6. **Hauteur Y** : fantôme Kenney = `KENNEY_CITY_KIT_PLATFORM_HEIGHT + 0.04` (aligné `mountGhost` après `createBuilding`).

---

## Test manuel

1. Sélectionner un **bâtiment Kenney** (catalogue city kit).
2. Déplacer la souris sur toute la carte : le fantôme **suit tuile par tuile**, vert/rouge selon validité.
3. Cliquer : le bâtiment apparaît **sous le curseur**, pas là où le fantôme était resté bloqué.
4. Panoramiquer la caméra vers les bords du plateau : pas de bandes sans fantôme sur l’herbe visible.
5. Déplacement rapide de la souris : pas de retard visible entre curseur et preview.
6. (Optionnel) Bâtiment legacy 1×1 : même fluidité qu’avant.

---

## Test automatisé

```bash
pnpm test -- tests/presentation/three/placementGhost.test.js
pnpm test -- tests/presentation/three/tileRaycast.test.js
pnpm test -- tests/presentation/three/managers/PerformanceManager.test.js
```
