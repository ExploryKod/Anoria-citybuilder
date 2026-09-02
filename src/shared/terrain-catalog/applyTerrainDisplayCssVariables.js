import {
  SCENE_EDITOR_BACKDROP_COLOR_CSS,
  SCENE_EDITOR_FOG_COLOR_CSS,
  SCENE_EDITOR_SEA_COLOR_CSS,
  SCENE_EDITOR_SKY_COLOR_CSS,
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

/**
 * Editor-only backdrop tokens — unified sea/sky so letterboxing matches the WebGL scene.
 *
 * @param {HTMLElement} [root]
 */
export function applyEditorTerrainDisplayCssVariables(root = document.documentElement) {
  root.style.setProperty('--terrain-editor-backdrop-color', SCENE_EDITOR_BACKDROP_COLOR_CSS);
  root.style.setProperty('--terrain-editor-sky-color', SCENE_EDITOR_SKY_COLOR_CSS);
  root.style.setProperty('--terrain-editor-sea-color', SCENE_EDITOR_SEA_COLOR_CSS);
  root.style.setProperty('--terrain-editor-fog-color', SCENE_EDITOR_FOG_COLOR_CSS);
  root.style.setProperty('--terrain-sky-color', SCENE_EDITOR_SKY_COLOR_CSS);
  root.style.setProperty('--terrain-fog-color', SCENE_EDITOR_FOG_COLOR_CSS);
}
