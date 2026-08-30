// Kenney test — scan GLB modules and emit a runtime catalog JSON.

import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const glbDir = join(
  repoRoot,
  'public/resources/kenney_fantasy-town-modular/Models/GLB format'
);
const outPath = join(
  repoRoot,
  'public/resources/kenney_fantasy-town-modular/kenney_modular_catalog.json'
);

const moduleUnit = 1;
const baseUrl = '/resources/kenney_fantasy-town-modular/Models/GLB format';

const moduleIds = readdirSync(glbDir)
  .filter((name) => name.endsWith('.glb'))
  .map((name) => name.replace(/\.glb$/, ''))
  .sort();

const modules = Object.fromEntries(
  moduleIds.map((id) => [
    id,
    {
      glb: `${baseUrl}/${id}.glb`,
      tags: id.split('-'),
    },
  ])
);

const catalog = {
  version: 1,
  moduleUnit,
  textureAtlas: '/resources/kenney_fantasy-town-modular/Models/GLB format/Textures/colormap.png',
  modules,
  buildings: {
    'kenney-house-l1-a-glass': {
      displayName: 'Niveau 1 — Fenêtres verre',
      gridSize: 1,
      moduleHeight: 1,
      parts: [
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 0 },
        { module: 'wall-wood-door', x: 0, y: 0, z: 0, rot: 1 },
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 2 },
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 3 },
        { module: 'roof-point', x: 0, y: 1, z: 0, rot: 0 },
      ],
    },
    'kenney-house-l1-b-shutters': {
      displayName: 'Niveau 1 — Volets',
      gridSize: 1,
      moduleHeight: 1,
      parts: [
        { module: 'wall-wood-window-shutters', x: 0, y: 0, z: 0, rot: 0 },
        { module: 'wall-wood-door', x: 0, y: 0, z: 0, rot: 1 },
        { module: 'wall-wood-window-shutters', x: 0, y: 0, z: 0, rot: 2 },
        { module: 'wall-wood-window-shutters', x: 0, y: 0, z: 0, rot: 3 },
        { module: 'roof-point', x: 0, y: 1, z: 0, rot: 0 },
      ],
    },
    'kenney-house-l1-c-round': {
      displayName: 'Niveau 1 — Oeil-de-bœuf',
      gridSize: 1,
      moduleHeight: 1,
      parts: [
        { module: 'wall-wood-window-small', x: 0, y: 0, z: 0, rot: 0 },
        { module: 'wall-wood-door', x: 0, y: 0, z: 0, rot: 1 },
        { module: 'wall-wood-window-round', x: 0, y: 0, z: 0, rot: 2 },
        { module: 'wall-wood-window-small', x: 0, y: 0, z: 0, rot: 3 },
        { module: 'roof', x: 0, y: 1, z: 0, rot: 0 },
      ],
    },
    // Alias historique du spike initial
    'kenney-house-test-01': {
      displayName: 'Kenney wood house (test)',
      gridSize: 1,
      moduleHeight: 1,
      parts: [
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 0 },
        { module: 'wall-wood-door', x: 0, y: 0, z: 0, rot: 1 },
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 2 },
        { module: 'wall-wood-window-glass', x: 0, y: 0, z: 0, rot: 3 },
        { module: 'roof-point', x: 0, y: 1, z: 0, rot: 0 },
      ],
    },
  },
};

writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Kenney test catalog written: ${outPath} (${moduleIds.length} modules)`);
