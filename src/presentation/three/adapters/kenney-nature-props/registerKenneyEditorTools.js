import {
  EDITOR_TOOL_META,
  EDITOR_TOOLS_BY_CATEGORY,
  KENNEY_EDITOR_CATEGORY_DEFS,
} from '../../../../shared/editor-catalog/editorKenneyCatalog.js';

/**
 * @param {Record<string, string[]>} toolIds
 * @param {{ text: string, tool: string, group: string, title?: string }[]} buttonData
 */
export function registerKenneyEditorTools(toolIds, buttonData) {
  for (const category of KENNEY_EDITOR_CATEGORY_DEFS) {
    const ids = EDITOR_TOOLS_BY_CATEGORY[category.id] ?? [];
    if (!Array.isArray(toolIds[category.id])) {
      toolIds[category.id] = [];
    }
    for (const toolId of ids) {
      if (!toolIds[category.id].includes(toolId)) {
        toolIds[category.id].push(toolId);
      }

      const meta = EDITOR_TOOL_META[toolId];
      if (!meta || buttonData.some((entry) => entry.tool === toolId)) {
        continue;
      }

      buttonData.push({
        text: meta.shortLabel,
        tool: toolId,
        group: category.tooltip,
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
