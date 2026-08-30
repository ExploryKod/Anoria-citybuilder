# Bug : rupture de couleur herbe Kenney (tuiles vs horizon)

**Date :** 2026-08-30  
**Contexte :** terrain Kenney `ground_grass.glb`, planeau infini (`kenney-ground-fill`), brouillard  
**Statut :** corrigé

---

## Symptômes

- Les tuiles herbe jouables et le sol « impression » autour de la grille n’ont **pas la même teinte**.
- Pipette navigateur typique :
  - **Tuiles 3D** : `#74ECDD` (baseColor embarqué dans le GLB)
  - **Horizon / remplissage infini** : `#36E6C6` (proche du token catalogue `#2FE7C5`)
- Couture visible à la limite du plateau buildable.

---

## Cause

Trois sources de couleur non synchronisées :

| Consommateur | Source avant correctif |
|---|---|
| Mesh tuile Kenney | `material.color` lu depuis le **GLB** (`~#74ecdd`) |
| Plane `kenney-ground-fill` | `KENNEY_GROUND_GRASS_COLOR` (`#2fe7c5`) |
| Brouillard | constante fixe `SCENE_FOG_COLOR` non dérivée |

Le loader convertissait en `MeshBasicMaterial` mais **reprendait la couleur du fichier**, pas la couleur calibrée pour la scène.

---

## Correctif — contrat `displayColor`

**Source unique** : `shared/terrain-catalog/terrainCatalog.js` → `displayColor` par type de terrain, résolu via :

- `resolveTerrainDisplayColorHex(terrainId)` — Three.js
- `resolveTerrainDisplayColorCss(terrainId)` — DOM / canvas 2D
- `applyTerrainDisplayCssVariables()` — variables CSS `--terrain-grass-color`, `--terrain-sky-color`, `--terrain-fog-color`

| Fichier | Changement |
|---|---|
| `terrainCatalog.js` | `displayColor: 0x2fe7c5` sur `nature:ground_grass` |
| `terrainDisplayColor.js` | résolveur catalogue → hex / CSS |
| `KenneyNatureTerrainLoader.js` | **ignore** le baseColor GLB ; applique `displayColor` |
| `BackdropManager.js` | plane infini via résolveur |
| `terrainAtmosphere.js` | `SCENE_FOG_COLOR` = blend herbe + ciel |
| `AssetLoader.js` | injection CSS au boot |
| `villageThumbnailRenderer.js` | placeholder herbe via résolveur |
| `main.css` | fallbacks `--terrain-*` |

**Règle** : ne jamais lire la couleur MTL/GLB Kenney pour l’affichage gameplay ; le GLB ne sert qu’à la **géométrie**.

---

## Ajuster la teinte

Modifier **un seul** champ :

```js
// terrainCatalog.js
'nature:ground_grass': {
  displayColor: 0x2fe7c5, // ← ici
}
```

Tous les consommateurs (tuiles, horizon, fog, CSS) suivent automatiquement.

---

## Test manuel

1. Nouvelle partie, zoom sur le bord du plateau.
2. Pipette sur une tuile herbe **et** sur le sol infini au même éclairage : **même hex** (hors fog).
3. Pas de bande vert clair / vert foncé entre grille et horizon.

## Tests auto

```bash
pnpm test -- tests/shared/terrain-catalog/terrainDisplayColor.test.js
pnpm test -- tests/presentation/three/adapters/kenneyNatureTerrainLoader.test.js
pnpm test -- tests/shared/terrain-catalog/terrainAtmosphere.test.js
```

Voir aussi [`tarrain_plan.md`](../tarrain_plan.md) — section « Contrat couleur herbe ».
