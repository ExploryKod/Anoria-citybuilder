## Classify terrain tiles

See `src/contexts/geography/domain/catalogs/kenneyTerrainTaxonomy.js` for the folder model.

**Level 1:** `fill` (biome reaches hex edges) vs `framed` (bordered by another material → `framed/by_{material}` or `framed/on_empty`).

**Level 2 (under `fill/`):** objects and inner patches — `forest/`, `with-rock/`, `colline/`, `desert/`, `urban/`, `patch/{material}/`, `by_rocks/`, `by_cubes/`, …

There is no `islet/` folder — a patch surrounded by another colour is **framed**.

**Biomes:** `Grass`, `Dirt`, `DarkDirt` (atlas `mars_XX`), `Sand`, `Stone` — each under `PNG/Tiles/Terrain/{Biome}/`.

```text
PNG/Tiles/Terrain/Grass/fill/plain_edges/grass_05.png
PNG/Tiles/Terrain/Dirt/framed/by_stone/thin_stone_edges_on_dirt.png
PNG/Tiles/Terrain/DarkDirt/fill/plain/mars_02.png
PNG/Tiles/Terrain/Sand/framed/by_darkdirt/dirt_waves_edges_on_sand.png
PNG/Tiles/Terrain/Stone/framed/by_dirt/darkdirt_edges_waves_on_stone.png
```

```bash
pnpm classify:kenney-hex
```

Refreshes `kenneyTerrainCatalog.json` from disk. All five biomes are scan-only (catalogs in `*TileCatalog.js`).
