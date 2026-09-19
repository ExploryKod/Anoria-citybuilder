import {
  EDITOR_NATURE_TOOL_IDS,
  EDITOR_TERRAIN_TOOL_IDS,
} from './editorKenneyCatalog.js';

const TERRAIN_TOOL_SET = new Set(EDITOR_TERRAIN_TOOL_IDS);
const NATURE_TOOL_SET = new Set(EDITOR_NATURE_TOOL_IDS);

/**
 * @param {string | null | undefined} toolId
 * @returns {boolean}
 */
export function isEditorTerrainTool(toolId) {
  return Boolean(toolId && TERRAIN_TOOL_SET.has(toolId));
}

/**
 * @param {string | null | undefined} toolId
 * @returns {boolean}
 */
export function isEditorNatureTool(toolId) {
  return Boolean(toolId && NATURE_TOOL_SET.has(toolId));
}

/**
 * @param {string | null | undefined} toolId
 * @returns {boolean}
 */
export function isEditorPlacementTool(toolId) {
  return isEditorTerrainTool(toolId) || isEditorNatureTool(toolId);
}
