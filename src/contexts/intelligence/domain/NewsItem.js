/**
 * Factory / normalisation d'un NewsItem.
 *
 * @typedef {object} NewsItem
 * @property {string} id
 * @property {number} turn
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
 * @property {string | null} [hamletId] the hamlet it belongs to, written by the repository when it saves the item
 * @property {{ kind: 'buildTool', toolId: string } | null} [action] a button the dépêche carries (see NewsEventModal.js for the kinds it knows)
 */

/**
 * @param {Partial<NewsItem> & Pick<NewsItem, 'id' | 'turn' | 'sourceId' | 'categoryId' | 'title' | 'body'>} raw
 * @returns {NewsItem}
 */
export function createNewsItem(raw) {
  return {
    id: raw.id,
    turn: Number(raw.turn) || 0,
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
    // The hamlet the repository filed it under (set when it is saved); the modal and the archives name it.
    hamletId: raw.hamletId ?? null,
    // What the dépêche offers to do once read (a button on it): `{ kind: 'buildTool', toolId }` picks that building to place. Null for a plain dépêche.
    action: raw.action ?? null,
  };
}
