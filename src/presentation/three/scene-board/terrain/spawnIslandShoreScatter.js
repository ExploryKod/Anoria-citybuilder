import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { deterministicHash } from '../../../../shared/terrain-catalog/deterministicHash.js';
import { WORLD_PLATFORM_Y } from '../../../../shared/terrain-catalog/terrainWorldContract.js';

const loader = new GLTFLoader();
const KENNEY_GLB_BASE = '/resources/kenney_nature-kit/Models/GLTF format';

/** @type {readonly string[]} */
const SHORE_ROCK_GLBS = Object.freeze([
  'rock_smallFlatA',
  'rock_smallFlatB',
  'rock_smallA',
  'rock_smallC',
  'rock_smallE',
]);

/** @type {Map<string, THREE.Object3D>} */
const rockTemplateCache = new Map();

/**
 * @param {string} glbName
 * @returns {Promise<THREE.Object3D>}
 */
async function loadRockTemplate(glbName) {
  if (rockTemplateCache.has(glbName)) {
    return rockTemplateCache.get(glbName);
  }

  const gltf = await loader.loadAsync(`${KENNEY_GLB_BASE}/${glbName}.glb`);
  const template = gltf.scene;
  template.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const unlit = materials.map((material) => {
        const color = material?.color?.getHex?.() ?? 0xc8d8e0;
        material?.dispose?.();
        return new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          fog: true,
        });
      });
      child.material = unlit.length > 1 ? unlit : unlit[0];
    }
  });
  rockTemplateCache.set(glbName, template);
  return template;
}

/**
 * Scatter small Kenney rocks on coast tiles to break the grid visually.
 *
 * @param {object} params
 * @param {import('../../../../shared/terrain-catalog/islandShoreLayout.js').IslandShoreTileSpec[]} params.tiles
 * @param {number} params.seed
 * @param {import('three').Scene} params.scene
 * @returns {Promise<THREE.Group>}
 */
export async function spawnIslandShoreScatter({ tiles, seed, scene }) {
  const group = new THREE.Group();
  group.name = 'decorative-island-shore';

  const coastTiles = tiles.filter((tile) => tile.role === 'coast');
  if (coastTiles.length === 0) {
    scene.add(group);
    return group;
  }

  await Promise.all(SHORE_ROCK_GLBS.map((name) => loadRockTemplate(name)));

  for (const tile of coastTiles) {
    const h = deterministicHash(tile.x, tile.y, seed + 53);
    if (h % 3 !== 0) continue;

    const glbName = SHORE_ROCK_GLBS[h % SHORE_ROCK_GLBS.length];
    const template = rockTemplateCache.get(glbName);
    if (!template) continue;

    const rock = template.clone(true);
    const offsetX = ((h % 100) / 100 - 0.5) * 0.55;
    const offsetZ = (((h >> 8) % 100) / 100 - 0.5) * 0.55;
    const surfaceY = tile.surfaceY ?? 0;

    rock.rotation.y = (h % 360) * (Math.PI / 180);
    rock.position.set(tile.x + offsetX, WORLD_PLATFORM_Y + surfaceY + 0.02, tile.y + offsetZ);
    rock.userData.isDecorative = true;
    rock.userData.nonInteractive = true;
    rock.name = `shore-rock-${tile.x}-${tile.y}`;
    group.add(rock);
  }

  scene.add(group);
  return group;
}
