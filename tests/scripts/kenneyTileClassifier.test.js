import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  DARK_DIRT_ATLAS_FRAME_BY_FILE,
  DARK_DIRT_GAMEPLAY_FRAMES,
  parseDarkDirtTilePath,
} from '../../src/contexts/geography/domain/catalogs/DarkDirtTileCatalog.js';
import {
  DIRT_ATLAS_FRAME_BY_FILE,
  DIRT_GAMEPLAY_FRAMES,
  parseDirtTilePath,
} from '../../src/contexts/geography/domain/catalogs/DirtTileCatalog.js';
import {
  GRASS_GAMEPLAY_FRAMES,
  parseGrassTilePath,
} from '../../src/contexts/geography/domain/catalogs/GrassTileCatalog.js';
import {
  parseSandTilePath,
  SAND_ATLAS_FRAME_BY_FILE,
  SAND_GAMEPLAY_FRAMES,
} from '../../src/contexts/geography/domain/catalogs/SandTileCatalog.js';
import {
  parseStoneTilePath,
  STONE_ATLAS_FRAME_BY_FILE,
  STONE_GAMEPLAY_FRAMES,
} from '../../src/contexts/geography/domain/catalogs/StoneTileCatalog.js';
import {
  applyManualOverride,
  classifyKenneyTerrainTile,
  pickDefaultFillFrames,
} from '../../scripts/lib/kenneyTileClassifier.js';
import terrainCatalog from '../../src/contexts/geography/domain/catalogs/kenneyTerrainCatalog.json' with { type: 'json' };

const packRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/resources/kenney_hexagon-pack'
);

/**
 * @param {string} stem
 */
function readTerrainPng(stem) {
  const entry = terrainCatalog.terrain.find((item) => item.stem === stem);
  if (!entry) {
    throw new Error(`No catalog entry for ${stem}`);
  }
  const buffer = readFileSync(join(packRoot, entry.path));
  return PNG.sync.read(buffer);
}

describe('DirtTileCatalog', () => {
  test('parses folder layout and maps descriptive files to atlas frames', () => {
    const fill = parseDirtTilePath(
      'PNG/Tiles/Terrain/Dirt/fill/plain_edges/plain_dirt_fill_06.png'
    );
    expect(fill).toMatchObject({
      id: 'plain_dirt_fill_06',
      frame: 'dirt_06.png',
      file: 'plain_dirt_fill_06.png',
      category: 'fill/plain_edges',
      role: 'fill',
    });

    const framed = parseDirtTilePath(
      'PNG/Tiles/Terrain/Dirt/framed/by_grass/thin_grass_edges_on_dirt.png'
    );
    expect(framed).toMatchObject({
      frame: 'dirt_07.png',
      category: 'framed/by_grass',
      role: 'framed',
    });

    const root = parseDirtTilePath(
      'PNG/Tiles/Terrain/Dirt/framed/by_empty/thin_darkdirt_edge_on_empty.png'
    );
    expect(root).toMatchObject({
      frame: 'dirt_01.png',
      category: 'framed/by_empty',
    });
  });

  test('every on-disk dirt file is mapped to an atlas frame', () => {
    expect(Object.keys(DIRT_ATLAS_FRAME_BY_FILE)).toHaveLength(19);
    expect(terrainCatalog.dirt.tiles).toHaveLength(19);
    expect(terrainCatalog.dirt.gameplay.hill).toBe('dirt_06.png');
    expect(terrainCatalog.dirt.byCategory['fill/forest/few']).toContain('sparse_pines_on_dirt_11.png');
  });
});

describe('SandTileCatalog', () => {
  test('parses curated folder paths and maps descriptive files to atlas frames', () => {
    const fill = parseSandTilePath(
      'PNG/Tiles/Terrain/Sand/fill/plain_edges/plain_sand_fill.png'
    );
    expect(fill).toMatchObject({
      frame: 'sand_02.png',
      file: 'plain_sand_fill.png',
      category: 'fill/plain_edges',
      role: 'fill',
    });

    const cacti = parseSandTilePath(
      'PNG/Tiles/Terrain/Sand/fill/desert/cacti/numerous/five_cacti_on_sand.png'
    );
    expect(cacti).toMatchObject({
      frame: 'sand_14.png',
      category: 'fill/desert/cacti/numerous',
      role: 'prop',
    });
  });

  test('every on-disk sand file is mapped', () => {
    expect(Object.keys(SAND_ATLAS_FRAME_BY_FILE)).toHaveLength(21);
    expect(terrainCatalog.sand.tiles).toHaveLength(21);
    expect(terrainCatalog.sand.gameplay.coast).toBe('sand_02.png');
  });
});

