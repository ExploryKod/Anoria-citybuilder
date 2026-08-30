// Kenney nature-kit terrain — loads and caches terrain GLB tiles.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainCatalogEntry } from '../../../../shared/terrain-catalog/terrainCatalog.js';
import { resolveTerrainDisplayColorHex } from '../../../../shared/terrain-catalog/terrainDisplayColor.js';
import {
  applyEditorKenneyGltfPresentation,
} from '../kenney-nature/kenneyGltfPresentation.js';

/** @typedef {'gltf' | 'flat'} KenneyTerrainPresentation */

const loader = new GLTFLoader();
/** @type {Map<string, THREE.Object3D>} */
const templateCache = new Map();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const loadingCache = new Map();

const TERRAIN_RENDER_ORDER = 2;
const SHORE_TERRAIN_RENDER_ORDER = 3;
const BEACH_TERRAIN_RENDER_ORDER = 4;

/**
 * @param {string} terrainKey
 * @param {KenneyTerrainPresentation} presentation
 * @returns {string}
 */
function templateCacheKey(terrainKey, presentation) {
  return `${terrainKey}::${presentation}`;
}

/**
 * @param {string} materialName
 * @param {string} terrainKey
 * @param {ReturnType<typeof getTerrainCatalogEntry>} entry
 * @returns {number}
 */
function resolveTerrainMaterialColor(materialName, terrainKey, entry) {
  const mapped = entry?.materialColors?.[materialName];
  if (typeof mapped === 'string') {
    return resolveTerrainDisplayColorHex(mapped);
  }
  if (typeof mapped === 'number') {
    return mapped;
  }
  return resolveTerrainDisplayColorHex(terrainKey);
}

/**
 * @param {string} terrainKey
 * @returns {number}
 */
export function resolveTerrainRenderOrder(terrainKey) {
  if (terrainKey === 'nature:platform_beach') {
    return BEACH_TERRAIN_RENDER_ORDER;
  }
  if (terrainKey.startsWith('nature:cliff_')) {
    return SHORE_TERRAIN_RENDER_ORDER;
  }
  return TERRAIN_RENDER_ORDER;
}

/** Gameplay island tiles only — flat catalog tints. */
export function applyFlatTerrainMeshPresentation(mesh, terrainKey) {
  const entry = getTerrainCatalogEntry(terrainKey);
  const renderOrder = resolveTerrainRenderOrder(terrainKey);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = renderOrder;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const unlitMaterials = materials.map((material) => {
    const color = resolveTerrainMaterialColor(material?.name ?? '', terrainKey, entry);
    material?.dispose?.();
    return new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
  });
  mesh.material = unlitMaterials.length > 1 ? unlitMaterials : unlitMaterials[0];
}

/**
 * @param {string} terrainKey
 * @param {string} glbUrl
 * @param {KenneyTerrainPresentation} presentation
 * @returns {Promise<THREE.Object3D>}
 */
export async function loadKenneyNatureTerrainTemplate(terrainKey, glbUrl, presentation) {
  const cacheKey = templateCacheKey(terrainKey, presentation);
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey);
  }
  if (loadingCache.has(cacheKey)) {
    return loadingCache.get(cacheKey);
  }

  const promise = loader.loadAsync(glbUrl).then((gltf) => {
    const template = gltf.scene;
    template.name = `kenney-nature-terrain-${terrainKey}`;
    if (presentation === 'gltf') {
      applyEditorKenneyGltfPresentation(template, {
        renderOrder: resolveTerrainRenderOrder(terrainKey),
      });
    } else {
      template.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          applyFlatTerrainMeshPresentation(child, terrainKey);
        }
      });
    }
    templateCache.set(cacheKey, template);
    loadingCache.delete(cacheKey);
    return template;
  });

  loadingCache.set(cacheKey, promise);
  return promise;
}

/**
 * @param {string} terrainKey
 * @param {KenneyTerrainPresentation} presentation
 * @returns {THREE.Object3D | undefined}
 */
export function getKenneyNatureTerrainTemplate(terrainKey, presentation) {
  return templateCache.get(templateCacheKey(terrainKey, presentation));
}
