import { setRoadAccessIcon } from './roadAccessSprite.js';

/** instanceId → { mesh, position, scale } — pour mettre à jour l'icône quand le bus publie un changement */
const views = new Map();

/** instanceId → last judgement logged, so a line is written only when it changes (dev only). */
const logged = new Map();

/**
 * Dev only: one tagged line whenever a building's road judgement changes, so it can be followed from the
 * terminal (`pnpm console:tag road-access --follow`) without typing anything in the browser console.
 */
function logRoadJudgement(source, instanceId, mesh, hasAccess, roadCount) {
  if (!import.meta.env?.DEV) return;
  const state = `${hasAccess}:${roadCount}`;
  if (logged.get(instanceId) === state) return;
  logged.set(instanceId, state);
  const { catalogId, x, y } = mesh?.userData ?? {};
  console.info(
    `[road-access] ${catalogId ?? '?'}@${x},${y} roadCount=${roadCount} hasAccess=${hasAccess} icon=${hasAccess ? 'hidden' : 'shown'} via=${source}`
  );
}

/**
 * Branche le rendu des icônes "no-road" sur le bus Parcels.
 * Retourne une fonction à appeler depuis scene.js à chaque tick.
 */
export function setupRoadAccessIcons(parcels, { assetManager, textures }) {
  parcels.eventPublisher.subscribe('parcels.RoadAccessChanged', (event) => {
    const view = views.get(event.instanceId);
    if (!view?.mesh) return;

    logRoadJudgement('event', event.instanceId, view.mesh, event.hasAccess, event.newRoadCount);
    // The mesh carries the judgement the other status icons read: kept in step here, since a mesh already known is not recalculated by the sync below.
    if (view.mesh.userData) view.mesh.userData.hasRoadAccess = event.hasAccess;
    setRoadAccessIcon({
      assetManager,
      mesh: view.mesh,
      textures,
      position: view.position,
      scale: view.scale,
      hasAccess: event.hasAccess,
    });
  });

  syncRoadAccess.forget = forgetRoadAccessView;
  return syncRoadAccess;

  /**
   * Whoever takes the road icon off a mesh (a building about to collapse shows that alone) says so: the next sync judges the building again and puts the icon back.
   * @param {string} instanceId
   */
  function forgetRoadAccessView(instanceId) {
    views.delete(instanceId);
  }

  async function syncRoadAccess({ instanceId, mesh, position, scale }) {
    // A mesh already known has its icon kept up to date by the event above: every placement, every removal and every day recalculate the road access of the whole
    // city and publish what changed. Only a new mesh (just placed, or redrawn after an evolution) needs its first judgement here. Recalculating every building at every
    // sweep of the scene, twice a day, was the scene's biggest cost (two reads of the database per building).
    if (mesh && views.get(instanceId)?.mesh === mesh) return null;
    if (mesh) {
      views.set(instanceId, { mesh, position, scale });
    }

    const result = await parcels.recalculateRoadAccessForBuilding.execute(instanceId);
    const hasAccess = result?.roadAccess?.hasAccess ?? false;
    const roadCount = result?.roadAccess?.roadCount ?? 0;

    logRoadJudgement('sync', instanceId, mesh, hasAccess, roadCount);

    // Recorded even when the bus already updated the icon (`result.updated`).
    if (mesh?.userData) {
      mesh.userData.hasRoadAccess = hasAccess;
    }

    if (mesh && !result?.updated) {
      setRoadAccessIcon({ assetManager, mesh, textures, position, scale, hasAccess });
    }

    return { hasAccess, roadCount };
  }
}

/** @internal Tests uniquement */
export function clearRoadAccessIconViews() {
  views.clear();
}
