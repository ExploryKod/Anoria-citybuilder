/**
 * Guard: every GLB URL a catalog entry declares (roads, nature, farm fields)
 * must exist under public/ — a typo would only surface as a runtime 404.
 */
import { describe, expect, test } from '@jest/globals';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BUILDING_ASSETS } from '../../../src/presentation/three/assets/buildingAssets.js';
import { NATURE_ASSETS } from '../../../src/presentation/three/assets/natureAssets.js';
import { WALKER_ASSETS } from '../../../src/presentation/three/assets/walkerAssets.js';

const PUBLIC_DIR = join(process.cwd(), 'public');
const GLB_SOURCES = new Set(['kenneyGlb', 'kenneyFarmField']);

/** @returns {Array<{ id: string, url: string }>} */
function declaredGlbUrls() {
  const urls = [];
  for (const [id, entry] of Object.entries({ ...BUILDING_ASSETS, ...NATURE_ASSETS })) {
    if (!GLB_SOURCES.has(entry.source)) continue;
    if (entry.geometry?.glb) urls.push({ id, url: entry.geometry.glb });
    if (entry.crop?.glb) urls.push({ id, url: entry.crop.glb });
    for (const stage of Object.values(entry.crop?.stages ?? {})) {
      if (stage?.glb) urls.push({ id, url: stage.glb });
    }
  }
  for (const [id, asset] of Object.entries(WALKER_ASSETS)) {
    urls.push({ id, url: asset.geometry.glb });
  }
  return urls;
}

describe('catalog GLB files', () => {
  const declared = declaredGlbUrls();

  test('there are declared GLBs to check', () => {
    expect(declared.length).toBeGreaterThan(10);
  });

  test.each(declared.map(({ id, url }) => [id, url]))('%s → %s exists in public/', (_id, url) => {
    expect(url.startsWith('/')).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, url))).toBe(true);
  });

  test('walker GLBs have their shared texture next to them (referenced relatively)', () => {
    for (const asset of Object.values(WALKER_ASSETS)) {
      const folder = asset.geometry.glb.slice(0, asset.geometry.glb.lastIndexOf('/'));
      expect(existsSync(join(PUBLIC_DIR, folder, 'Textures', 'colormap.png'))).toBe(true);
    }
  });
});
