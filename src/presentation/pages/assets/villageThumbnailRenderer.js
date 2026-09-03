/**
 * Renders village GLB meshes into canvases for the assets reference page.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { VILLAGE_NATURE_MESH_ALIASES } from '../../../shared/building-catalog/villageAssetSets.js';
import { resolveTerrainDisplayColorCss } from '../../../shared/terrain-catalog/terrainDisplayColor.js';

const VILLAGE_GLB_URL = '/resources/lowpoly/village_town_assets_v2.glb';

/** @type {Promise<{ scene: THREE.Object3D }> | null} */
let villageGltfPromise = null;

/** @type {Map<string, THREE.Mesh> | null} */
let meshByToolId = null;

/**
 * @param {string} meshName
 * @returns {string | null}
 */
function meshNameToToolId(meshName) {
  const baseName = meshName.split('_Material')[0];
  const normalized = baseName.replace(/[.\s]/g, '_');
  const parts = normalized.split('_');

  if (parts[0] === 'StonePath') return 'StonePath-001';
  if (parts[0] === 'Hay' && parts[1] === 'Bale') return 'Hay-Bale';
  if (parts[0] === 'Hay' && parts[1] === 'Cart') return 'Hay-Cart';
  if (parts[0] === 'Hay' && parts[1] === 'Pile') return 'Hay-Pile';
  if (parts[0] === 'Farm' && parts[1] === 'Wheat') return 'Farm-Wheat';
  if (parts[0] === 'Farm' && parts[1] === 'Carrot') return 'Farm-Carrot';
  if (parts[0] === 'Farm' && parts[1] === 'Cabbage') return 'Farm-Cabbage';
  if (parts[0] === 'Tree' && parts[1] === 'Pine') return 'Tree-Pine-001';
  if (parts[0] === 'Tree' && parts[1] === 'Square') return 'Tree-Square-001';
  if (parts[0] === 'Tree' && parts[1] === 'Tall') return 'Tree-Tall-001';
  if (parts[0] === 'Boulder') return 'Boulder-001';

  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`.replace(/-$/, '');
  }

  return null;
}

/**
 * @param {string} toolId
 * @returns {string}
 */
function resolveMeshToolId(toolId) {
  if (toolId.startsWith('StonePath')) return 'StonePath-001';
  return VILLAGE_NATURE_MESH_ALIASES[toolId] ?? toolId;
}

async function loadVillageMeshes() {
  if (meshByToolId) {
    return meshByToolId;
  }

  if (!villageGltfPromise) {
    villageGltfPromise = new GLTFLoader().loadAsync(VILLAGE_GLB_URL);
  }

  const gltf = await villageGltfPromise;
  meshByToolId = new Map();

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const toolId = meshNameToToolId(child.name);
    if (!toolId || meshByToolId.has(toolId)) return;
    meshByToolId.set(toolId, child);
  });

  return meshByToolId;
}

/**
 * @param {string} toolId
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 */
export async function renderVillageThumbnail(toolId, canvas, size = 104) {
  if (toolId === 'grass') {
    renderGrassPlaceholder(canvas, size);
    return;
  }

  const meshLookup = await loadVillageMeshes();
  const sourceMesh = meshLookup.get(resolveMeshToolId(toolId));

  if (!sourceMesh) {
    renderMissingPlaceholder(canvas, size, toolId);
    return;
  }

  const width = size * 2;
  const height = size * 2;
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const mesh = sourceMesh.clone();
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  const box = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  const sizeVec = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(sizeVec);
  mesh.position.sub(center);

  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.01);
  const camera = new THREE.OrthographicCamera(
    -maxDim,
    maxDim,
    maxDim,
    -maxDim,
    0.1,
    maxDim * 10,
  );
  camera.position.set(maxDim * 1.2, maxDim * 1.4, maxDim * 1.2);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(2, 4, 3);
  scene.add(ambient, key);

  renderer.render(scene, camera);

  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat.dispose());
  } else {
    mesh.material?.dispose();
  }
  renderer.dispose();
}


/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 */
function renderGrassPlaceholder(canvas, size) {
  const px = size * 2;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, px);
  const grassColor = resolveTerrainDisplayColorCss('grass');
  gradient.addColorStop(0, grassColor);
  gradient.addColorStop(1, grassColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, px, px);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 * @param {string} toolId
 */
function renderMissingPlaceholder(canvas, size, toolId) {
  const px = size * 2;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = '#868e96';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('No mesh', px / 2, px / 2 - 6);
  ctx.fillText(toolId, px / 2, px / 2 + 10);
}
