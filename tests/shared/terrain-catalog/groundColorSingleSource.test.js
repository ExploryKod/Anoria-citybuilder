/**
 * Guard: the ground grass color has ONE definition (terrainAtmosphere.js).
 * Everything else — tiles, ground plane, fog, CSS tokens, catalogs — must read
 * it, so tuning the look is a one-line edit. A copy-pasted hex anywhere else
 * in src/ fails this test.
 */
import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { KENNEY_GROUND_GRASS_COLOR } from '../../../src/shared/terrain-catalog/terrainAtmosphere.js';

const SRC_DIR = join(process.cwd(), 'src');
const SOURCE_FILE = join('shared', 'terrain-catalog', 'terrainAtmosphere.js');
const EXTENSIONS = new Set(['.js', '.css', '.html']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) {
      yield path;
    }
  }
}

describe('ground grass color — single source', () => {
  const hex = KENNEY_GROUND_GRASS_COLOR.toString(16).padStart(6, '0');
  const pattern = new RegExp(hex, 'i');

  test('the hex value is written nowhere in src/ except its definition', () => {
    const copies = [];
    for (const file of walk(SRC_DIR)) {
      const rel = relative(SRC_DIR, file);
      if (rel === SOURCE_FILE) continue;
      if (pattern.test(readFileSync(file, 'utf8'))) copies.push(rel);
    }
    expect(copies).toEqual([]);
  });
});
