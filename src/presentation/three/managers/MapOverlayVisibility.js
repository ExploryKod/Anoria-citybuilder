const STORAGE_KEY = 'anoria.mapFilters';

/**
 * The map filters: each one shows or hides a family of status icons over the buildings. They are independent — any of them can be on at once — and each
 * names the icons it governs (`sprites`: the names the asset manager gives them; each also has a `<name>-bg` background). The icon that says a building has
 * no road is in none of them: it goes as soon as a road is laid, so it is always shown.
 */
export const MAP_FILTERS = Object.freeze({
  // What is wrong: a building that cannot work, a good it cannot get, a sale that failed.
  alerts: Object.freeze({ label: 'Alertes', defaultOn: true, sprites: Object.freeze(['no-work', 'no-resource', 'input-shortage', 'hub-full', 'failed-sell']) }),
  // Where a producer is in its cycle.
  cycle: Object.freeze({ label: 'Cycle de production', defaultOn: true, sprites: Object.freeze(['fallow', 'grow-food', 'harvest', 'sell-food']) }),
  // Goods changing hands.
  exchanges: Object.freeze({ label: 'Échanges', defaultOn: true, sprites: Object.freeze(['isBuying', 'isCollecting', 'sold-to-hub']) }),
  // The business of a house (its cooperative's recipes): the same icons as a producer's, but they are no general alert, so a house shows them under this filter
  // only. Off at first: a new player does not know yet that houses trade.
  activities: Object.freeze({
    label: 'Activités des maisons',
    defaultOn: false,
    sprites: Object.freeze(['input-shortage', 'failed-sell', 'sold-to-hub', 'fallow', 'grow-food', 'harvest', 'sell-food']),
  }),
});

export const MAP_FILTER_IDS = Object.freeze(Object.keys(MAP_FILTERS));

/** @param {string} filterId @returns {string[]} the status sprites a filter governs, backgrounds included */
export function spriteNamesOfFilter(filterId) {
  return requireFilter(filterId).sprites.flatMap((name) => [name, `${name}-bg`]);
}

function requireFilter(filterId) {
  const filter = MAP_FILTERS[filterId];
  if (!filter) throw new Error(`[map filters] "${filterId}" is not a map filter (${MAP_FILTER_IDS.join(', ')})`);
  return filter;
}

/**
 * Presentation-only visibility of the status icons on the 3D map, one switch per filter. Domain BCs stay unaware: the scene ANDs a filter into the
 * `visible` of the sprites it governs. The choice is kept in the browser (a per-player convenience).
 */
export class MapOverlayVisibility {
  constructor() {
    /** @type {Set<string>} the filters that are on */
    this.active = readStoredActiveFilters();
    /** @type {((filterId: string, on: boolean) => void) | null} */
    this.onFilterChange = null;
  }

  /** @param {string} filterId */
  isOn(filterId) {
    requireFilter(filterId);
    return this.active.has(filterId);
  }

  /** @param {string} filterId @param {boolean} on */
  setOn(filterId, on) {
    requireFilter(filterId);
    const next = Boolean(on);
    if (next === this.active.has(filterId)) return;
    if (next) this.active.add(filterId);
    else this.active.delete(filterId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.active]));
    } catch {
      /* ignore quota / private mode */
    }
    this.onFilterChange?.(filterId, next);
  }
}

/** @returns {Set<string>} the filters the player left on; the ones that start on when nothing was kept (a new player) */
export function readStoredActiveFilters() {
  const initial = () => new Set(MAP_FILTER_IDS.filter((id) => MAP_FILTERS[id].defaultOn));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return initial();
    const kept = JSON.parse(raw);
    if (!Array.isArray(kept)) return initial();
    return new Set(kept.filter((id) => MAP_FILTER_IDS.includes(id)));
  } catch {
    return initial();
  }
}
