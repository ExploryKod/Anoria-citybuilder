# Kenney Hexagon Pack — Phaser

## Credit

**[Hexagon Pack](https://kenney.nl/assets/hexagon-pack)** by [Kenney](https://www.kenney.nl) (Kenney Vleugels) — [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).  
Also credited on the in-game [Credits](/credits) page (`/credits`).

## Spritesheets

| Atlas | Phaser texture key | Files |
|-------|-------------------|--------|
| Terrain | `kenney-hex-terrain` | `hexagonTerrain_sheet.png` + `.xml` |
| Buildings | `kenney-hex-buildings` | `hexagonBuildings_sheet.png` + `.xml` |
| Objects | `kenney-hex-objects` | `hexagonObjects_sheet.png` + `.xml` |
| All (dev only) | `kenney-hex-all` | `hexagonAll_sheet.png` + `.xml` |

XML `imagePath` matches the PNG filename in this repo (required for some tools; Phaser uses the URL passed to `atlasXML`).

## Phaser preload

```js
import { loadKenneyHexAtlases } from '@/presentation/phaser/shared/loadKenneyHexAtlases.js';
import { resolveKenneyPhaserFrame } from '@/contexts/geography/domain/catalogs/HexAssetCatalog.js';

function preload() {
  loadKenneyHexAtlases(this.load);
}

function create() {
  const { textureKey, frame } = resolveKenneyPhaserFrame('grassland');
  this.add.image(400, 300, textureKey, frame);
}
```

## Gameplay frame keys

See `src/contexts/geography/domain/catalogs/HexAssetCatalog.js` → `KENNEY_HEX_GAMEPLAY_SPRITES`.

**Note:** this terrain set has no dedicated ocean hex — use a blue background and land tiles only, or tint `stone_01` for water in a later pass.

## Verify assets

```bash
pnpm test -- tests/contexts/geography/kenneyHexAtlas.test.js
node scripts/verifyKenneyHexAtlases.js
```

## Tile metrics (pointy-top)

- Frame size: **120 × 140** px  
- Default hex radius for layout: **70** (`KENNEY_HEX_DEFAULT_RADIUS`)
