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
 * @property {Array<string | { src: string, label: string }>} [illustrations] pictures under the text: a building id, or `{ src, label }` for a picture of the tutorial's own
 * @property {{ src: string, alt: string } | null} [image] a picture shown under the text
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
    // Buildings the dépêche shows as pictures under its text (ids of the building catalog); empty for a plain dépêche.
    illustrations: raw.illustrations ?? [],
    // A picture shown under the text (a screenshot that points at the interface): `{ src, alt }`; null for a dépêche with none.
    image: raw.image ?? null,
    // What the reader can open inside the dépêche, a page at a time: `choices` are buttons ({ label, page }), `next` is the page "Lire la suite" opens.
    // A page is { body, action, illustrations, image, legend, choices, next }.
    // Set when the player removes a dépêche from the tutorial's history: it stays filed (the once-only rule still knows it), but that list no longer shows it.
    hidden: raw.hidden === true,
    // A blocking dépêche cannot be closed: its button is the only way out, and it comes back until what it asks is done (see NewsEventModal.js).
    blocking: raw.blocking === true,
    // Small icons of the interface with a word each, shown under the text: `[{ icon, word }]` (the icon is a key the modal knows).
    legend: raw.legend ?? [],
    choices: raw.choices ?? [],
    next: raw.next ?? null,
  };
}
