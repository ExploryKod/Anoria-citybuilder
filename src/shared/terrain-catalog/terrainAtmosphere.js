import * as THREE from 'three';

import { blendTerrainColorHex } from './terrainColorBlend.js';
import { terrainColorHexToCss } from './terrainDisplayColor.js';

/**
 * Kenney `ground_grass` unlit display color — calibrated from
 * `kenney_nature-kit/Isometric/ground_grass_NE.png` (isometric preview).
 *
 * Do **not** use the GLB/MTL baseColor (~`#74ecdd`) or the infinite ground
 * plane will show a different green than the playable tiles.
 */
export const KENNEY_GROUND_GRASS_COLOR = 0x2fe7c5;

/** @deprecated prefer resolveTerrainDisplayColorCss('nature:ground_grass') */
export const KENNEY_GROUND_GRASS_COLOR_CSS = terrainColorHexToCss(
  KENNEY_GROUND_GRASS_COLOR
);

/** Infinite sea around the island (Kenney water tone). */
export const SCENE_SEA_COLOR = 0x5ec4e8;
export const SCENE_SEA_COLOR_CSS = terrainColorHexToCss(SCENE_SEA_COLOR);

/** Flat scene background (sky) until a Kenney sky is added. */
export const SCENE_SKY_COLOR = 0xb7d4ea;
export const SCENE_SKY_COLOR_CSS = terrainColorHexToCss(SCENE_SKY_COLOR);

/**
 * Fog tint at the horizon — blended from grass + sky (default gameplay).
 */
export const SCENE_FOG_COLOR = blendTerrainColorHex(
  KENNEY_GROUND_GRASS_COLOR,
  SCENE_SKY_COLOR,
  0.42
);
export const SCENE_FOG_COLOR_CSS = terrainColorHexToCss(SCENE_FOG_COLOR);

/** Editor mode — sea plane behind the grass grid. */
export const SCENE_EDITOR_FOG_COLOR = blendTerrainColorHex(
  SCENE_SEA_COLOR,
  SCENE_SKY_COLOR,
  0.35
);

/** FogExp2 density — raise slightly if the substrate edge is still visible. */
export const SCENE_FOG_DENSITY = 0.012;

/**
 * @param {{ editor?: boolean }} [options]
 * @returns {THREE.FogExp2}
 */
export function createSceneFog(options = {}) {
  const fogColor = options.editor ? SCENE_EDITOR_FOG_COLOR : SCENE_FOG_COLOR;
  return new THREE.FogExp2(fogColor, SCENE_FOG_DENSITY);
}
