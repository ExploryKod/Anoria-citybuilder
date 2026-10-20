/**
 * The one declarative list of hamlets. Everything that names a hamlet, places it on the world map,
 * lists it in the hamlet carousel or draws its outskirts decoration reads from here.
 *
 * - `starting`: the hamlet the player begins in (exactly one).
 * - `map`: hex position on the kingdom map (axial q/r) and where its label sits.
 * - `deco`: its decorative outskirts around the playable grid. `anchor` picks the playable edge
 *   (`x`/`z`: 'min' | 'mid' | 'max') and `dx`/`dz` offset it from there.
 */

/**
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   color: string,
 *   starting?: boolean,
 *   map?: { q: number, r: number, sprite: string, labelAnchor: 'top' | 'bottom' | 'left' | 'right' },
 *   deco?: {
 *     anchor: { x: 'min' | 'mid' | 'max', dx: number, z: 'min' | 'mid' | 'max', dz: number },
 *     houses: { offsetX: number, offsetZ: number }[],
 *     trees: { offsetX: number, offsetZ: number }[],
 *     hasMarket?: boolean,
 *     hasWell?: boolean,
 *   },
 * }} HamletDefinition
 */

/** @type {ReadonlyArray<HamletDefinition>} */
export const HAMLET_CATALOG = Object.freeze([
  {
    slug: 'eraanurbs',
    name: 'Anoria',
    color: '#c9a227',
    starting: true,
    map: { q: 0, r: 0, sprite: 'hamlet', labelAnchor: 'top' },
  },
  {
    slug: 'clairiere',
    name: 'Clairière',
    color: '#4caf50',
    map: { q: -2, r: -1, sprite: 'hamlet', labelAnchor: 'left' },
    deco: {
      anchor: { x: 'min', dx: -5, z: 'min', dz: -5 },
      houses: [{ offsetX: -1, offsetZ: -1 }, { offsetX: 1, offsetZ: -1 }, { offsetX: -1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: -2, offsetZ: 2 }],
      hasMarket: true,
      hasWell: true,
    },
  },
  {
    slug: 'pont-saules',
    name: 'Les Saules',
    color: '#26a69a',
    map: { q: 2, r: -1, sprite: 'hamlet', labelAnchor: 'right' },
    deco: {
      anchor: { x: 'max', dx: 5, z: 'min', dz: -5 },
      houses: [{ offsetX: -1, offsetZ: -1 }, { offsetX: 1, offsetZ: -1 }, { offsetX: 1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: 2, offsetZ: 2 }],
      hasWell: true,
    },
  },
  {
    slug: 'bruyeres',
    name: 'Bruyères',
    color: '#8e6bbf',
    map: { q: -2, r: 1, sprite: 'hamlet', labelAnchor: 'left' },
    deco: {
      anchor: { x: 'min', dx: -5, z: 'max', dz: 5 },
      houses: [
        { offsetX: -1, offsetZ: -1 },
        { offsetX: 1, offsetZ: -1 },
        { offsetX: -1, offsetZ: 1 },
        { offsetX: 1, offsetZ: 1 },
      ],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: -2, offsetZ: 2 }],
    },
  },
]);

export const HAMLET_NAME_MAX_LENGTH = 10;

for (const hamlet of HAMLET_CATALOG) {
  if (hamlet.name.length > HAMLET_NAME_MAX_LENGTH) {
    throw new Error(`[hamletCatalog] "${hamlet.name}" is longer than ${HAMLET_NAME_MAX_LENGTH} characters`);
  }
}

const startingHamlets = HAMLET_CATALOG.filter((hamlet) => hamlet.starting);
if (startingHamlets.length !== 1) {
  throw new Error(`[hamletCatalog] exactly one hamlet must be starting, found ${startingHamlets.length}`);
}
