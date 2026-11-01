import { getLandUse, landUseIds } from './LandUseCatalog.js';

/** The two things the town hall does with land: put a square of it up for sale for a use, or stop selling it. */
export const PLOT_ACTIONS = Object.freeze({
  mark: Object.freeze({ id: 'mark', label: 'Mettre en vente' }),
  clear: Object.freeze({ id: 'clear', label: 'Retirer de la vente' }),
});

/**
 * The longest side, in tiles, of the square the town hall draws to mark or clear land in one gesture. First value, to tune by playing.
 */
export const PLOT_SQUARE_MAX_SIDE = 8;

const PREFIX = 'plot:';

/** The tool id of an action on a use's land: `plot:<use>:<action>`. */
export function plotToolId(useId, actionId) {
  getLandUse(useId);
  if (!PLOT_ACTIONS[actionId]) throw new Error(`[plotTools] no plot action "${actionId}"`);
  return `${PREFIX}${useId}:${actionId}`;
}

/**
 * @param {string | null | undefined} toolId
 * @returns {{ use: string, action: 'mark' | 'clear' } | null} what the tool does, or null when it is not a plot tool
 */
export function parsePlotTool(toolId) {
  if (typeof toolId !== 'string' || !toolId.startsWith(PREFIX)) return null;
  const [use, action] = toolId.slice(PREFIX.length).split(':');
  getLandUse(use);
  if (!PLOT_ACTIONS[action]) throw new Error(`[plotTools] "${toolId}" names no plot action`);
  return { use, action };
}

/**
 * The tools of the "Terrains" tab, one cluster per use (its sub-tab): [{ text, tool, group, title }]
 * @returns {Array<Array<{ text: string, tool: string, group: string, title: string }>>}
 */
export function plotToolClusters() {
  return landUseIds().map((useId) => {
    const use = getLandUse(useId);
    return Object.values(PLOT_ACTIONS).map(({ id, label }) => ({
      text: `${use.label} : ${label.toLowerCase()}`,
      tool: plotToolId(useId, id),
      group: 'plots',
      title: `${use.label} : ${label.toLowerCase()}`,
    }));
  });
}
