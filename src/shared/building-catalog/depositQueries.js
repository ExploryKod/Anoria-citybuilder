import { buildingCatalog } from './buildingCatalog.js';

/**
 * The natural deposits of the map, read from the catalog: which kinds exist, which building types hold them,
 * and which kinds the terrain itself carries. No deposit is named here (a tree's wood, a boulder's rock, the
 * clay of the ground are catalog facts): adding one is a catalog entry.
 */

/**
 * The kinds of deposit a building type holds: what it IS (`naturalResource`, a tree is wood) and what it
 * contains (`deposits`, a boulder holds rock, iron and gold), each counted in its own `stocks` field.
 * @param {string | null | undefined} buildingType
 * @returns {string[]}
 */
export function depositKindsOf(buildingType) {
  const definition = buildingCatalog[buildingType];
  return [...new Set([...(definition?.naturalResource ? [definition.naturalResource] : []), ...(definition?.deposits ?? [])])];
}

/**
 * The deposits the ground carries, per terrain type, as `{ kind, share }`: `share` of the tiles of that
 * terrain hold it.
 * @returns {Array<{ terrain: string, kind: string, share: number }>}
 */
export function listTileDeposits() {
  return Object.entries(buildingCatalog).flatMap(([terrain, definition]) =>
    Object.entries(definition.tileDeposits ?? {}).map(([kind, fact]) => ({ terrain, kind, share: fact.share }))
  );
}

/**
 * Every kind of deposit on the map, in catalog order: those held by nature buildings, then those of the ground.
 * @returns {string[]}
 */
export function listDepositKinds() {
  const kinds = [];
  for (const type of Object.keys(buildingCatalog)) kinds.push(...depositKindsOf(type));
  kinds.push(...listTileDeposits().map((deposit) => deposit.kind));
  return [...new Set(kinds)];
}

/**
 * The kinds of deposit some nature building holds (as opposed to the ground's).
 * @returns {string[]}
 */
export function listBuildingDepositKinds() {
  return [...new Set(Object.keys(buildingCatalog).flatMap(depositKindsOf))];
}
