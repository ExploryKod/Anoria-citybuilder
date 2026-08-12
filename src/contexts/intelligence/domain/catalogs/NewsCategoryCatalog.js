/**
 * Catalogue des catégories de dépêches (MVP ville + stubs).
 */

/** @typedef {'complaint' | 'revelation' | 'scholar_idea' | 'trade_rumor' | 'partner_news' | 'foreign_market' | 'random_event' | 'advice' | 'situation_report'} NewsCategoryId */

/** @type {Record<string, { id: string, labelFr: string }>} */
export const NEWS_CATEGORIES = Object.freeze({
  complaint: { id: 'complaint', labelFr: 'Plainte' },
  revelation: { id: 'revelation', labelFr: 'Révélation' },
  scholar_idea: { id: 'scholar_idea', labelFr: 'Idée de savant' },
  trade_rumor: { id: 'trade_rumor', labelFr: 'Rumeur commerciale' },
  partner_news: { id: 'partner_news', labelFr: 'Nouvelle partenaire' },
  foreign_market: { id: 'foreign_market', labelFr: 'Marché extérieur' },
  random_event: { id: 'random_event', labelFr: 'Événement' },
  advice: { id: 'advice', labelFr: 'Conseil' },
  situation_report: { id: 'situation_report', labelFr: 'Rapport' },
});

/**
 * @param {string} categoryId
 * @returns {string}
 */
export function labelForNewsCategory(categoryId) {
  return NEWS_CATEGORIES[categoryId]?.labelFr ?? categoryId;
}
