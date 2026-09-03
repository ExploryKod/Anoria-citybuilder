import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import VillageTownAssetManager from '../../three/meshs/VillageTownAssetManager.js';
import { getKenneyCityKitMeshAdapter } from '../../three/adapters/kenney-city-kit/KenneyCityKitMeshAdapter.js';
import { BUILDING_ASSET_CATALOG } from '../../three/meshs/BuildingAssetCatalog.js';
import { resolveAndCreateBuildingMesh } from '../../three/meshs/resolveBuildingMesh.js';
import { STATUS_ICON_DEFAULTS, STATUS_ICON_ANCHOR_OVERRIDES } from '../../three/meshs/statusIconAnchors.js';
import { getLocalBoundingBox, resolveStatusIconPosition } from '../../three/meshUtils.js';
import { textures } from '../../three/meshs/data.js';

/**
 * Standalone status-icon placement tuning tool (/placement.html).
 *
 * Loads one building at a time via the exact same mesh resolver the real
 * game uses (resolveAndCreateBuildingMesh — reads BUILDING_ASSET_CATALOG),
 * so whatever anchor you tune here is guaranteed to apply to what actually
 * renders in-game. Deliberately does NOT run scene.js/createScene or any
 * economy tick — this only needs a scene, a camera, and one mesh.
 */

// Icon key -> texture key (matches scene.js's setStatusSprite call sites).
const ICON_TEXTURE_KEYS = {
  road: 'no-roads',
  'no-food': 'nofood',
  isBuying: 'isBuying',
  isCollecting: 'isCollecting',
  'grow-food': 'grow-food',
  harvest: 'harvest',
  'sell-food': 'sell-food',
  'sold-to-windmill': 'isCollecting',
  'no-work': 'no-work',
};

const ICON_KEYS = Object.keys(ICON_TEXTURE_KEYS);
const PREVIEW_SPRITE_NAME = 'preview-icon';

const viewport = document.getElementById('viewport');
const buildingSelect = document.getElementById('building-select');
const iconSelect = document.getElementById('icon-select');
const offsetXInput = document.getElementById('offset-x');
const offsetYInput = document.getElementById('offset-y');
const offsetZInput = document.getElementById('offset-z');
const scaleXInput = document.getElementById('scale-x');
const scaleYInput = document.getElementById('scale-y');
const scaleZInput = document.getElementById('scale-z');
const showBoxCheckbox = document.getElementById('show-box');
const outputEl = document.getElementById('output');

for (const buildingId of Object.keys(BUILDING_ASSET_CATALOG).sort()) {
  const option = document.createElement('option');
  option.value = buildingId;
  option.textContent = buildingId;
  buildingSelect.appendChild(option);
}
for (const iconKey of ICON_KEYS) {
  const option = document.createElement('option');
  option.value = iconKey;
  option.textContent = iconKey;
  iconSelect.appendChild(option);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.add(new THREE.GridHelper(10, 10, 0x444466, 0x333344));

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(4, 4, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const directional = new THREE.DirectionalLight(0xffffff, 1.1);
directional.position.set(5, 10, 5);
scene.add(directional);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

const assetManager = new VillageTownAssetManager();

let currentMesh = null;
let boxHelper = null;

function clearCurrentMesh() {
  if (boxHelper) {
    currentMesh?.remove(boxHelper);
    boxHelper = null;
  }
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }
}

function updateBoxHelper() {
  if (boxHelper) {
    currentMesh.remove(boxHelper);
    boxHelper = null;
  }
  if (!showBoxCheckbox.checked || !currentMesh) return;
  const box = getLocalBoundingBox(currentMesh);
  boxHelper = new THREE.Box3Helper(box, 0xffff00);
  currentMesh.add(boxHelper);
}

function currentOffset() {
  return {
    x: Number(offsetXInput.value) || 0,
    y: Number(offsetYInput.value) || 0,
    z: Number(offsetZInput.value) || 0,
  };
}

function currentScale() {
  return {
    x: Number(scaleXInput.value) || 1,
    y: Number(scaleYInput.value) || 1,
    z: Number(scaleZInput.value) || 1,
  };
}

function fillInputsFromOffsetScale(offset, scale) {
  offsetXInput.value = offset.x;
  offsetYInput.value = offset.y;
  offsetZInput.value = offset.z;
  scaleXInput.value = scale.x;
  scaleYInput.value = scale.y;
  scaleZInput.value = scale.z;
}

function updateIconPreview() {
  if (!currentMesh) return;
  const iconKey = iconSelect.value;
  const offset = currentOffset();
  const scale = currentScale();
  const position = resolveStatusIconPosition(currentMesh, offset);

  assetManager.removeStatusSprite(currentMesh, PREVIEW_SPRITE_NAME);
  assetManager.setStatusSprite(
    currentMesh,
    textures[ICON_TEXTURE_KEYS[iconKey]],
    PREVIEW_SPRITE_NAME,
    scale,
    position,
    true,
    null,
    null
  );

  const buildingId = buildingSelect.value;
  outputEl.textContent = JSON.stringify({ [buildingId]: { [iconKey]: { position: offset, scale } } }, null, 2);
}

function resetInputsForIcon() {
  const buildingId = buildingSelect.value;
  const iconKey = iconSelect.value;
  const override = STATUS_ICON_ANCHOR_OVERRIDES[buildingId]?.[iconKey];
  const defaultMeta = STATUS_ICON_DEFAULTS[iconKey];
  fillInputsFromOffsetScale(override?.position ?? defaultMeta.position, override?.scale ?? defaultMeta.scale);
  updateIconPreview();
}

async function loadSelectedBuilding() {
  const buildingId = buildingSelect.value;
  clearCurrentMesh();
  outputEl.textContent = `Loading "${buildingId}"...`;
  try {
    const mesh = await resolveAndCreateBuildingMesh({
      buildingId,
      x: 0,
      y: 0,
      rotationStep: 0,
      assetManager,
    });
    scene.add(mesh);
    currentMesh = mesh;
    updateBoxHelper();
    resetInputsForIcon();
  } catch (error) {
    outputEl.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

buildingSelect.addEventListener('change', loadSelectedBuilding);
iconSelect.addEventListener('change', resetInputsForIcon);
showBoxCheckbox.addEventListener('change', updateBoxHelper);
[offsetXInput, offsetYInput, offsetZInput, scaleXInput, scaleYInput, scaleZInput].forEach((input) => {
  input.addEventListener('input', updateIconPreview);
});

// Mirrors AssetLoader.js's loadGameAssets — every building category the
// catalog can reference, loaded eagerly (no idle-callback deferral: this
// tool needs everything ready before you pick a building, not fast boot).
const VILLAGE_TOWN_BUILDING_CATEGORIES = [
  'houses',
  'palaces',
  'markets',
  'industry',
  'public',
  'decoration',
  'tombs',
  'farms',
  'infrastructure',
];

async function boot() {
  outputEl.textContent = 'Loading assets...';
  await getKenneyCityKitMeshAdapter().initialize();
  await Promise.all(
    VILLAGE_TOWN_BUILDING_CATEGORIES.map((category) => assetManager.initializeBuildings(category))
  );
  await loadSelectedBuilding();
}

boot().catch((error) => {
  outputEl.textContent = `Error loading assets: ${error.message}`;
  console.error(error);
});
