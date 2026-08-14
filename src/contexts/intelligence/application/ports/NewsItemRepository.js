/**
 * @typedef {import('../../domain/NewsItem.js').NewsItem} NewsItem
 *
 * @typedef {object} NewsItemRepository
 * @property {(item: NewsItem) => Promise<void>} save
 * @property {(id: string) => Promise<NewsItem | null>} getById
 * @property {(id: string) => Promise<void>} deleteById
 * @property {(turn: number, sourceId: string) => Promise<boolean>} hasAnyForTurnAndSource
 * @property {() => Promise<NewsItem[]>} listIncoming
 * @property {() => Promise<NewsItem[]>} listArchived
 */

export {};
