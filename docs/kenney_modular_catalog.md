# Kenney modular catalog

Reference for `public/resources/kenney_fantasy-town-modular/kenney_modular_catalog.json` — the data file that lists Kenney GLB modules and **building recipes** composed at runtime by `KenneyBuildingComposer.js`.

Related: integration spike notes in [kenney-modular-test.md](./kenney-modular-test.md).

---

## Files

| File | Role |
|------|------|
| `kenney_modular_catalog.json` | Runtime catalog (modules + recipes) — loaded by the game |
| `scripts/kenney/scanKenneyGlbModules.mjs` | Source of truth for recipes; regenerates the JSON |
| `Models/GLB format/*.glb` | 167 individual module meshes |
| `Models/GLB format/Textures/colormap.png` | Shared palette atlas |

Regenerate after editing recipes or adding GLBs:

```bash
pnpm run kenney:scan-glb
```

---

## JSON structure

```json
{
  "version": 1,
  "moduleUnit": 1,
  "textureAtlas": "/resources/kenney_fantasy-town-modular/Models/GLB format/Textures/colormap.png",
  "modules": {
    "wall-wood": {
      "glb": "/resources/kenney_fantasy-town-modular/Models/GLB format/wall-wood.glb",
      "tags": ["wall", "wood"]
    }
  },
  "buildings": {
    "kenney-house-test-01": {
      "displayName": "Kenney wood house (test)",
      "gridSize": 1,
      "moduleHeight": 1,
      "parts": [ … ]
    }
  }
}
```

| Field | Meaning |
|-------|---------|
| `moduleUnit` | One Kenney grid step in world units (matches Anoria: **1 tile = 1 unit**) |
| `moduleHeight` | Vertical step between floors (`y` in parts × this value) |
| `modules` | Id → GLB URL (auto-filled by scan script) |
| `buildings` | Recipe id → list of parts + footprint `gridSize` |

### Part entry

```json
{ "module": "wall-wood", "x": 0, "y": 0, "z": 0, "rot": 0 }
```

| Field | Meaning |
|-------|---------|
| `module` | Key in `modules` |
| `x`, `z` | Position in **recipe-local** grid (before building `gridSize` centering) |
| `y` | Floor index (0 = ground) |
| `rot` | Quarter-turn on Y: `0`–`3` (= 0°, 90°, 180°, 270°) |

At runtime, `KenneyBuildingComposer` places the group at the city tile anchor, offsets by `(gridSize - 1) / 2` so multi-tile footprints stay centered, and sets `y` to `KENNEY_WORLD_PLATFORM_HEIGHT` (0.2).

---

## Module anatomy (important)

Kenney **wall** pieces are not full 1×1×1 blocks. Measured on `wall-wood.obj`:

| Dimension | Size |
|-----------|------|
| Thickness | ~0.1 m |
| Height | 1.0 m |
| Width along wall | 1.0 m |

Default orientation (`rot: 0`): the panel sits on **one edge** of the 1×1 cell (thin along X, spans Z).

Implications:

- Putting one `wall-wood` per **different** tile does **not** form a closed room — you get four separate panels with gaps at the corners.
- To close a 1×1 room with straight walls only: stack **four** `wall-wood` on the **same** `(x, y, z)` with `rot` 0–3 (one panel per face).
- Use `wall-wood-corner` (full 1×1 corner piece) when you need proper exterior corners on larger footprints.
- `roof-flat` is a ~1×1 slab; `roof-point` is a 1×1 hip/pyramid roof (used in the test recipe). Place at `y: 1` on the same `(x, z)` as the wall ring.

---

## Validated test recipe: `kenney-house-l1-a-glass`

Minimal closed box — **3× fenêtres verre + porte + `roof-point`**, footprint **1×1**. (Alias : `kenney-house-test-01`.)

## Niveau 1 — showcase (`KENNEY_L1_SHOWCASE`)

Trois recettes alignées sur **z = 2**, espacement **2** (1 case vide entre chaque maison 1×1) :

| Recipe | Tile (x, z) | Variante |
|--------|-------------|----------|
| `kenney-house-l1-a-glass` | 2, 2 | Fenêtres verre + `roof-point` |
| `kenney-house-l1-b-shutters` | 4, 2 | Volets + `roof-point` |
| `kenney-house-l1-c-round` | 6, 2 | Petite fenêtre + ronde + toit `roof` |

```
     window (rot 3, north)
              │
   window ────┼──── window
  (rot 2)     │     (rot 0)
              │
        door (rot 1, south)

  roof-point @ y = 1
```

```json
"parts": [
  { "module": "wall-wood-window-glass", "x": 0, "y": 0, "z": 0, "rot": 0 },
  { "module": "wall-wood-door", "x": 0, "y": 0, "z": 0, "rot": 1 },
  { "module": "wall-wood-window-glass", "x": 0, "y": 0, "z": 0, "rot": 2 },
  { "module": "wall-wood-window-glass", "x": 0, "y": 0, "z": 0, "rot": 3 },
  { "module": "roof-point", "x": 0, "y": 1, "z": 0, "rot": 0 }
]
```

Wired in game as building id `Kenney-House-Test` (`KENNEY_DEMO_RECIPE_ID` in `kenneyTestConfig.js`). Demo spawn: tile **(2, 2)**.

### Rotation map (door + windows variant)

Same layout as plain walls; swap module id per face. Door on south (`rot: 1`) uses `wall-wood-door` (built-in door + transom). Other faces use `wall-wood-window-glass`.

---

## Growing beyond 1×1

For larger rooms, combine:

1. **Straight runs** — one `wall-wood` per tile along each side (same `rot` on that side).
2. **Corners** — `wall-wood-corner` at junctions (or `wall-corner` for stone).
3. **Roof** — multiple `roof-gable` / `roof-flat` tiles, or wider pieces (`roof-left` + `roof-right` + `roof-gable-end`).

Always check previews in `Previews/<module-id>.png` or `Overview.html` before adding a part to a recipe.

---

## Editing workflow

1. Change the `buildings` section in `scripts/kenney/scanKenneyGlbModules.mjs` (recipes are authored there, not by hand-editing the big JSON).
2. Run `pnpm run kenney:scan-glb`.
3. Hard-refresh the game (catalog is fetched at runtime; browser may cache JSON).

Module list in JSON is overwritten by the scan script; only `buildings` in the script file is the stable edit point today.

---

## Textures

- Runtime GLBs use **`colormap.png`** under `Models/GLB format/Textures/`.
- `Models/Textures/variation-a.png` is an alternate palette (not used in the current spike).
- `Previews/*.png` are catalog thumbnails only — not geometry.
