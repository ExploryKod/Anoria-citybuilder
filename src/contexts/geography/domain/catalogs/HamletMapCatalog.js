/**
 * Internal kingdom map — proto hamlet positions on an axial hex grid.
 * Layout mirrors 3D neighbor deco topology around Val d'Era (eraanurbs).
 */

/** @type {ReadonlyArray<{ id: string, name: string, q: number, r: number, sprite: string, labelAnchor?: string }>} */
export const HAMLET_MAP_SITES = Object.freeze([
  { id: 'eraanurbs', name: 'Val d’Era', q: 0, r: 0, sprite: 'hamlet', labelAnchor: 'top' },
  { id: 'prevert', name: 'Prévert', q: 0, r: -2, sprite: 'hamlet', labelAnchor: 'top' },
  { id: 'sourceclaire', name: 'Sourceclaire', q: 0, r: 2, sprite: 'hamlet', labelAnchor: 'bottom' },
  { id: 'clairiere', name: 'Clairière', q: -2, r: -1, sprite: 'hamlet', labelAnchor: 'left' },
  { id: 'pont-saules', name: 'Pont-aux-Saules', q: 2, r: -1, sprite: 'hamlet', labelAnchor: 'right' },
  { id: 'bruyeres', name: 'Les Bruyères', q: -2, r: 1, sprite: 'hamlet', labelAnchor: 'left' },
  { id: 'rochehaute', name: 'Rochehaute', q: 2, r: 1, sprite: 'hamlet', labelAnchor: 'right' },
  { id: 'bois-joli', name: 'Bois-Joli', q: 2, r: 0, sprite: 'hamlet', labelAnchor: 'right' },
  { id: 'marais-blanc', name: 'Marais-Blanc', q: -2, r: 0, sprite: 'hamlet', labelAnchor: 'left' },
  { id: 'colline-rouge', name: 'Colline-Rouge', q: -3, r: -1, sprite: 'hamlet', labelAnchor: 'left' },
]);

/**
 * @param {string} hamletId
 */
export function getHamletMapSite(hamletId) {
  return HAMLET_MAP_SITES.find((site) => site.id === hamletId) ?? null;
}

/**
 * World-map hex for a proto-hamlet — same axial grid as the kingdom map, centred on Anoria.
 * @param {string} hamletId
 */
export function getHamletWorldHex(hamletId) {
  const site = getHamletMapSite(hamletId);
  if (!site) return null;
  return { q: site.q, r: site.r, sprite: site.sprite };
}
