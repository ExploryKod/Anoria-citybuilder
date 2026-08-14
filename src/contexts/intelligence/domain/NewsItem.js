/**
 * Factory / normalisation d'un NewsItem.
 *
 * @typedef {object} NewsItem
 * @property {string} id
 * @property {number} turn
 * @property {string} [announcedAtIso]
 * @property {string} sourceId
 * @property {string} categoryId
 * @property {string} title
 * @property {string} body
 * @property {string} [teaser]
 * @property {'trusted' | 'uncertain' | 'biased'} [reliability]
 * @property {object} [payload]
 * @property {{ requiresAssets?: object[], price?: number }} access
 * @property {'incoming' | 'archived'} lifecycle
 * @property {'free' | 'unpaid' | 'revealed'} revelation
 * @property {number | null} [readAtTurn]
 */

/**
 * @param {Partial<NewsItem> & Pick<NewsItem, 'id' | 'turn' | 'sourceId' | 'categoryId' | 'title' | 'body'>} raw
 * @returns {NewsItem}
 */
export function createNewsItem(raw) {
  return {
    id: raw.id,
    turn: Number(raw.turn) || 0,
    announcedAtIso: raw.announcedAtIso ?? null,
    sourceId: raw.sourceId,
    categoryId: raw.categoryId,
    title: raw.title,
    body: raw.body,
    teaser: raw.teaser ?? null,
    reliability: raw.reliability ?? null,
    payload: raw.payload ?? null,
    access: {
      requiresAssets: raw.access?.requiresAssets ?? [],
      ...(raw.access?.price != null ? { price: raw.access.price } : {}),
    },
    lifecycle: raw.lifecycle === 'archived' ? 'archived' : 'incoming',
    revelation: raw.revelation === 'unpaid' || raw.revelation === 'revealed' ? raw.revelation : 'free',
    readAtTurn: raw.readAtTurn ?? null,
  };
}
