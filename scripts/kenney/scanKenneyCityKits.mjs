// Kenney city kits — scan prefab GLBs and emit runtime catalog + registry.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const KITS = [
  {
    id: 'commercial',
    resourceDir: 'kenney_city-kit-commercial_2.1',
    buildingPattern: /^building(-skyscraper)?-[a-z]\.glb$/,
    gameCategory: 'markets',
    displayPrefix: 'Commerce',
    basePrice: 10,
    pricePerExtraTile: 6,
  },
  {
    id: 'industrial',
    resourceDir: 'kenney_city-kit-industrial_1.0',
    buildingPattern: /^building-[a-t]\.glb$/,
    gameCategory: 'industry',
    displayPrefix: 'Industrie',
    basePrice: 25,
    pricePerExtraTile: 10,
  },
  {
    id: 'suburban',
    resourceDir: 'kenney_city-kit-suburban_20',
    buildingPattern: /^building-type-[a-u]\.glb$/,
    gameCategory: 'houses',
    displayPrefix: 'Maison',
    basePrice: 10,
    pricePerExtraTile: 8,
  },
];

/**
 * @param {string} objPath
 */
function measureFootprintFromObj(objPath) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const text = readFileSync(objPath, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.startsWith('v ')) continue;
    const parts = line.trim().split(/\s+/);
    const x = Number(parts[1]);
    const z = Number(parts[3]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    footprintWidth: Math.max(1, Math.ceil(width - 0.05)),
    footprintDepth: Math.max(1, Math.ceil(depth - 0.05)),
  };
}

/**
 * @param {number} tiles
 * @param {number} basePrice
 * @param {number} pricePerExtraTile
 */
function priceForFootprint(tiles, basePrice, pricePerExtraTile) {
  return basePrice + Math.max(0, tiles - 1) * pricePerExtraTile;
}

const existingCatalogPath = join(repoRoot, 'public/resources/kenney_city_kits_catalog.json');
/** @type {Record<string, { buildings: Record<string, object> }>} */
const existingKits = existsSync(existingCatalogPath)
  ? JSON.parse(readFileSync(existingCatalogPath, 'utf8')).kits ?? {}
  : {};

const kits = {};
/** @type {Record<string, object>} */
const catalogEntries = {};
/** @type {Record<string, string>} */
const prefabByBuildingId = {};
/** @type {Record<string, object>} */
const toolMeta = {};
/** @type {Record<string, string[]>} */
const toolsByCategory = {
  markets: [],
  industry: [],
  houses: [],
};

