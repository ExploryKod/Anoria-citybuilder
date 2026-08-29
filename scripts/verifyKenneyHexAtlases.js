import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_GAMEPLAY_SPRITES,
  kenneyFrameName,
} from '../src/contexts/geography/domain/catalogs/HexAssetCatalog.js';

/**
 * @param {string} publicRoot Absolute path to `public/`
 * @param {string} webPath Path from site root, e.g. `/resources/foo.png`
 */
function publicPath(publicRoot, webPath) {
  return join(publicRoot, webPath.replace(/^\//, ''));
}

/**
 * @param {string} xmlText
 * @returns {Set<string>}
 */
function parseAtlasFrameNames(xmlText) {
  const names = new Set();
  const pattern = /name="([^"]+)"/g;
  let match = pattern.exec(xmlText);
  while (match) {
    if (match[1].endsWith('.png')) {
      names.add(match[1]);
    }
    match = pattern.exec(xmlText);
  }
  return names;
}

/**
 * Verify PNG + XML pairs and gameplay frame references (for CI / local dev).
 * @param {string} publicRoot Absolute path to the Vite `public/` directory
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function verifyKenneyHexAtlasFiles(publicRoot) {
  const errors = [];

  for (const [atlasId, atlas] of Object.entries(KENNEY_HEX_ATLASES)) {
    const pngPath = publicPath(publicRoot, atlas.textureUrl);
    const xmlPath = publicPath(publicRoot, atlas.atlasUrl);

    if (!existsSync(pngPath)) {
      errors.push(`Missing PNG for atlas "${atlasId}": ${pngPath}`);
      continue;
    }
    if (!existsSync(xmlPath)) {
      errors.push(`Missing XML for atlas "${atlasId}": ${xmlPath}`);
      continue;
    }

    const xmlText = readFileSync(xmlPath, 'utf8');
    const pngBase = atlas.textureUrl.split('/').pop();
    if (!xmlText.includes(`imagePath="${pngBase}"`)) {
      errors.push(`Atlas "${atlasId}" XML imagePath should reference ${pngBase}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const terrainXml = readFileSync(
    publicPath(publicRoot, KENNEY_HEX_ATLASES.terrain.atlasUrl),
    'utf8'
  );
  const buildingXml = readFileSync(
    publicPath(publicRoot, KENNEY_HEX_ATLASES.buildings.atlasUrl),
    'utf8'
  );
  const terrainFrames = parseAtlasFrameNames(terrainXml);
  const buildingFrames = parseAtlasFrameNames(buildingXml);

  for (const [gameplayKey, sprite] of Object.entries(KENNEY_HEX_GAMEPLAY_SPRITES)) {
    const frame = kenneyFrameName(sprite.frame);
    const pool = sprite.atlas === 'terrain' ? terrainFrames : buildingFrames;
    if (!pool.has(frame)) {
      errors.push(`Gameplay sprite "${gameplayKey}" frame not in ${sprite.atlas} atlas: ${frame}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '../public');
  const result = verifyKenneyHexAtlasFiles(publicRoot);
  if (!result.ok) {
    console.error('[verifyKenneyHexAtlases] FAILED:\n' + result.errors.join('\n'));
    process.exit(1);
  }
  console.log('[verifyKenneyHexAtlases] OK — all Kenney hex atlas files ready for Phaser.');
}
