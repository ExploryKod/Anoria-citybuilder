import { setRoadAccessIcon } from '../../../../js/game/modules/StatusIconHelper.js';

/** buildingId → { mesh, position, scale } — pour mettre à jour l'icône quand le bus publie un changement */
const views = new Map();

/**
 * Branche le rendu des icônes "no-road" sur le bus Parcels.
 * Retourne une fonction à appeler depuis scene.js à chaque tick.
 */
export function setupRoadAccessIcons(parcels, { assetManager, textures }) {
  parcels.eventPublisher.subscribe('parcels.RoadAccessChanged', (event) => {
    const view = views.get(event.buildingId);
    if (!view?.mesh) return;

    setRoadAccessIcon({
      assetManager,
      mesh: view.mesh,
      textures,
      position: view.position,
      scale: view.scale,
      hasAccess: event.hasAccess,
    });
  });

  return async function syncRoadAccess({ buildingId, mesh, position, scale }) {
    if (mesh) {
      views.set(buildingId, { mesh, position, scale });
    }

    const result = await parcels.recalculateRoadAccessForBuilding.execute(buildingId);
    const hasAccess = result?.roadAccess?.hasAccess ?? false;
    const roadCount = result?.roadAccess?.roadCount ?? 0;

    if (mesh && !result?.updated) {
      setRoadAccessIcon({ assetManager, mesh, textures, position, scale, hasAccess });
    }

    return { hasAccess, roadCount };
  };
}

/** @internal Tests uniquement */
export function clearRoadAccessIconViews() {
  views.clear();
}
