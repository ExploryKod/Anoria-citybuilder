/**
 * Generic resource stock mechanic: a set of named categories plus a synced
 * total, shared by every circuit (food, factory goods, ...). A circuit picks
 * its own category list and its own name for the total field.
 *
 * @param {Record<string, number>} [raw]
 * @param {readonly string[]} categories
 * @param {string} [totalKey]
 * @returns {Readonly<Record<string, number>>}
 */
export function createResourceStock(raw = {}, categories, totalKey = 'total') {
  const values = {};
  for (const category of categories) {
    values[category] = nonNegInt(raw[category]);
  }
  const explicitTotal = raw[totalKey];
  const total =
    explicitTotal === undefined || explicitTotal === null
      ? categories.reduce((sum, category) => sum + values[category], 0)
      : nonNegInt(explicitTotal);

  return Object.freeze({ ...values, [totalKey]: total });
}

export function getCategoryAmount(stock, category) {
  return stock?.[category] ?? 0;
}

/**
 * Remove units from one category; sync the total downward.
 */
export function takeCategoryAmount(stock, category, amount, categories, totalKey = 'total') {
  const n = nonNegInt(amount);
  const current = createResourceStock(stock, categories, totalKey);
  const available = getCategoryAmount(current, category);
  const taken = Math.min(available, n);
  return createResourceStock(
    {
      ...current,
      [category]: available - taken,
      [totalKey]: Math.max(0, current[totalKey] - taken),
    },
    categories,
    totalKey,
  );
}

/**
 * Add units to one category; sync the total upward (caller may cap separately).
 */
export function addCategoryAmount(stock, category, amount, categories, totalKey = 'total') {
  const n = nonNegInt(amount);
  const current = createResourceStock(stock, categories, totalKey);
  return createResourceStock(
    {
      ...current,
      [category]: getCategoryAmount(current, category) + n,
      [totalKey]: current[totalKey] + n,
    },
    categories,
    totalKey,
  );
}

/**
 * Drain up to `amount` units from the aggregate total, taking from whichever
 * categories have stock (in declared order) rather than a specific one —
 * for a need that only cares about the total (e.g. "fed or not"), not which
 * category satisfied it. Also reports which categories actually contributed
 * (`categoriesTaken`) — e.g. a house drawing from both `wheat` and `carrot`
 * this period, for a "diet variety" need that DOES care how many distinct
 * categories were involved (see HouseTierRequirementPolicy.js's
 * `goodsVariety` kind).
 *
 * @param {Record<string, number>} stock
 * @param {readonly string[]} categories
 * @param {string} totalKey
 * @param {number} amount
 * @returns {{ nextStock: Readonly<Record<string, number>>, taken: number, categoriesTaken: string[] }}
 */
export function takeAcrossCategories(stock, categories, totalKey, amount) {
  let remaining = nonNegInt(amount);
  let current = createResourceStock(stock, categories, totalKey);
  const categoriesTaken = [];
  for (const category of categories) {
    if (remaining <= 0) break;
    const available = getCategoryAmount(current, category);
    const taken = Math.min(available, remaining);
    if (taken > 0) {
      current = takeCategoryAmount(current, category, taken, categories, totalKey);
      remaining -= taken;
      categoriesTaken.push(category);
    }
  }
  return { nextStock: current, taken: nonNegInt(amount) - remaining, categoriesTaken };
}

/**
 * Cap the total at maxTotal; scale all categories down proportionally if needed.
 */
export function capResourceStockAt(stock, maxTotal, categories, totalKey = 'total') {
  const cap = nonNegInt(maxTotal);
  const normalized = createResourceStock(stock, categories, totalKey);
  if (normalized[totalKey] <= cap) {
    return normalized;
  }

  const totalUnits = categories.reduce(
    (sum, category) => sum + getCategoryAmount(normalized, category),
    0,
  );
  if (totalUnits <= 0) {
    return createResourceStock({ ...normalized, [totalKey]: cap }, categories, totalKey);
  }

  const factor = cap / normalized[totalKey];
  const next = {};
  for (const category of categories) {
    next[category] = Math.round(getCategoryAmount(normalized, category) * factor);
  }
  return createResourceStock(next, categories, totalKey);
}

function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