describe('DarkDirtTileCatalog', () => {
  test('parses curated folder paths and maps descriptive files to atlas frames', () => {
    const fill = parseDarkDirtTilePath(
      'PNG/Tiles/Terrain/DarkDirt/fill/plain/mars_02.png'
    );
    expect(fill).toMatchObject({
      frame: 'mars_02.png',
      category: 'fill/plain',
      role: 'fill',
    });

    const framed = parseDarkDirtTilePath(
      'PNG/Tiles/Terrain/DarkDirt/framed/on_empty/mars_01.png'
    );
    expect(framed).toMatchObject({
      frame: 'mars_01.png',
      category: 'framed/on_empty',
      role: 'framed',
    });
  });

  test('every on-disk dark dirt file is mapped', () => {
    expect(Object.keys(DARK_DIRT_ATLAS_FRAME_BY_FILE)).toHaveLength(16);
    expect(terrainCatalog.darkDirt.tiles).toHaveLength(16);
    expect(terrainCatalog.darkDirt.gameplay.desert).toBe('mars_06.png');
  });
});

describe('StoneTileCatalog', () => {
  test('parses curated folder paths and maps descriptive files to atlas frames', () => {
    const fill = parseStoneTilePath(
      'PNG/Tiles/Terrain/Stone/fill/plain/plain_stone_fill.png'
    );
    expect(fill).toMatchObject({
      frame: 'stone_02.png',
      file: 'plain_stone_fill.png',
      category: 'fill/plain',
      role: 'fill',
    });

    const fountain = parseStoneTilePath(
      'PNG/Tiles/Terrain/Stone/fill/urban/fountain/fountain_on_stone.png'
    );
    expect(fountain).toMatchObject({
      frame: 'stone_16.png',
      category: 'fill/urban/fountain',
      role: 'prop',
    });
  });

  test('every on-disk stone file is mapped', () => {
    expect(Object.keys(STONE_ATLAS_FRAME_BY_FILE)).toHaveLength(17);
    expect(terrainCatalog.stone.tiles).toHaveLength(17);
    expect(terrainCatalog.stone.gameplay.mountain).toBe('stone_02.png');
  });
});

describe('GrassTileCatalog', () => {
  test('parses curated folder paths', () => {
    const parsed = parseGrassTilePath('PNG/Tiles/Terrain/Grass/fill/plain_edges/grass_05.png');
    expect(parsed).toMatchObject({
      stem: 'grass_05',
      category: 'fill/plain_edges',
      role: 'fill',
    });
  });

  test('catalog grass section matches on-disk layout', () => {
    expect(terrainCatalog.grass.tiles).toHaveLength(22);
    expect(terrainCatalog.grass.gameplay.grassland).toBe('grass_05.png');
  });
});

describe('kenneyTileClassifier', () => {
  test('classifies known fill tiles for auto biomes', () => {
    for (const stem of ['sand_02', 'stone_02']) {
      const png = readTerrainPng(stem);
      expect(classifyKenneyTerrainTile(png.data, png.width, png.height, stem)).toBe('fill');
    }
  });

  test('dirt hill tile uses curated layout', () => {
    const hill = terrainCatalog.dirt.tiles.find((t) => t.frame === 'dirt_06.png');
    expect(hill?.category).toBe('fill/plain_edges');
    expect(hill?.file).toBe('plain_dirt_fill_06.png');
  });

  test('manual overrides win over heuristics', () => {
    expect(applyManualOverride('sand_01', 'framed')).toBe('islet');
  });

  test('pickDefaultFillFrames has no auto-classified biomes left', () => {
    const autoEntries = terrainCatalog.terrain.filter(
      (entry) => !['Grass', 'Dirt', 'DarkDirt', 'Sand', 'Stone'].includes(entry.biome)
    );
    expect(autoEntries).toHaveLength(0);
    const defaults = pickDefaultFillFrames(autoEntries);
    expect(defaults.coast).toBeNull();
    expect(defaults.desert).toBeNull();
  });
});

describe('kenneyTerrainCatalog', () => {
  test('gameplay fill defaults reference valid tiles', () => {
    const { gameplayFillDefaults } = terrainCatalog;
    expect(gameplayFillDefaults.grassland).toBe(`${GRASS_GAMEPLAY_FRAMES.grassland}.png`);
    expect(gameplayFillDefaults.forest).toBe(`${GRASS_GAMEPLAY_FRAMES.forest}.png`);
    expect(gameplayFillDefaults.hill).toBe(`${DIRT_GAMEPLAY_FRAMES.hill}.png`);
    expect(gameplayFillDefaults.coast).toBe(`${SAND_GAMEPLAY_FRAMES.coast}.png`);
    expect(gameplayFillDefaults.mountain).toBe(`${STONE_GAMEPLAY_FRAMES.mountain}.png`);
    expect(gameplayFillDefaults.desert).toBe(`${DARK_DIRT_GAMEPLAY_FRAMES.desert}.png`);

    const hill = terrainCatalog.dirt.tiles.find((t) => t.frame === gameplayFillDefaults.hill);
    expect(hill?.category).toBe('fill/plain_edges');
  });

  test('byRole index matches terrain entries', () => {
    const fromIndex = Object.values(terrainCatalog.byRole).flat().sort();
    const fromTerrain = terrainCatalog.terrain.map((entry) => entry.frame).sort();
    expect(fromIndex).toEqual(fromTerrain);
  });
});
