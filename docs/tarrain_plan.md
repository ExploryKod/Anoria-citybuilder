Here’s a **small, ordered plan** that matches your goal: **one Kenney grass tile everywhere**, learn the Three.js rules once, then grow the catalog.

---

## North star for step 1

**Same gameplay grid, same placement, same roads/buildings** — only the **ground mesh** changes from `BoxGeometry` + green material → Kenney `ground_grass.glb` (or `platform_grass` if you prefer a slight raise; start with **`ground_grass`** — flattest).

Do **not** add generation, deposits, or multiple terrains until this step looks correct from your usual camera angles.

---

## Phase 0 — Single-tile spike (half day, de-risks camera)

**Goal:** One `(x,y)` cell with Kenney grass; rest still cubes (or empty). Fix rotation / height / scale before touching the full grid.

1. Pick asset:  
   `public/resources/kenney_nature-kit/Models/GLTF format/ground_grass.glb`
2. Load like city kits (`GLTFLoader` + cache + `clone`) — new tiny `KenneyNatureTerrainAdapter` or reuse loader pattern from `KenneyCityKitLoader.js`.
3. Place at grid `(0,0)` with the same world convention as buildings:  
   - Grid: `position.set(tileX, worldY, tileZ)` with `worldPlatformHeight = 0.2` (same as Kenney buildings).
4. **Calibrate once** (write numbers in a comment or a one-line catalog entry):
   - **Rotation:** often `rotation.y` only for tile variants; village GLB used `-90° X` — Kenney nature may differ; try identity first, then Y.
   - **Vertical offset:** measure bbox after load; top of walkable surface should align with where buildings “sit” (~same as today’s grass top ~0.22 world Y, or align with `KENNEY_CITY_KIT_PLATFORM_HEIGHT`).
   - **Scale:** likely `1` per tile; confirm mesh spans ~1×1 in XZ.
5. **Camera checklist** (your real pitfall list):
   - Tile seams at default zoom (gaps or overlap between neighbors).
   - Z-fighting with world platform GLB at `y = 0.2`.
   - Buildings / ghosts floating or sunk vs new ground.
   - Roads (`y ≈ 0.7` material swap today) — still acceptable visually on Kenney grass?
   - Shadows: `castShadow` / `receiveShadow` on terrain meshes.

**Exit criteria:** 2×2 or 3×3 manual patch of Kenney grass looks continuous; one Kenney building places without obvious float.

---

## Phase 1 — Replace all grass cubes (minimal catalog)

**Goal:** Full map uses Kenney grass; remove green cube path for default terrain.

### 1a. Minimal terrain catalog (one entry)

```text
shared/terrain-catalog/
  terrainCatalog.js          # one frozen entry
  terrainCatalog.json        # optional, or inline for now
```

```ts
"nature:ground_grass": {
  kind: "terrain",
  glb: "/resources/kenney_nature-kit/Models/GLTF format/ground_grass.glb",
  surfaceY: 0,           // baked after Phase 0 — local offset added to world 0.2
  tier: 0,
  tags: ["grass", "flat"],
  fertility: 1,
  spawns: { /* copy today's tree/boulder rules for grass — later */ },
}
```

Map legacy id: `grass` → `nature:ground_grass` in one place (`resolveTerrainId('grass')`).

### 1b. Adapter only does meshes

`KenneyNatureTerrainAdapter.createTerrainTile(terrainId, x, y)` → `Group` at `(x, worldPlatform + surfaceY, y)`.

No placement rules, no Dexie — presentation only.

### 1c. Wire `scene.js` init

Today (~476–482): `assetManager.createAsset(terrainId, x, y)` → cube in `#createTerrain`.

Change to:

- If `terrainCatalog[id].kind === 'terrain'` → adapter.
- Else fallback cube (only for `water` / debug until you add them).

### 1d. Boot order

`AssetLoader`: init terrain adapter before `scene.initialize` (same as `getKenneyCityKitMeshAdapter().initialize()`).

### 1e. Keep `city.tiles[].terrainId`

For this step every tile can stay `'grass'` internally, resolved to Kenney via catalog alias. **No hamlet terrain map yet.**

**Exit criteria:** Full city, no cubes; save/load + roads + farms + Kenney buildings unchanged in behavior; performance acceptable (N tiles = N clones; instancing is later).

