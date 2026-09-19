/**
 * Thumbnails for the assets reference page (Kenney road GLBs + procedural ground).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { resolveTerrainDisplayColorCss } from '../../../shared/terrain-catalog/terrainDisplayColor.js';

/**
 * Scene-tile thumbnails: only the procedural ground belongs to the `sceneTile`
 * source, drawn as a flat colour.
 *
 * @param {string} toolId
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 */
export async function renderSceneTileThumbnail(toolId, canvas, size = 104) {
  if (toolId === 'grass') {
    renderGrassPlaceholder(canvas, size);
    return;
  }
  renderMissingPlaceholder(canvas, size, toolId);
}

/**
 * Renders any Y-up GLB (e.g. a Kenney road piece) into a canvas.
 *
 * @param {string} glbUrl
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 */
export async function renderGlbThumbnail(glbUrl, canvas, size = 104) {
  try {
    const gltf = await new GLTFLoader().loadAsync(encodeURI(glbUrl));
    await renderObjectToCanvas(gltf.scene, canvas, size);
  } catch (error) {
    console.warn('[assets] thumbnail failed:', glbUrl, error);
    renderMissingPlaceholder(canvas, size, glbUrl.split('/').pop() ?? glbUrl);
  }
}

/**
 * Frames `root` with an isometric orthographic camera and draws it once.
 *
 * @param {THREE.Object3D} root
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 */
async function renderObjectToCanvas(root, canvas, size) {
  const width = size * 2;
  const height = size * 2;
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(root);

  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const sizeVec = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(sizeVec);
  root.position.sub(center);

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

  const ambient = new THREE.AmbientLight(0xffffff, 1.6);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(2, 4, 3);
  scene.add(ambient, key);

  renderer.render(scene, camera);

  // Geometry/materials belong to the cached GLTF (roads) or a clone that shares
  // them (village) — only the renderer is released here.
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
