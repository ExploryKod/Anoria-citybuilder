import {
  HAMLET_ACCESS,
  listHamletsWithAccess,
} from '../../../../core/persistence/hamlet/hamletAccess.js';
import {
  getActiveHamletId,
  PROTO_HAMLETS,
} from '../../../../core/persistence/hamlet/hamletSession.js';
import { getHamletMapSite } from '../../domain/catalogs/HamletMapCatalog.js';

/**
 * @returns {Promise<{
 *   activeHamletId: string,
 *   totalHamlets: number,
 *   unlockedCount: number,
 *   hamlets: Array<{
 *     id: string,
 *     name: string,
 *     access: 'active' | 'unlocked' | 'locked',
 *     natureSeeded?: boolean,
 *     canTravel: boolean,
 *     map: { x: number, y: number, labelAnchor?: string },
 *   }>,
 * }>}
 */
export async function buildHamletsMapView() {
  const hamletsWithAccess = await listHamletsWithAccess();
  const activeHamletId = getActiveHamletId();

  const hamlets = hamletsWithAccess.map((hamlet) => {
    const site = getHamletMapSite(hamlet.id);
    return {
      id: hamlet.id,
      name: hamlet.name,
      access: hamlet.access,
      natureSeeded: hamlet.natureSeeded,
      canTravel: hamlet.access === HAMLET_ACCESS.unlocked,
      map: {
        x: site?.x ?? 50,
        y: site?.y ?? 50,
        labelAnchor: site?.labelAnchor,
      },
    };
  });

  const unlockedCount = hamlets.filter((hamlet) => hamlet.access !== HAMLET_ACCESS.locked).length;

  return {
    activeHamletId,
    totalHamlets: PROTO_HAMLETS.length,
    unlockedCount,
    hamlets,
  };
}
