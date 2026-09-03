/**
 * Static intelligence catalog for presentation (no getOrCreate). Live
 * news operations (generate/pay/archive) stay on
 * sessionApi / getOrCreateIntelligenceContext, composition-internal only.
 */
export { labelForNewsSource } from '../contexts/intelligence/domain/catalogs/NewsSourceCatalog.js';
export { labelForNewsCategory } from '../contexts/intelligence/domain/catalogs/NewsCategoryCatalog.js';