---

## Phase 2 — Stabilize “Three.js contract” (document + constants)

**Goal:** Never re-tune blind when adding terrain #2.

Create one small module (facts, not logic):

```text
shared/terrain-catalog/terrainWorldContract.js
  WORLD_PLATFORM_Y = 0.2
  terrainWorldY(catalogEntry) → WORLD_PLATFORM_Y + catalogEntry.surfaceY
  buildingWorldY(tile) → terrainWorldY(resolveTerrainAt(tile))
```

Update in **one pass** (only after grass is correct):

- `KenneyCityKitMeshAdapter` building Y (optional: sample from tile later).
- `placementGhost.js` (`worldPlatformHeight + 0.04`).
- Road height if you move roads to Kenney paths later.

**Exit criteria:** One table in code or README: “grass surface world Y = X; building base = X; ghost = X+0.04”.

---

## Phase 3 — Second terrain type (only after grass is boring)

**Goal:** Prove elevation **without** double-lifting.

Add **one** more entry, e.g. `nature:platform_grass`:

- Different `surfaceY` in catalog (mesh already raised).
- Place a **small 4×4 patch** in data (manual `terrainId` on those tiles) — still no full generator.
- Verify: Kenney house + farm on platform vs on `ground_grass`; footprint policy still “same tier only” (can be hardcoded `tier` 0 vs 1).

**Exit criteria:** Two terrains coexist; buildings align on both; camera still good at map edges.

---

## Phase 4 — Hamlet terrain map + generator (later)

Only when Phases 0–3 are stable:

1. Dexie `hamletTerrain` + hydrate `city.tiles.terrainId`.
2. Generator: seed + fill with `ground_grass`, patches of `platform_grass`, border cliffs.
3. `spawns` on catalog → gate `ResourceManager` (trees/boulders allowed per terrain).

---

## What **not** to do in step 1

| Skip for now | Why |
|--------------|-----|
| 329 Kenney files scanned | One grass + manual second tile later |
| `terrainVariant` / autotile | Single tile type, rotation 0 |
| `hamletTerrain` Dexie | All cells same `grass` |
| Layer 2 catalog split | Keep existing trees/boulders |
| Instancing | Optimize after visual correctness |
| Substrate cube under Kenney | One mesh per cell only |

---

## Kenney vs village rules (reminder for Phase 0)

| | Village GLB | Kenney nature (likely) |
|---|-------------|-------------------------|
| Load path | `village_town_assets_v2.glb` | Per-tile `ground_grass.glb` |
| Building rotation | Parent `-90° X` in places | City kit: `rotation.y` at `y=0.2` |
| Tile anchor | Integer `(x, y)` grid | Same — keep integer grid |
| Height | Cube hack `y = 0.2 - 0.48` | **Catalog `surfaceY` from bbox** |

Bake `surfaceY` once in Phase 0; don’t use `tier * stepHeight` on the mesh.

---

## Suggested file touch list (Phase 1 only)

| File | Change |
|------|--------|
| `shared/terrain-catalog/terrainCatalog.js` | 1 entry + `grass` alias |
| `presentation/three/adapters/kenney-nature-terrain/*` | load + clone + place |
| `presentation/three/meshs/AssetManager.js` | `#createTerrain` delegates to adapter for catalog ids |
| `presentation/dom/boot/AssetLoader.js` | await adapter init |
| `scene.js` | unchanged loop if `createAsset` handles it |

**No** changes yet to `FootprintAvailabilityPolicy`, `ResourceManager`, Dexie.

---

## Order of work (your “begin building” checklist)

1. **Spike** 2×2 Kenney `ground_grass` — fix Y, rotation, seams, camera.  
2. **Catalog** with one id + `grass` alias.  
3. **Adapter** + replace cube for all tiles.  
4. **Document** world Y contract; align ghost/buildings if needed.  
5. **Playtest** roads, farms, Kenney buildings, nature trees on grass.  
6. **Then** add `platform_grass` patch + tier rule.  
7. **Then** persistence + generator + spawn gates.

That keeps the first milestone narrow: **same game, Kenney grass floor, learn the Three.js ground rules once.** When you want this implemented on the test branch, switch to Agent mode and start with Phase 0–1.
