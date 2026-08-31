// Bakes Kenney nature-kit GLB bounding boxes for editor stack placement heights.

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const glbDir = join(repoRoot, 'public/resources/kenney_nature-kit/Models/GLTF format');
const outPath = join(repoRoot, 'src/shared/editor-catalog/kenneyPlacementProfiles.generated.js');

const loader = new GLTFLoader();
const box = new THREE.Box3();

/** @type {Record<string, { bboxMinY: number, bboxMaxY: number }>} */
const profiles = {};

const glbNames = readdirSync(glbDir)
  .filter((name) => name.endsWith('.glb'))
  .map((name) => name.replace(/\.glb$/, ''))
  .sort((a, b) => a.localeCompare(b));

for (const glbName of glbNames) {
  const glbPath = join(glbDir, `${glbName}.glb`);
  try {
    const buf = readFileSync(glbPath);
    const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), `${glbDir}/`);
    box.setFromObject(gltf.scene);
    profiles[glbName] = {
      bboxMinY: Number(box.min.y.toFixed(4)),
      bboxMaxY: Number(box.max.y.toFixed(4)),
    };
  } catch (error) {
    console.warn(`[scan] skip ${glbName}:`, error.message);
    profiles[glbName] = { bboxMinY: -0.05, bboxMaxY: -0.05 };
  }
}

const file = `/**
 * AUTO-GENERATED — run \`pnpm kenney:scan-placement-profiles\` after adding Kenney GLBs.
 * Local-space Y bounds used for editor stack elevation (feet on surface → top of mesh).
 */
/* eslint-disable max-lines */

/** @type {Readonly<Record<string, { bboxMinY: number, bboxMaxY: number }>>} */
export const KENNEY_PLACEMENT_PROFILES = Object.freeze(${JSON.stringify(profiles, null, 2)});
`;

writeFileSync(outPath, file, 'utf8');
console.log(`Wrote ${glbNames.length} placement profiles → ${outPath}`);
