import {
  SCENE_FOG_COLOR_CSS,
  SCENE_SKY_COLOR_CSS,
} from './terrainAtmosphere.js';
import { resolveTerrainDisplayColorCss } from './terrainDisplayColor.js';

/**
 * Publishes terrain atmosphere tokens on `:root` so DOM previews match the Three.js scene.
 *
 * @param {HTMLElement} [root]
 */
export function applyTerrainDisplayCssVariables(root = document.documentElement) {
  root.style.setProperty(
    '--terrain-grass-color',
    resolveTerrainDisplayColorCss('nature:ground_grass')
  );
  root.style.setProperty('--terrain-sky-color', SCENE_SKY_COLOR_CSS);
  root.style.setProperty('--terrain-fog-color', SCENE_FOG_COLOR_CSS);
}
