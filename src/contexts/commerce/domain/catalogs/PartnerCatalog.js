import { getDefaultTradePrice } from './ProductCatalog.js';
import {
  validatePartnerCatalog,
  isMvpPartnerCatalog,
} from '../policies/PartnerCatalogIntegrityPolicy.js';

/**
 * @param {Array<object>} partners
 * @returns {Array<object>}
 */
function applyPartnerTradePrices(partners) {
  return partners.map((partner) => ({
    ...partner,
    buysFromUs: partner.buysFromUs.map((trade) => ({
      ...trade,
      pricePerUnit:
        trade.pricePerUnit ?? getDefaultTradePrice(trade.productId, 'export') ?? 0,
    })),
    sellsToUs: partner.sellsToUs.map((trade) => ({
      ...trade,
      pricePerUnit:
        trade.pricePerUnit ?? getDefaultTradePrice(trade.productId, 'import') ?? 0,
    })),
  }));
}

function createMvpPartnerSeed() {
  return [
    {
      id: 'olivea',
      name: 'Olivea',
      cityCategory: 'near-commercial',
      description: 'Cité méditerranéenne — achète bois et meubles, vend des figues',
      isActive: false,
      activationConditions: [
        'population_min_5',
        'unemployment_max_10',
      ],
      buysFromUs: [
        {
          productId: 'wood',
          productName: 'Bois brut',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 1,
          yearlyQuota: 25,
          currentYearly: 0,
        },
        {
          productId: 'furniture',
          productName: 'Meubles',
          months: [3, 4, 5, 6, 7, 8, 9],
          maxPerTurn: 1,
          yearlyQuota: 15,
          currentYearly: 0,
        },
      ],
      sellsToUs: [
        {
          productId: 'figs',
          productName: 'Figues',
          months: [6, 7, 8, 9, 10],
          yearlyQuota: 10,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'silvania',
      name: 'Silvania',
      cityCategory: 'far-commercial',
      description: 'Région forestière — achète des meubles',
      isActive: false,
      activationConditions: [],
      buysFromUs: [
        {
          productId: 'furniture',
          productName: 'Meubles',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 1,
          yearlyQuota: 15,
          currentYearly: 0,
        },
      ],
      sellsToUs: [],
    },
  ];
}

export function createDefaultPartners() {
  const partners = applyPartnerTradePrices(createMvpPartnerSeed());
  const validation = validatePartnerCatalog(partners);
  if (!validation.valid) {
    throw new Error(`Invalid partner catalog: ${validation.errors.join('; ')}`);
  }
  return partners;
}

/**
 * @param {Array<object>} partners
 * @returns {{ partners: Array<object>, needsSave: boolean }}
 */
export function normalizePartners(partners) {
  if (!isMvpPartnerCatalog(partners)) {
    return { partners: createDefaultPartners(), needsSave: true };
  }

  let needsSave = false;

  for (const partner of partners) {
    partner.buysFromUs?.forEach((trade) => {
      if (trade.pricePerUnit == null) {
        trade.pricePerUnit = getDefaultTradePrice(trade.productId, 'export') ?? 0;
        needsSave = true;
      }
      if (trade.currentYearly == null) {
        trade.currentYearly = 0;
        needsSave = true;
      }
    });

    partner.sellsToUs?.forEach((trade) => {
      if (trade.pricePerUnit == null) {
        trade.pricePerUnit = getDefaultTradePrice(trade.productId, 'import') ?? 0;
        needsSave = true;
      }
      if (trade.currentYearly == null) {
        trade.currentYearly = 0;
        needsSave = true;
      }
    });

    if (!partner.cityCategory) {
      const defaults = createMvpPartnerSeed();
      const seed = defaults.find((item) => item.id === partner.id);
      if (seed?.cityCategory) {
        partner.cityCategory = seed.cityCategory;
        needsSave = true;
      }
    }
  }

  const validation = validatePartnerCatalog(partners);
  if (!validation.valid) {
    return { partners: createDefaultPartners(), needsSave: true };
  }

  return { partners, needsSave };
}
