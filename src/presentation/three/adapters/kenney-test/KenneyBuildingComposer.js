// Kenney test — fetches catalog JSON and composes recipe parts into a THREE.Group.

import * as THREE from 'three';
import { cloneKenneyModule } from './KenneyModuleLoader.js';
import { addKenneyInteriorRoom } from './KenneyBuildingAppearance.js';
import {
  KENNEY_MODULAR_CATALOG_URL,
  KENNEY_WORLD_PLATFORM_HEIGHT,
} from './kenneyTestConfig.js';

/** @type {Promise<object> | null} */
let catalogPromise = null;

export function loadKenneyModularCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(KENNEY_MODULAR_CATALOG_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Kenney test catalog HTTP ${response.status}`);
      }
      return response.json();
    });
  }
  return catalogPromise;
}

/**
 * @param {string} recipeId
 * @returns {Promise<object>}
 */
export async function getKenneyBuildingRecipe(recipeId) {
  const catalog = await loadKenneyModularCatalog();
  const recipe = catalog.buildings?.[recipeId];
  if (!recipe) {
    throw new Error(`Kenney test recipe not found: ${recipeId}`);
  }
  return recipe;
}

/**
 * @param {object} params
 * @param {string} params.recipeId
 * @param {number} params.originX — grid tile X (NW anchor)
 * @param {number} params.originZ — grid tile Z/Y (NW anchor)
 * @param {number} [params.rotationStep=0] — 0..3 quarter turns on Y
 * @param {string} [params.buildingId]
 * @returns {Promise<THREE.Group>}
 */
export async function composeKenneyBuilding({
  recipeId,
  originX,
  originZ,
  rotationStep = 0,
  buildingId = 'Kenney-House-Test',
}) {
  const catalog = await loadKenneyModularCatalog();
  const recipe = await getKenneyBuildingRecipe(recipeId);
  const moduleHeight = recipe.moduleHeight ?? catalog.moduleHeight ?? 1;
  const group = new THREE.Group();
  group.name = `kenney-building-${recipeId}`;

  for (const part of recipe.parts) {
    const moduleEntry = catalog.modules?.[part.module];
    if (!moduleEntry?.glb) {
      console.warn(`[Kenney test] Skip missing module: ${part.module}`);
      continue;
    }
    const mesh = await cloneKenneyModule(part.module, moduleEntry.glb);
    mesh.position.set(
      part.x ?? 0,
      (part.y ?? 0) * moduleHeight,
      part.z ?? 0
    );
    mesh.rotation.y = ((part.rot ?? 0) + rotationStep) * (Math.PI / 2);
    group.add(mesh);
  }

  const gridSize = recipe.gridSize ?? 1;
  if (recipe.interior !== false) {
    await addKenneyInteriorRoom(group, moduleHeight, gridSize, catalog.modules);
  }

  const centerOffset = (gridSize - 1) / 2;
  group.position.set(
    originX + centerOffset,
    KENNEY_WORLD_PLATFORM_HEIGHT,
    originZ + centerOffset
  );
  group.rotation.y = rotationStep * (Math.PI / 2);

  group.userData.id = buildingId;
  group.userData.type = buildingId;
  group.userData.isKenneyTest = true;
  group.userData.recipeId = recipeId;
  group.userData.gridSize = gridSize;
  group.userData.x = originX;
  group.userData.y = originZ;

  return group;
}

/**
 * @param {string} recipeId
 * @returns {Promise<string[]>}
 */
export async function listKenneyRecipeModuleIds(recipeId) {
  const recipe = await getKenneyBuildingRecipe(recipeId);
  return [...new Set(recipe.parts.map((part) => part.module))];
}
