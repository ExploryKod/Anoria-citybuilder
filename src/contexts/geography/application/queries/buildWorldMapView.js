import {
  WORLD_CITIES,
  WORLD_CITY_CONNECTIONS,
} from '../../domain/catalogs/WorldCityCatalog.js';
import { DEFAULT_HAMLET_ID } from '../../../../core/persistence/hamlet/hamletSession.js';
import { WORLD_KINGDOM } from '../../domain/catalogs/WorldMapCatalog.js';
import { getWorldCityHexSite } from '../../domain/catalogs/WorldCityHexCatalog.js';
import { buildHamletsMapView } from './buildHamletsMapView.js';

export async function buildWorldMapView() {
  const hamletsView = await buildHamletsMapView();
  const influence = hamletsView.totalHamlets > 0
    ? hamletsView.unlockedCount / hamletsView.totalHamlets
    : 0;

  /** Satellite hamlets around Anoria (castle = eraanurbs at centre, not duplicated). */
  const hamlets = hamletsView.hamlets
    .filter((hamlet) => hamlet.id !== DEFAULT_HAMLET_ID)
    .map((hamlet) => ({
      id: hamlet.id,
      name: hamlet.name,
      access: hamlet.access,
      natureSeeded: hamlet.natureSeeded,
      canTravel: hamlet.canTravel,
      map: {
        hex: hamlet.map.hex,
        sprite: hamlet.map.sprite,
      },
    }));

  const cities = WORLD_CITIES.map((city) => {
    const hexSite = getWorldCityHexSite(city.id);
    return {
      id: city.id,
      name: city.name,
      category: city.category,
      description: city.description,
      labelAnchor: city.labelAnchor,
      map: {
        x: city.x,
        y: city.y,
        hex: hexSite ? { q: hexSite.q, r: hexSite.r } : null,
        sprite: hexSite?.sprite ?? null,
      },
    };
  });

  return {
    kingdom: {
      id: WORLD_KINGDOM.id,
      name: WORLD_KINGDOM.name,
      map: { ...WORLD_KINGDOM.map },
      activeHamletId: hamletsView.activeHamletId,
      influence,
      unlockedHamlets: hamletsView.unlockedCount,
      totalHamlets: hamletsView.totalHamlets,
    },
    hamlets,
    cities,
    connections: WORLD_CITY_CONNECTIONS,
  };
}
