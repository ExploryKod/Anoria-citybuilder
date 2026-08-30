// Kenney test — paths and ids for the modular GLB spike.

export const KENNEY_BUILDING_ID = 'Kenney-House-Test';

/** Default recipe when a city tile uses `Kenney-House-Test`. */
export const KENNEY_DEFAULT_RECIPE_ID = 'kenney-house-l1-a-glass';

export const KENNEY_MODULAR_CATALOG_URL =
  '/resources/kenney_fantasy-town-modular/kenney_modular_catalog.json';

/**
 * L1 showcase on the city grid — origins are NW tile anchors.
 * Spacing 2 = 1×1 house + 1 empty tile between each (minimum).
 */
export const KENNEY_L1_SHOWCASE = Object.freeze([
  { recipeId: 'kenney-house-l1-a-glass', x: 2, z: 2 },
  { recipeId: 'kenney-house-l1-b-shutters', x: 4, z: 2 },
  { recipeId: 'kenney-house-l1-c-round', x: 6, z: 2 },
]);

export const KENNEY_WORLD_PLATFORM_HEIGHT = 0.2;

/** Wood wall brown — interior underlay when planks have gaps. */
export const KENNEY_WOOD_WALL_COLOR = 0x875644;

/** Kenney GLB used as interior floor tile (1×1 cell). */
export const KENNEY_INTERIOR_FLOOR_MODULE = 'planks';

/** Diagnostic: paint city ground black (terrain bleed test). */
export const KENNEY_DEBUG_BLACK_GROUND = false;
