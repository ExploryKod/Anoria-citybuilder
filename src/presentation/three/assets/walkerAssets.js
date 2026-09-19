/**
 * DECLARATIVE WALKER ASSET DATA — objects only, no functions.
 *
 * Which 3D character a walker uses, and how it is presented. Swapping a
 * character for another (or changing its size, height, facing or animation
 * names) is an edit here — no engine code.
 *
 * Two levels, mirroring how the building catalogs work:
 *  - WALKER_ASSETS: one entry per visual (one GLB): where the model is, how it
 *    is placed and which animation clips play for each role.
 *  - WALKER_TYPES: a logical walker type — the `walkerType` a domain event
 *    declares in shared/gameplay/walkerEventCatalog.js — mapped to the pool of
 *    visuals it can use and how one is picked, so the gameplay catalog never
 *    names a model.
 *
 * Field notes (WALKER_ASSETS):
 *  - geometry.glb: full public URL of the GLB (skinned, animations embedded).
 *  - transform.scale: uniform scale of the model (1 = the GLB's own size; tile = 1 unit).
 *  - transform.rotationDeg.y: facing correction in degrees — the walker code
 *    orients the character toward its walking direction assuming the model
 *    faces +Z; set this if a model faces another way.
 *  - transform.positionOffsetY: feet height above the world platform (0.2),
 *    so the character stands ON the road surface, not inside it.
 *  - animations: for each role the engine uses ('idle', 'walk'), the clip
 *    names to look for in the GLB, in priority order.
 *
 * Field notes (WALKER_TYPES):
 *  - appearances: ids of WALKER_ASSETS entries this type may spawn.
 *  - pick: 'sequence' (deterministic round-robin through the pool) or 'random'.
 */

const MINI_CHARACTERS = '/resources/kenney_mini-characters/Models/GLB format/';

export const WALKER_ASSETS = Object.freeze({
  'citizen-male-a': {
    geometry: { glb: `${MINI_CHARACTERS}character-male-a.glb` },
    transform: { rotationDeg: { y: 0 }, positionOffsetY: 0.07, scale: 0.5 },
    animations: { idle: ['idle'], walk: ['walk'] },
    tags: ['citizen'],
  },
  'citizen-female-a': {
    geometry: { glb: `${MINI_CHARACTERS}character-female-a.glb` },
    transform: { rotationDeg: { y: 0 }, positionOffsetY: 0.07, scale: 0.5 },
    animations: { idle: ['idle'], walk: ['walk'] },
    tags: ['citizen'],
  },
  'citizen-male-c': {
    geometry: { glb: `${MINI_CHARACTERS}character-male-c.glb` },
    transform: { rotationDeg: { y: 0 }, positionOffsetY: 0.07, scale: 0.5 },
    animations: { idle: ['idle'], walk: ['walk'] },
    tags: ['citizen'],
  },
});

export const WALKER_TYPES = Object.freeze({
  citizen: {
    appearances: ['citizen-male-a', 'citizen-female-a', 'citizen-male-c'],
    pick: 'sequence',
  },
});
