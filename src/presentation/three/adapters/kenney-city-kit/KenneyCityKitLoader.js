// Kenney city kits — loads and caches prefab GLB buildings.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
/** @type {Map<string, THREE.Object3D>} */
const templateCache = new Map();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const loadingCache = new Map();

/**
 * @param {string} prefabKey
 * @param {string} glbUrl
 * @returns {Promise<THREE.Object3D>}
 */
export async function loadKenneyCityKitTemplate(prefabKey, glbUrl) {
  if (templateCache.has(prefabKey)) {
    return templateCache.get(prefabKey);
  }
  if (loadingCache.has(prefabKey)) {
    return loadingCache.get(prefabKey);
  }

  const promise = loader.loadAsync(glbUrl).then((gltf) => {
    const template = gltf.scene;
    template.name = `kenney-city-kit-${prefabKey}`;
    template.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    templateCache.set(prefabKey, template);
    loadingCache.delete(prefabKey);
    return template;
  });

  loadingCache.set(prefabKey, promise);
  return promise;
}

/**
 * @param {string} prefabKey
 * @param {string} glbUrl
 * @returns {Promise<THREE.Object3D>}
 */
export async function cloneKenneyCityKitPrefab(prefabKey, glbUrl) {
  const template = await loadKenneyCityKitTemplate(prefabKey, glbUrl);
  return template.clone(true);
}

/**
 * @param {Iterable<string>} prefabKeys
 * @param {Record<string, { glb: string }>} prefabCatalog
 */
export async function preloadKenneyCityKitPrefabs(prefabKeys, prefabCatalog) {
  const tasks = [];
  for (const prefabKey of prefabKeys) {
    const entry = prefabCatalog[prefabKey];
    if (!entry?.glb) {
      console.warn(`[Kenney city kit] Unknown prefab: ${prefabKey}`);
      continue;
    }
    tasks.push(loadKenneyCityKitTemplate(prefabKey, entry.glb));
  }
  await Promise.all(tasks);
}
