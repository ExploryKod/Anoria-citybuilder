/**
 * Internal kingdom map — proto hamlet positions (percent 0–100).
 * Layout mirrors 3D neighbor deco topology around the playable grid center.
 */

/** @type {ReadonlyArray<{ id: string, name: string, x: number, y: number, labelAnchor?: string }>} */
export const HAMLET_MAP_SITES = Object.freeze([
  { id: 'eraanurbs', name: 'Val d’Era', x: 50, y: 50, labelAnchor: 'top' },
  { id: 'clairiere', name: 'Clairière', x: 32, y: 32, labelAnchor: 'left' },
  { id: 'pont-saules', name: 'Pont-aux-Saules', x: 68, y: 32, labelAnchor: 'right' },
  { id: 'bruyeres', name: 'Les Bruyères', x: 32, y: 68, labelAnchor: 'left' },
  { id: 'rochehaute', name: 'Rochehaute', x: 68, y: 68, labelAnchor: 'right' },
  { id: 'prevert', name: 'Prévert', x: 50, y: 28, labelAnchor: 'top' },
  { id: 'sourceclaire', name: 'Sourceclaire', x: 50, y: 72, labelAnchor: 'bottom' },
  { id: 'bois-joli', name: 'Bois-Joli', x: 72, y: 50, labelAnchor: 'right' },
  { id: 'marais-blanc', name: 'Marais-Blanc', x: 28, y: 50, labelAnchor: 'left' },
  { id: 'colline-rouge', name: 'Colline-Rouge', x: 24, y: 42, labelAnchor: 'left' },
]);

/**
 * @param {string} hamletId
 */
export function getHamletMapSite(hamletId) {
  return HAMLET_MAP_SITES.find((site) => site.id === hamletId) ?? null;
}
