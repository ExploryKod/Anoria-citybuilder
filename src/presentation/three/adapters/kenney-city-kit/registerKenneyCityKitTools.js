import {
  KENNEY_CITY_KIT_TOOL_META,
  KENNEY_CITY_KIT_TOOLS_BY_CATEGORY,
  isKenneyBuildingId,
} from './kenneyCityKitConfig.js';

/**
 * Register Kenney prefab tools into mesh loader toolIds + button metadata.
 * Kenney meshes are loaded by KenneyCityKitMeshAdapter, not village GLB.
 *
 * @param {Record<string, string[]>} toolIds
 * @param {{ text: string, tool: string, group: string, title?: string }[]} buttonData
 */
export function registerKenneyCityKitTools(toolIds, buttonData) {
  for (const [category, ids] of Object.entries(KENNEY_CITY_KIT_TOOLS_BY_CATEGORY)) {
    if (!Array.isArray(toolIds[category])) {
      toolIds[category] = [];
    }
    for (const toolId of ids) {
      if (!toolIds[category].includes(toolId)) {
        toolIds[category].push(toolId);
      }

      const meta = KENNEY_CITY_KIT_TOOL_META[toolId];
      if (!meta || buttonData.some((entry) => entry.tool === toolId)) {
        continue;
      }

      buttonData.push({
        text: meta.shortLabel,
        tool: toolId,
        group: 'Kenney',
        title: meta.tooltip,
      });
    }
  }
}

/**
 * @param {string} toolId
 * @returns {boolean}
 */
export function shouldSkipVillageMeshFactory(toolId) {
  return isKenneyBuildingId(toolId);
}
