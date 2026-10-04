import { getResourceCategoryPresentation } from './ResourceCategoryCatalog.js';

/**
 * The VAT categories: the catalog's sectors of goods, each with its own rate. A good names its category in
 * ResourceCategoryCatalog (`vatCategory`); this file names the categories and reads the goods' assignment. Presentation
 * shows the labels from here, never a word of its own.
 */
export const VAT_CATEGORIES = Object.freeze({
  essential: Object.freeze({ label: 'Produits de première nécessité' }),
  craft: Object.freeze({ label: 'Produits artisanaux' }),
  other: Object.freeze({ label: 'Autres produits' }),
  luxury: Object.freeze({ label: 'Produits de luxe' }),
  art: Object.freeze({ label: "Œuvres d'art" }),
});

/** @returns {string[]} the VAT categories, in the order the catalog lists them. */
export function getVatCategories() {
  return Object.keys(VAT_CATEGORIES);
}

/** @param {string} category @returns {string} */
export function getVatCategoryLabel(category) {
  const entry = VAT_CATEGORIES[category];
  if (!entry) throw new Error(`[vat] "${category}" is not a VAT category`);
  return entry.label;
}

/**
 * The VAT category a good belongs to. Throws when the good declares none or an unknown one: a good without a category
 * would be taxed at no rate, which is a catalog defect.
 * @param {string} good
 * @returns {string}
 */
export function getGoodVatCategory(good) {
  const category = getResourceCategoryPresentation(good).vatCategory;
  if (!category || !Object.hasOwn(VAT_CATEGORIES, category)) {
    throw new Error(`[vat] "${good}" declares no VAT category in ResourceCategoryCatalog`);
  }
  return category;
}
