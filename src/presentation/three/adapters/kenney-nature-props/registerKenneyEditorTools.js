import {
  EDITOR_TOOL_META,
  EDITOR_TOOLS_BY_CATEGORY,
} from '../../../../shared/editor-catalog/editorKenneyCatalog.js';

/**
 * @param {Record<string, string[]>} toolIds
 * @param {{ text: string, tool: string, group: string, title?: string }[]} buttonData
 */
export function registerKenneyEditorTools(toolIds, buttonData) {
  for (const [category, ids] of Object.entries(EDITOR_TOOLS_BY_CATEGORY)) {
    if (!Array.isArray(toolIds[category])) {
      toolIds[category] = [];
    }
    for (const toolId of ids) {
      if (!toolIds[category].includes(toolId)) {
        toolIds[category].push(toolId);
      }

      const meta = EDITOR_TOOL_META[toolId];
      if (!meta || buttonData.some((entry) => entry.tool === toolId)) {
        continue;
      }

      buttonData.push({
        text: meta.shortLabel,
        tool: toolId,
        group: category === 'editorTerrain' ? 'Terrain' : 'Nature',
        title: meta.tooltip ?? meta.shortLabel,
      });
    }
  }
}

/**
 * @param {string} toolId
 * @returns {boolean}
 */
export function shouldSkipVillageMeshForEditorTool(toolId) {
  return Boolean(EDITOR_TOOL_META[toolId]);
}
