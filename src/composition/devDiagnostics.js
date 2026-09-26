import db from '../core/persistence/dexie/db.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';
import { evaluateRoadAccessByRange, footprintRect } from '../contexts/parcels/domain/policies/RoadAccessPolicy.js';
import { getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import { getRoadRange, requiresRoad } from '../shared/building-catalog/resourceRoleQueries.js';

/**
 * Dev-only diagnostics, triggered from the browser console by the developer (never called by the game).
 * The dev server appends what is sent to `dev-diagnostics.log` at the project root (see
 * scripts/dev/devLogPlugin.mjs), so it can be read without copying the console by hand.
 *
 * A console line that starts with a `[tag]` is relayed to the dev server too, and shown in the terminal
 * running `vite dev` when its tag is in `DEV_LOG_TAGS` — the game logs as it always did, with a tag.
 */

const TAG = /^\[([\w:-]+)\]/;

function textOf(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Relays every tagged `console.*` line to the dev server (the original console still gets it). */
export function installConsoleRelay() {
  if (window.__consoleRelayInstalled) return;
  window.__consoleRelayInstalled = true;

  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      const tag = typeof args[0] === 'string' ? TAG.exec(args[0])?.[1] : null;
      if (!tag) return;
      // Never let the relay itself log: a failure here must stay silent.
      fetch('/__dev-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'console', tag, level, message: args.map(textOf).join(' ') }),
        keepalive: true,
      }).catch(() => {});
    };
  }
}

/**
 * @param {string} label
 * @param {unknown} data
 */
export async function sendDevLog(label, data) {
  const response = await fetch('/__dev-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, data }),
  });
  if (!response.ok) throw new Error(`dev-log refused (${response.status})`);
}

/**
 * Every building the way the game judges its road, next to what its mesh shows: the persisted road count,
 * the count recomputed from the road tiles, the footprint, and the status sprites currently on the mesh.
 * @param {{ buildings?: Array<Array<import('three').Object3D | undefined>> } | null} scene
 */
async function collectRoadAccess(scene) {
  const rows = (await db.houses.toArray()).filter(isActiveHamletRow);
  const roadTiles = rows
    .filter((row) => typeof row.type === 'string' && row.type.startsWith('StonePath-') && row.x != null && row.y != null)
    .map((row) => ({ x: row.x, y: row.y }));

  const meshes = new Map();
  for (const column of scene?.buildings ?? []) {
    for (const mesh of column ?? []) {
      const id = mesh?.userData?.instanceId;
      if (!id) continue;
      meshes.set(id, {
        catalogId: mesh.userData.catalogId ?? null,
        meshType: mesh.userData.type ?? null,
        hasRoadAccess: mesh.userData.hasRoadAccess ?? null,
        isUnderstaffed: mesh.userData.isUnderstaffed ?? null,
        sprites: mesh.children.filter((child) => child.type === 'Sprite').map((sprite) => `${sprite.name}${sprite.visible ? '' : ' (hidden)'}`),
      });
    }
  }

  const buildings = rows
    .filter((row) => row.x != null && row.y != null && !row.type?.startsWith('StonePath-'))
    .filter((row) => getBuildingDefinition(row.type)?.construction?.category !== 'nature')
    .map((row) => {
      const building = { type: row.type, x: row.x, y: row.y, rotationStep: row.placementRotationStep ?? 0 };
      const computed = evaluateRoadAccessByRange(building, roadTiles);
      const mesh = meshes.get(row.instanceId ?? row.id) ?? null;
      return {
        id: row.instanceId ?? row.id,
        ...building,
        footprint: footprintRect(building),
        requiresRoad: requiresRoad(row.type),
        roadRange: getRoadRange(row.type),
        persistedRoads: row.roads ?? 0,
        computedRoads: computed.roadCount,
        disagree: (row.roads ?? 0) > 0 !== computed.hasAccess,
        mesh,
      };
    });

  return { roadTiles, buildings };
}

/**
 * Adds `dumpRoadAccess()` to the console. It sends the picture above to the dev log, once per call.
 * @param {{ getScene: () => object | null }} deps
 */
export function registerDevDiagnostics({ getScene }) {
  window.dumpRoadAccess = async () => {
    const data = await collectRoadAccess(getScene());
    await sendDevLog('road-access', data);
    console.info(`[dev] road-access sent: ${data.buildings.length} buildings, ${data.roadTiles.length} road tiles → dev-diagnostics.log`);
  };
}
