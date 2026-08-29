import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DARK_DIRT_GAMEPLAY_FRAMES,
  DARK_DIRT_TILES,
  indexDarkDirtByCategory,
  parseDarkDirtTilePath,
} from '../src/contexts/geography/domain/catalogs/DarkDirtTileCatalog.js';
import {
  DIRT_GAMEPLAY_FRAMES,
  DIRT_TILES,
  indexDirtByCategory,
  parseDirtTilePath,
} from '../src/contexts/geography/domain/catalogs/DirtTileCatalog.js';
import {
  GRASS_GAMEPLAY_FRAMES,
  GRASS_TILES,
  indexGrassByCategory,
  parseGrassTilePath,
} from '../src/contexts/geography/domain/catalogs/GrassTileCatalog.js';
import {
  indexSandByCategory,
  parseSandTilePath,
  SAND_GAMEPLAY_FRAMES,
  SAND_TILES,
} from '../src/contexts/geography/domain/catalogs/SandTileCatalog.js';
import {
  indexStoneByCategory,
  parseStoneTilePath,
  STONE_GAMEPLAY_FRAMES,
  STONE_TILES,
} from '../src/contexts/geography/domain/catalogs/StoneTileCatalog.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, '..');
const packRoot = join(projectRoot, 'public/resources/kenney_hexagon-pack');
const terrainRoot = join(packRoot, 'PNG/Tiles/Terrain');
const catalogPath = join(
  projectRoot,
  'src/contexts/geography/domain/catalogs/kenneyTerrainCatalog.json'
);

/** All terrain biomes are curated — folder layout on disk is authoritative. */
const CURATED_BIOMES = Object.freeze(['Grass', 'Dirt', 'DarkDirt', 'Sand', 'Stone']);

/** @type {Readonly<Record<string, (path: string) => object | null>>} */
const CURATED_PARSERS = Object.freeze({
  Grass: parseGrassTilePath,
  Dirt: parseDirtTilePath,
  DarkDirt: parseDarkDirtTilePath,
  Sand: parseSandTilePath,
  Stone: parseStoneTilePath,
});

/**
 * Idempotent move into catalog paths when filenames are known but folders drift.
 * @type {Readonly<Record<string, { tiles: object }>>}
 */
const REORGANIZE_BIOMES = Object.freeze({
  Grass: { tiles: GRASS_TILES },
  Dirt: { tiles: DIRT_TILES },
  DarkDirt: { tiles: DARK_DIRT_TILES },
  Sand: { tiles: SAND_TILES },
  Stone: { tiles: STONE_TILES },
});

/**
 * @param {string} dir
 * @param {string[]} [acc]
 */
function walkPngFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkPngFiles(fullPath, acc);
      continue;
    }
    if (entry.toLowerCase().endsWith('.png')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 */
function moveTileFile(sourcePath, targetPath) {
  if (sourcePath === targetPath) return targetPath;
  mkdirSync(dirname(targetPath), { recursive: true });
  renameSync(sourcePath, targetPath);
  return targetPath;
}

/**
 * @param {ReadonlyArray<{ frame: string, role: string }>} entries
 */
function indexByRole(entries) {
  /** @type {Record<string, string[]>} */
  const byRole = {};
  for (const entry of entries) {
    const list = byRole[entry.role] ?? [];
    list.push(entry.frame);
    byRole[entry.role] = list;
  }
  for (const role of Object.keys(byRole)) {
    byRole[role].sort();
  }
  return byRole;
}

/**
 * @param {string} biome
 * @param {string} biomeDir
 * @param {Readonly<Record<string, { category: string, file: string }>>} tiles
 */
function reorganizeCuratedBiome(biome, biomeDir, tiles) {
  if (!existsSync(biomeDir)) return 0;

  let moved = 0;
  for (const filePath of walkPngFiles(biomeDir)) {
    const fileName = basename(filePath);
    const def = tiles[fileName];
    if (!def) {
      throw new Error(`${biome} tile file not recognized: ${fileName}`);
    }

    const targetPath = join(biomeDir, def.category, def.file);
    if (filePath !== targetPath) {
      moveTileFile(filePath, targetPath);
      moved += 1;
    }
  }
  return moved;
}

/**
 * @param {string} biome
 * @param {string} biomeDir
 */
function scanCuratedBiome(biome, biomeDir) {
  const parser = CURATED_PARSERS[biome];
  if (!parser) {
    throw new Error(`No parser for curated biome: ${biome}`);
  }

  return walkPngFiles(biomeDir).map((filePath) => {
    const packPath = relative(packRoot, filePath);
    const parsed = parser(packPath);
    if (!parsed) {
      throw new Error(`Unmapped ${biome} tile — add to catalog: ${packPath}`);
    }
    return parsed;
  });
}

function main() {
  const biomeDirs = readdirSync(terrainRoot).filter((name) => {
    const fullPath = join(terrainRoot, name);
    return statSync(fullPath).isDirectory();
  });

  const unknown = biomeDirs.filter((name) => !CURATED_BIOMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown terrain biome folder(s): ${unknown.join(', ')}`);
  }

  /** @type {Array<object>} */
  const terrain = [];
  let reorganized = 0;

  for (const biome of CURATED_BIOMES) {
    const biomeDir = join(terrainRoot, biome);
    const reorganizeDef = REORGANIZE_BIOMES[biome];
    if (reorganizeDef) {
      reorganized += reorganizeCuratedBiome(biome, biomeDir, reorganizeDef.tiles);
    }
    terrain.push(...scanCuratedBiome(biome, biomeDir));
  }

  terrain.sort((a, b) => a.frame.localeCompare(b.frame));

  const grassEntries = terrain.filter((entry) => entry.biome === 'Grass');
  const dirtEntries = terrain.filter((entry) => entry.biome === 'Dirt');
  const darkDirtEntries = terrain.filter((entry) => entry.biome === 'DarkDirt');
  const sandEntries = terrain.filter((entry) => entry.biome === 'Sand');
  const stoneEntries = terrain.filter((entry) => entry.biome === 'Stone');

  const gameplayFillDefaults = {
    grassland: `${GRASS_GAMEPLAY_FRAMES.grassland}.png`,
    forest: `${GRASS_GAMEPLAY_FRAMES.forest}.png`,
    hill: `${DIRT_GAMEPLAY_FRAMES.hill}.png`,
    coast: `${SAND_GAMEPLAY_FRAMES.coast}.png`,
    desert: `${DARK_DIRT_GAMEPLAY_FRAMES.desert}.png`,
    mountain: `${STONE_GAMEPLAY_FRAMES.mountain}.png`,
  };

  const catalog = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/classifyKenneyHexTiles.js',
    layouts: {
      Grass: 'PNG/Tiles/Terrain/Grass/{category}/{file}.png',
      Dirt: 'PNG/Tiles/Terrain/Dirt/{category}/{file}.png',
      DarkDirt: 'PNG/Tiles/Terrain/DarkDirt/{category}/{file}.png',
      Sand: 'PNG/Tiles/Terrain/Sand/{category}/{file}.png',
      Stone: 'PNG/Tiles/Terrain/Stone/{category}/{file}.png',
    },
    gameplayFillDefaults,
    grass: {
      gameplay: Object.fromEntries(
        Object.entries(GRASS_GAMEPLAY_FRAMES).map(([key, stem]) => [key, `${stem}.png`])
      ),
      byCategory: indexGrassByCategory(grassEntries),
      tiles: grassEntries.sort((a, b) => a.frame.localeCompare(b.frame)),
    },
    dirt: {
      gameplay: Object.fromEntries(
        Object.entries(DIRT_GAMEPLAY_FRAMES).map(([key, stem]) => [key, `${stem}.png`])
      ),
      byCategory: indexDirtByCategory(dirtEntries),
      tiles: dirtEntries.sort((a, b) => a.frame.localeCompare(b.frame)),
    },
    darkDirt: {
      gameplay: Object.fromEntries(
        Object.entries(DARK_DIRT_GAMEPLAY_FRAMES).map(([key, stem]) => [key, `${stem}.png`])
      ),
      byCategory: indexDarkDirtByCategory(darkDirtEntries),
      tiles: darkDirtEntries.sort((a, b) => a.frame.localeCompare(b.frame)),
    },
    sand: {
      gameplay: Object.fromEntries(
        Object.entries(SAND_GAMEPLAY_FRAMES).map(([key, stem]) => [key, `${stem}.png`])
      ),
      byCategory: indexSandByCategory(sandEntries),
      tiles: sandEntries.sort((a, b) => a.frame.localeCompare(b.frame)),
    },
    stone: {
      gameplay: Object.fromEntries(
        Object.entries(STONE_GAMEPLAY_FRAMES).map(([key, stem]) => [key, `${stem}.png`])
      ),
      byCategory: indexStoneByCategory(stoneEntries),
      tiles: stoneEntries.sort((a, b) => a.frame.localeCompare(b.frame)),
    },
    byRole: indexByRole(terrain),
    terrain,
  };

  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  console.log('Kenney terrain catalog updated.');
  console.log(
    `  Tiles: ${terrain.length} (Grass: ${grassEntries.length}, Dirt: ${dirtEntries.length}, DarkDirt: ${darkDirtEntries.length}, Sand: ${sandEntries.length}, Stone: ${stoneEntries.length})`
  );
  if (reorganized > 0) {
    console.log(`  Reorganized: ${reorganized} tile(s) into curated folders`);
  }
  console.log('  By role:', Object.fromEntries(
    Object.entries(catalog.byRole).map(([role, frames]) => [role, frames.length])
  ));
  console.log('  Fill defaults:', gameplayFillDefaults);
  console.log(`  → ${relative(projectRoot, catalogPath)}`);
}

main();
