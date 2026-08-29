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
 *     map: { hex: { q: number, r: number }, sprite: string, labelAnchor?: string },
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
        hex: { q: site?.q ?? 0, r: site?.r ?? 0 },
        sprite: site?.sprite ?? 'hamlet',
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
