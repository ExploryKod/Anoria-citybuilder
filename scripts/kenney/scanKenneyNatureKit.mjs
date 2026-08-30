// Kenney nature-kit — scan GLBs and emit editor manifest (Isometric NE previews, flat Models folder).

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyKenneyGlbName,
  humanizeKenneyGlbName,
  kenneyGlbToToolId,
  KENNEY_EDITOR_CATEGORY_DEFS,
} from '../../src/shared/editor-catalog/classifyKenneyNatureAsset.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const glbDir = join(repoRoot, 'public/resources/kenney_nature-kit/Models/GLTF format');
const outPath = join(repoRoot, 'src/shared/editor-catalog/kenneyNatureKitManifest.generated.js');

const glbNames = readdirSync(glbDir)
  .filter((name) => name.endsWith('.glb'))
  .map((name) => name.replace(/\.glb$/, ''))
  .sort((a, b) => a.localeCompare(b));

/** @type {Array<{ glbName: string, categoryId: string, layer: string, toolId: string, shortLabel: string }>} */
const assets = glbNames.map((glbName) => {
  const { categoryId, layer } = classifyKenneyGlbName(glbName);
  return {
    glbName,
    categoryId,
    layer,
    toolId: kenneyGlbToToolId(layer, glbName),
    shortLabel: humanizeKenneyGlbName(glbName),
  };
});

const terrainCount = assets.filter((entry) => entry.layer === 'terrain').length;
const propCount = assets.filter((entry) => entry.layer === 'prop').length;

const file = `/**
 * AUTO-GENERATED — run \`pnpm kenney:scan-nature-kit\` after adding Kenney nature GLBs.
 * Side / Isometric folders are 2D previews only; all 3D meshes live in Models/GLTF format.
 */
/* eslint-disable max-lines */

export const KENNEY_NATURE_KIT_GLB_COUNT = ${glbNames.length};

export const KENNEY_NATURE_EDITOR_CATEGORY_DEFS = ${JSON.stringify(KENNEY_EDITOR_CATEGORY_DEFS, null, 2)};

/** @type {ReadonlyArray<{ glbName: string, categoryId: string, layer: 'terrain' | 'prop', toolId: string, shortLabel: string }>} */
export const KENNEY_NATURE_ASSETS = Object.freeze(${JSON.stringify(assets, null, 2)});

export const KENNEY_NATURE_TERRAIN_COUNT = ${terrainCount};
export const KENNEY_NATURE_PROP_COUNT = ${propCount};
`;

writeFileSync(outPath, file, 'utf8');
console.log(`Wrote ${assets.length} assets (${terrainCount} terrain, ${propCount} props) → ${outPath}`);
