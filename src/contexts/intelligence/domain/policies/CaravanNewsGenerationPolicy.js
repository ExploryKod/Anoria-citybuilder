import { CARAVAN_NEWS_PRICE } from './CaravanNewsAccessPolicy.js';

/**
 * Planifie 0–1 dépêche caravane (Phase 2).
 *
 * @param {object} params
 * @param {number} params.turn
 * @param {() => number} [params.rng]
 * @returns {Array<{
 *   sourceId: 'caravan',
 *   categoryId: string,
 *   title: string,
 *   body: string,
 *   teaser: string,
 *   revelation: 'unpaid',
 *   price: number,
 * }>}
 */
export function planCaravanNewsDrafts({ turn, rng = Math.random }) {
  void turn;
  // Une chance élevée si éligible (gates déjà validés par l'appelant)
  if (rng() >= 0.7) {
    return [];
  }

  const roll = rng();
  if (roll < 0.34) {
    return [
      {
        sourceId: 'caravan',
        categoryId: 'trade_rumor',
        title: 'Rumeur sur les marchés étrangers',
        body: 'Un commerçant de passage affirme que le blé se vend cher chez un partenaire voisin. Vérifiez vos stocks avant d’ouvrir de nouveaux échanges.',
        teaser: 'Un caravanier murmure des nouvelles des routes…',
        revelation: 'unpaid',
        price: CARAVAN_NEWS_PRICE,
      },
    ];
  }
  if (roll < 0.67) {
    return [
      {
        sourceId: 'caravan',
        categoryId: 'partner_news',
        title: 'Tension chez un partenaire',
        body: 'Des voyageurs rapportent des troubles politiques chez l’un de vos partenaires commerciaux. Les prochaines caravanes pourraient être moins régulières.',
        teaser: 'Des nouvelles inquiétantes arrivent avec les mulets…',
        revelation: 'unpaid',
        price: CARAVAN_NEWS_PRICE,
      },
    ];
  }
  return [
    {
      sourceId: 'caravan',
      categoryId: 'foreign_market',
      title: 'Opportunité sur un marché extérieur',
      body: 'Un négociant propose une piste d’export rentable pour le bois, si vos granges et quotas le permettent. L’information seule ne crée pas le contrat.',
      teaser: 'Un négociant veut vendre une information…',
      revelation: 'unpaid',
      price: CARAVAN_NEWS_PRICE,
    },
  ];
}
