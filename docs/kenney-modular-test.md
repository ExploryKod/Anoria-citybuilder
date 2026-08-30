# Kenney Fantasy Town — modular 3D spike

Experimental integration of the **Kenney Fantasy Town Kit** (modular GLB pieces) into the Three.js city view. This spike runs **in parallel** with the existing lowpoly village `AssetManager` pipeline — nothing was removed or refactored there.

Catalog format, wall assembly, and recipes: [kenney_modular_catalog.md](./kenney_modular_catalog.md).

All new source files start with a `// Kenney test` header. Touch points in existing files are marked with:

`// Modified at lines … to test kenney fantasy`

---

## Goal

Validate that we can:

1. Load individual Kenney GLB modules (walls, roofs, chimneys…)
2. Compose them from a **data recipe** into one `THREE.Group`
3. Display the result on the city grid without breaking the current asset pipeline

This is a prelude to richer gameplay buildings built from fewer source assets.

---

## Assets on disk

| Path | Role |
|------|------|
| `public/resources/kenney_fantasy-town-modular/Models/GLB format/*.glb` | 167 module meshes (preferred runtime format) |
| `…/GLB format/Textures/colormap.png` | Shared palette atlas (referenced by GLB materials) |
| `…/Models/Textures/variation-a.png` | Alternate palette (not used in this spike) |
| `…/kenney_modular_catalog.json` | Generated manifest + test building recipe |
| `…/Previews/*.png` | Catalog thumbnails only — **not** 3D geometry |

Regenerate the catalog after adding GLBs or editing the test recipe:

```bash
pnpm run kenney:scan-glb
```

---

## New code (all marked `Kenney test`)

| File | Responsibility |
|------|----------------|
| `scripts/kenney/scanKenneyGlbModules.mjs` | Scans GLB folder → writes `kenney_modular_catalog.json` |
| `src/presentation/three/adapters/kenney-test/kenneyTestConfig.js` | Feature flags, URLs, demo spawn coords |
| `src/presentation/three/adapters/kenney-test/KenneyModuleLoader.js` | `GLTFLoader` cache per module id |
| `src/presentation/three/adapters/kenney-test/KenneyBuildingComposer.js` | Recipe → `THREE.Group` |
| `src/presentation/three/adapters/kenney-test/KenneyModularMeshAdapter.js` | Facade for scene + demo spawn |

---

## Modified existing files

| File | Change |
|------|--------|
| `src/presentation/dom/boot/AssetLoader.js` | Calls `getKenneyModularMeshAdapter().initialize()` at boot |
| `src/presentation/three/scene.js` | Routes `Kenney-House-Test` meshes to the new adapter; auto-spawns demo house |
| `src/shared/building-catalog/buildingCatalog.js` | Adds `Kenney-House-Test` (decoration, gridSize 1) |
| `package.json` | Adds `kenney:scan-glb` script |

---

## Runtime behaviour

1. **Boot** — modules for recipe `kenney-house-test-01` are preloaded via `getKenneyModularMeshAdapter().initialize()`.
2. **Scene init** — demo house at tile **(2, 2)** (NW anchor).
3. **Placement** — tiles with `buildingId: 'Kenney-House-Test'` use the Kenney adapter instead of `assetManager.createAsset()`.

### Test recipe (`kenney-house-test-01`)

Demo spawn: **3 maisons L1** en ligne (tiles 2,2 — 4,2 — 6,2, une case vide entre chaque). Voir [kenney_modular_catalog.md](./kenney_modular_catalog.md).

---

## Configuration

`src/presentation/three/adapters/kenney-test/kenneyTestConfig.js` — building id, recipe id, demo spawn tile, catalog URL.

---

## Architecture notes

- **Clean boundary**: Kenney code lives under `presentation/three/adapters/kenney-test/`. Domain `buildingCatalog` only knows static facts (`gridSize`, `price`); mesh composition stays in presentation.
- **No `MeshLoaderOptimized` reuse**: village GLB assumes one monolithic file + `village_town_assets.json`. Kenney uses per-module GLBs + recipes — different adapter by design.
- **Not in tool panel yet**: `Kenney-House-Test` is category `decoration` and is not wired to the build UI. Demo spawn is the primary visual check.

---

## Known limits / next steps

| Limit | Follow-up |
|-------|-----------|
| Demo spawn does not write `city.tiles` | Wire construction BC + tool button when gameplay-ready |
| No ghost preview for Kenney buildings | Extend `placementGhost.js` behind the same port |
| Module pivot / rotation may need tuning | Inspect GLB in viewer; adjust recipe `rot` or add normalizer in loader |
| 167 HTTP requests if all modules loaded | Batch GLB or merge atlas in a build step |
| `variation-a.png` unused | Optional second material variant |
| Previews are 2D only | Use for admin/catalog UI, not runtime meshes |

---

## Removing the spike later

1. Delete `src/presentation/three/adapters/kenney-test/`
2. Revert stamped sections in `scene.js`, `AssetLoader.js`, `buildingCatalog.js`
3. Remove `Kenney-House-Test` from catalog and docs

Or evolve the adapter into a permanent `BuildingMeshPort` implementation once the modular approach is validated.
