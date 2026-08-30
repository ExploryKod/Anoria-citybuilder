// Kenney test — loads and caches individual Kenney GLB modules.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tuneKenneyModuleAppearance, KENNEY_APPEARANCE_REVISION } from './KenneyBuildingAppearance.js';

const loader = new GLTFLoader();
/** @type {Map<string, THREE.Object3D>} */
const templateCache = new Map();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const loadingCache = new Map();
let cachedAppearanceRevision = -1;

function ensureKenneyAppearanceRevision() {
  if (cachedAppearanceRevision === KENNEY_APPEARANCE_REVISION) {
    return;
  }
  templateCache.clear();
  loadingCache.clear();
  cachedAppearanceRevision = KENNEY_APPEARANCE_REVISION;
}

/**
 * @param {string} moduleId
 * @param {string} glbUrl
 * @returns {Promise<THREE.Object3D>}
 */
export async function loadKenneyModuleTemplate(moduleId, glbUrl) {
  ensureKenneyAppearanceRevision();
  if (templateCache.has(moduleId)) {
    return templateCache.get(moduleId);
  }
  if (loadingCache.has(moduleId)) {
    return loadingCache.get(moduleId);
  }

  const promise = loader.loadAsync(glbUrl).then((gltf) => {
    const template = gltf.scene;
    template.name = `kenney-module-${moduleId}`;
    template.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    tuneKenneyModuleAppearance(template, moduleId);
    templateCache.set(moduleId, template);
    loadingCache.delete(moduleId);
    return template;
  });

  loadingCache.set(moduleId, promise);
  return promise;
}

/**
 * @param {string} moduleId
 * @param {string} glbUrl
 * @returns {Promise<THREE.Object3D>}
 */
export async function cloneKenneyModule(moduleId, glbUrl) {
  const template = await loadKenneyModuleTemplate(moduleId, glbUrl);
  return template.clone(true);
}

/**
 * @param {Iterable<string>} moduleIds
 * @param {Record<string, { glb: string }>} moduleCatalog
 */
export async function preloadKenneyModules(moduleIds, moduleCatalog) {
  const tasks = [];
  for (const moduleId of moduleIds) {
    const entry = moduleCatalog[moduleId];
    if (!entry?.glb) {
      console.warn(`[Kenney test] Unknown module id: ${moduleId}`);
      continue;
    }
    tasks.push(loadKenneyModuleTemplate(moduleId, entry.glb));
  }
  await Promise.all(tasks);
}

/** Clears caches (tests / hot reload). */
export function resetKenneyModuleCache() {
  templateCache.clear();
  loadingCache.clear();
}
