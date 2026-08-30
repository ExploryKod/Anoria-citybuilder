import {
  classifyKenneyGlbName,
  humanizeKenneyGlbName,
  kenneyGlbToToolId,
  KENNEY_EDITOR_CATEGORY_DEFS,
  KENNEY_EDITOR_NATURE_CATEGORY_DEFS,
  KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS,
} from './classifyKenneyNatureAsset.js';
import {
  KENNEY_NATURE_ASSETS,
  KENNEY_NATURE_EDITOR_CATEGORY_DEFS,
  KENNEY_NATURE_KIT_GLB_COUNT,
} from './kenneyNatureKitManifest.generated.js';

export { KENNEY_EDITOR_CATEGORY_DEFS, KENNEY_EDITOR_NATURE_CATEGORY_DEFS, KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS, KENNEY_NATURE_EDITOR_CATEGORY_DEFS, KENNEY_NATURE_KIT_GLB_COUNT };

const GLB_BASE = '/resources/kenney_nature-kit/Models/GLTF format';
const PREVIEW_BASE = '/resources/kenney_nature-kit/Isometric';

/**
 * @param {string} glbName
 * @returns {string}
 */
export function kenneyNaturePreviewUrl(glbName) {
  return `${PREVIEW_BASE}/${glbName}_NE.png`;
}

/**
 * @param {string} glbName
 * @returns {string}
 */
export function kenneyNatureGlbUrl(glbName) {
  return `${GLB_BASE}/${glbName}.glb`;
}

/** @typedef {{ glbName: string, shortLabel: string, tooltip?: string, categoryId: string, layer: 'terrain' | 'prop' }} EditorToolMeta */

/** @type {Record<string, EditorToolMeta>} */
export const EDITOR_TOOL_META = Object.freeze(
  Object.fromEntries(
    KENNEY_NATURE_ASSETS.map((asset) => [
      asset.toolId,
      {
        glbName: asset.glbName,
        shortLabel: asset.shortLabel,
        tooltip: humanizeKenneyGlbName(asset.glbName),
        categoryId: asset.categoryId,
        layer: asset.layer,
      },
    ])
  )
);

/** @type {Record<string, string>} toolId → Isometric NE preview */
export const EDITOR_TOOL_PREVIEW_URLS = Object.freeze(
  Object.fromEntries(
    KENNEY_NATURE_ASSETS.map((asset) => [
      asset.toolId,
      kenneyNaturePreviewUrl(asset.glbName),
    ])
  )
);

/** @type {Record<string, readonly string[]>} */
export const EDITOR_TOOLS_BY_CATEGORY = Object.freeze(
  Object.fromEntries(
    KENNEY_EDITOR_CATEGORY_DEFS.map((category) => [
      category.id,
      Object.freeze(
        KENNEY_NATURE_ASSETS
          .filter((asset) => asset.categoryId === category.id)
          .map((asset) => asset.toolId)
      ),
    ])
  )
);

export const EDITOR_TERRAIN_TOOL_IDS = Object.freeze(
  KENNEY_NATURE_ASSETS.filter((asset) => asset.layer === 'terrain').map((asset) => asset.toolId)
);

export const EDITOR_NATURE_TOOL_IDS = Object.freeze(
  KENNEY_NATURE_ASSETS.filter((asset) => asset.layer === 'prop').map((asset) => asset.toolId)
);

/**
 * @param {string} toolId
 * @returns {boolean}
 */
export function isKenneyEditorToolId(toolId) {
  return Boolean(EDITOR_TOOL_META[toolId]);
}

/**
 * Re-export helpers used by the scanner tests.
 */
export { classifyKenneyGlbName, humanizeKenneyGlbName, kenneyGlbToToolId };
