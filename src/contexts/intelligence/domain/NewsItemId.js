/**
 * Identifiant unique pour une dépêche.
 * @returns {string}
 */
export function createNewsItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `news-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
