/**
 * Static trade-map catalog for presentation (no getOrCreate). Live commerce
 * operations stay on commerceOps.js, composition-internal only.
 */
export {
  TRADE_MAP_CITY_CATEGORIES,
  TRADE_MAP_CITY_CATEGORY_LABELS,
  TRADE_MAP_CITIES,
  TRADE_MAP_CONNECTIONS,
  cityHasCommercialRoute,
  cityShowsOnTradeMapRoutes,
  getTradeMapCityById,
  getTradeMapCityByPartnerId,
} from '../contexts/commerce/domain/catalogs/TradeMapCityCatalog.js';
