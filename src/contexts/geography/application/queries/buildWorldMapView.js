import { buildTradePartnersView } from '../../../commerce/application/queries/GetTradePartnersView.js';
import {
  TRADE_MAP_CITIES,
  TRADE_MAP_CONNECTIONS,
} from '../../../commerce/domain/catalogs/TradeMapCityCatalog.js';
import { WORLD_KINGDOM } from '../../domain/catalogs/WorldMapCatalog.js';
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

  const cities = TRADE_MAP_CITIES.map((city) => ({
    id: city.id,
    name: city.name,
    category: city.category,
    description: city.description,
    labelAnchor: city.labelAnchor,
    partnerId: city.partnerId ?? null,
    map: { x: city.x, y: city.y },
    partner: city.partnerId
      ? partnerViews.find((item) => item.id === city.partnerId) ?? null
      : null,
  }));

  return {
    kingdom: {
      id: WORLD_KINGDOM.id,
      name: WORLD_KINGDOM.name,
      map: { ...WORLD_KINGDOM.map },
      hamletsPagePath: WORLD_KINGDOM.hamletsPagePath,
      influence,
      unlockedHamlets: hamletsView.unlockedCount,
      totalHamlets: hamletsView.totalHamlets,
    },
    cities,
    connections: TRADE_MAP_CONNECTIONS,
    partners: partnerViews,
  };
}
