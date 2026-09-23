/**
 * Declarative presentation facts for resource categories — icon + French
 * label + optional chart colors (`dark` = current stock, `pale` = free
 * room), pure data. This is the ONLY place a good gets a name or a color:
 * no other file may spell one out. Every category any building declares in its
 * `resourceRoles` (see buildingEconomy.js) should have an entry here so a
 * generic UI (resource cards, hub storage) can render it without a
 * per-category branch in code. A category with no entry falls back to a
 * neutral placeholder in `getResourceCategoryPresentation`.
 */
export const RESOURCE_CATEGORY_PRESENTATION = Object.freeze({
  wheat: Object.freeze({ emoji: '🌾', label: 'Blé', colors: Object.freeze({ dark: '#F9A825', pale: '#FFF59D' }) }),
  cabbage: Object.freeze({ emoji: '🥬', label: 'Chou', colors: Object.freeze({ dark: '#388E3C', pale: '#A5D6A7' }) }),
  carrot: Object.freeze({ emoji: '🥕', label: 'Carotte', colors: Object.freeze({ dark: '#EF6C00', pale: '#FFCC80' }) }),
  fruit: Object.freeze({ emoji: '🍎', label: 'Fruits' }),
  game: Object.freeze({ emoji: '🦌', label: 'Gibier' }),
  dattes: Object.freeze({ emoji: '🌴', label: 'Dattes', colors: Object.freeze({ dark: '#795548', pale: '#D7CCC8' }) }),
  wood: Object.freeze({ emoji: '🪵', label: 'Bois', colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  food: Object.freeze({ emoji: '🍽️', label: 'Nourriture' }),
  furniture: Object.freeze({ emoji: '🪑', label: 'Meuble' }),
  plate: Object.freeze({ emoji: '🍽️', label: 'Plat' }),
  pot: Object.freeze({ emoji: '🍲', label: 'Pot' }),
  amphora: Object.freeze({ emoji: '🏺', label: 'Amphore' }),
  faith: Object.freeze({ emoji: '🙏', label: 'Foi' }),
  school: Object.freeze({ emoji: '🎓', label: 'École' }),
  library: Object.freeze({ emoji: '📖', label: 'Bibliothèque' }),
  doctor: Object.freeze({ emoji: '🩺', label: 'Cabinet médical' }),
  hospital: Object.freeze({ emoji: '🏥', label: 'Hôpital' }),
  publicBath: Object.freeze({ emoji: '🛁', label: 'Bains publics' }),
  theatre: Object.freeze({ emoji: '🎭', label: 'Théâtre' }),
  cinema: Object.freeze({ emoji: '🎬', label: 'Cinéma' }),
  pub: Object.freeze({ emoji: '🍺', label: 'Taverne' }),
});

/**
 * @param {string} category
 * @returns {{ emoji: string, label: string }}
 */
export function getResourceCategoryPresentation(category) {
  return RESOURCE_CATEGORY_PRESENTATION[category] ?? { emoji: '📦', label: category };
}

/** Neutral chart colors for a category that declares none. */
const FALLBACK_COLORS = Object.freeze({ dark: '#546E7A', pale: '#B0BEC5' });

/**
 * @param {string} category
 * @returns {{ dark: string, pale: string }}
 */
export function getResourceCategoryColors(category) {
  return RESOURCE_CATEGORY_PRESENTATION[category]?.colors ?? FALLBACK_COLORS;
}