for (const kit of KITS) {
  const glbDir = join(
    repoRoot,
    'public/resources',
    kit.resourceDir,
    'Models/GLB format'
  );
  const objDir = join(
    repoRoot,
    'public/resources',
    kit.resourceDir,
    'Models/OBJ format'
  );
  const baseUrl = `/resources/${kit.resourceDir}/Models/GLB format`;

  kits[kit.id] = existingKits[kit.id] ?? { displayName: kit.id, baseUrl, buildings: {} };

  const buildingIds = existsSync(glbDir)
    ? readdirSync(glbDir)
        .filter((name) => kit.buildingPattern.test(name))
        .map((name) => name.replace(/\.glb$/, ''))
        .sort()
    : Object.keys(kits[kit.id].buildings ?? {}).sort();

  const buildings = {};
  for (const buildingId of buildingIds) {
    const objPath = join(objDir, `${buildingId}.obj`);
    let footprint;
    if (existsSync(objPath)) {
      footprint = measureFootprintFromObj(objPath);
    } else {
      const existing = kits[kit.id]?.buildings?.[buildingId];
      if (existing) {
        footprint = {
          footprintWidth: existing.footprintWidth,
          footprintDepth: existing.footprintDepth,
        };
      } else {
        footprint = { footprintWidth: 1, footprintDepth: 1 };
        console.warn(`[kenney scan] Missing OBJ for ${kit.id}/${buildingId}, defaulting 1×1`);
      }
    }
    const gridSize = Math.max(footprint.footprintWidth, footprint.footprintDepth);
    const tileCount = footprint.footprintWidth * footprint.footprintDepth;
    const price = priceForFootprint(tileCount, kit.basePrice, kit.pricePerExtraTile);

    buildings[buildingId] = {
      glb: `${baseUrl}/${buildingId}.glb`,
      ...footprint,
      gridSize,
    };

    const gameBuildingId = `Kenney-${kit.id.charAt(0).toUpperCase() + kit.id.slice(1)}-${buildingId}`;
    const prefabKey = `${kit.id}:${buildingId}`;
    const footprintLabel = `${footprint.footprintWidth}×${footprint.footprintDepth}`;

    prefabByBuildingId[gameBuildingId] = prefabKey;
    toolsByCategory[kit.gameCategory].push(gameBuildingId);

    catalogEntries[gameBuildingId] = {
      displayName: `${kit.displayPrefix} — ${buildingId}`,
      construction: {
        price,
        category: kit.gameCategory,
        gridSize,
        footprintWidth: footprint.footprintWidth,
        footprintDepth: footprint.footprintDepth,
      },
    };

    toolMeta[gameBuildingId] = {
      shortLabel: buildingId.replace(/^building-/, '').replace(/^building-type-/, 'type-'),
      tooltip: `Kenney ${kit.id} — ${buildingId} (${footprintLabel}, ${price}€)`,
      previewUrl: `/resources/${kit.resourceDir}/Previews/${buildingId}.png`,
      prefabKey,
      kitId: kit.id,
    };
  }

  kits[kit.id] = {
    displayName: kit.id,
    baseUrl,
    buildings,
  };
}

const catalog = {
  version: 1,
  platformHeight: 0.2,
  kits,
};

const buildingIds = Object.keys(catalogEntries).sort();

const registrySource = `// AUTO-GENERATED by scripts/kenney/scanKenneyCityKits.mjs — do not edit.
// Re-run: pnpm run kenney:scan-city-kits

/** @type {Readonly<Record<string, import('./buildingCatalog.js').BuildingDefinition>>} */
export const KENNEY_BUILDING_CATALOG_ENTRIES = Object.freeze(${JSON.stringify(catalogEntries, null, 2)});

/** @type {ReadonlySet<string>} */
export const KENNEY_CITY_KIT_BUILDING_IDS = new Set(${JSON.stringify(buildingIds)});

/** @type {Readonly<Record<string, string>>} */
export const KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID = Object.freeze(${JSON.stringify(prefabByBuildingId, null, 2)});

/** @type {Readonly<Record<string, {
 *   shortLabel: string,
 *   tooltip: string,
 *   previewUrl: string,
 *   prefabKey: string,
 *   kitId: string,
 * }>>} */
export const KENNEY_CITY_KIT_TOOL_META = Object.freeze(${JSON.stringify(toolMeta, null, 2)});

/** @type {Readonly<Record<'markets' | 'industry' | 'houses', readonly string[]>>} */
export const KENNEY_CITY_KIT_TOOLS_BY_CATEGORY = Object.freeze({
  markets: Object.freeze(${JSON.stringify(toolsByCategory.markets)}),
  industry: Object.freeze(${JSON.stringify(toolsByCategory.industry)}),
  houses: Object.freeze(${JSON.stringify(toolsByCategory.houses)}),
});
`;

const catalogOutPath = join(repoRoot, 'public/resources/kenney_city_kits_catalog.json');
writeFileSync(catalogOutPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const registryOutPath = join(
  repoRoot,
  'src/shared/building-catalog/kenneyCityKitRegistry.generated.js'
);
writeFileSync(registryOutPath, registrySource, 'utf8');

console.log(`Kenney city kits catalog written: ${catalogOutPath}`);
console.log(`Kenney registry written: ${registryOutPath} (${buildingIds.length} buildings)`);
