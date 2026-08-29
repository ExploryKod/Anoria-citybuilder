import { buildTradePartnersView } from '../../../commerce/application/queries/GetTradePartnersView.js';
import {
  TRADE_MAP_CITIES,
  TRADE_MAP_CONNECTIONS,
} from '../../../commerce/domain/catalogs/TradeMapCityCatalog.js';
import { DEFAULT_HAMLET_ID } from '../../../../core/persistence/hamlet/hamletSession.js';
import { WORLD_KINGDOM } from '../../domain/catalogs/WorldMapCatalog.js';
import { getWorldCityHexSite } from '../../domain/catalogs/WorldCityHexCatalog.js';
import { buildHamletsMapView } from './buildHamletsMapView.js';

/**
 * @param {{
 *   commerceApi: {
 *     loadOrSeedCommercePartners: () => Array<object>,
 *     loadCommerceStats: () => object,
 *     loadOrSeedCommerceConfig: () => Array<object>,
 *   },
 *   activationByPartnerId: Record<string, { canActivate: boolean, unmetConditions: string[] }>,
 * }} deps
 */
export async function buildWorldMapView({ commerceApi, activationByPartnerId }) {
  const partners = commerceApi.loadOrSeedCommercePartners();
  const stats = commerceApi.loadCommerceStats();
  const productConfig = commerceApi.loadOrSeedCommerceConfig();
  const partnerViews = buildTradePartnersView({
    partners,
    stats,
    productConfig,
    activationByPartnerId,
  });

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

  const cities = TRADE_MAP_CITIES.map((city) => {
    const hexSite = getWorldCityHexSite(city.id);
    return {
      id: city.id,
      name: city.name,
      category: city.category,
      description: city.description,
      labelAnchor: city.labelAnchor,
      partnerId: city.partnerId ?? null,
      map: {
        x: city.x,
        y: city.y,
        hex: hexSite ? { q: hexSite.q, r: hexSite.r } : null,
        sprite: hexSite?.sprite ?? null,
      },
      partner: city.partnerId
        ? partnerViews.find((item) => item.id === city.partnerId) ?? null
        : null,
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
    connections: TRADE_MAP_CONNECTIONS,
    partners: partnerViews,
  };
}
