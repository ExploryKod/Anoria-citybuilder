/**
 * Declarative presentation facts for resource categories — icon + French
 * label, pure data. Every category any building declares in its
 * `resourceRoles` (see buildingEconomy.js) should have an entry here so a
 * generic UI (resource cards, hub storage) can render it without a
 * per-category branch in code. A category with no entry falls back to a
 * neutral placeholder in `getResourceCategoryPresentation`.
 */
export const RESOURCE_CATEGORY_PRESENTATION = Object.freeze({
  wheat: Object.freeze({ emoji: '🌾', label: 'Blé' }),
  cabbage: Object.freeze({ emoji: '🥬', label: 'Chou' }),
  carrot: Object.freeze({ emoji: '🥕', label: 'Carotte' }),
  fruit: Object.freeze({ emoji: '🍎', label: 'Fruits' }),
  game: Object.freeze({ emoji: '🦌', label: 'Gibier' }),
  dattes: Object.freeze({ emoji: '🌴', label: 'Dattes' }),
  wood: Object.freeze({ emoji: '🪵', label: 'Bois' }),
  food: Object.freeze({ emoji: '🍽️', label: 'Nourriture' }),
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
