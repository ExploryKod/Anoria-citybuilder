/**
 * How the world map looks: the colours, the scales and the zoom of the drawing, as data. The Canvas adapter reads them and decides nothing of them
 * (see contexts/geography/docs/world-map.md, "The appearance catalog"). The values are those of the map as it was drawn by its first renderer.
 *
 * A marker's picture is placed by its `origin` (the share of the picture's width and height that sits at the marker's point): the Kenney hexagons
 * stand a little above the centre of their tile.
 */

export const WORLD_MAP_THEME = Object.freeze({
  /** The sea: Kenney has no water hexagon, the ocean is the background. */
  ocean: '#1a3a5c',

  /** Where the zoom starts (it is lowered to fit a small screen), and how far it goes. */
  zoom: Object.freeze({ initial: 0.85, min: 0.45, max: 1.6, wheelSpeed: 0.0015 }),

  /** The outline of the hexagon under the pointer. */
  hover: Object.freeze({ color: '#fb8122', alpha: 0.65, width: 2, radius: 0.98 }),

  origin: Object.freeze({ x: 0.5, y: 0.55 }),

  /** A hexagon of a hamlet that is still locked is dimmed and tinted; a little less when that hamlet is selected. */
  terrain: Object.freeze({
    locked: Object.freeze({ tint: '#7a6b8a', alpha: 0.82, selectedAlpha: 0.95 }),
  }),

  hamlet: Object.freeze({
    scale: 0.88,
    selectedScale: 1.1,
    tint: Object.freeze({ active: '#88ffbb', unlocked: '#ffd4a8' }),
    /** Where the name sits under the marker, in the marker's own units (before the zoom). */
    labelOffset: Object.freeze({ open: 38, locked: 18 }),
    /** A locked hamlet is a padlock on a plate, not a building. */
    lock: Object.freeze({
      offsetY: -6,
      plate: Object.freeze({ radius: 14, fill: 'rgba(29, 34, 40, 0.82)', stroke: 'rgba(201, 187, 168, 0.9)', strokeWidth: 1.5 }),
      color: '#c9bba8',
    }),
  }),

  city: Object.freeze({
    scale: 1,
    selectedScale: 1.1,
    /** A selected city is untinted; by category (or id) otherwise. */
    tint: Object.freeze({ enemy: '#cc6666', capital: '#ffd4a8' }),
    labelOffset: 42,
  }),

  /** A marker is touched with a finger: whatever its picture, its target is this wide at least, in screen pixels. */
  minTouchTarget: 44,
});
