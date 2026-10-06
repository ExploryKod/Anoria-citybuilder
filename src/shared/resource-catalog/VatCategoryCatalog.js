import {
  getGoodCategories,
  getResourceCategoryPresentation,
  getServiceCategories,
} from './ResourceCategoryCatalog.js';

/**
 * The VAT categories. The goods are split into sectors, each with its own rate; the services are one nature of their own
 * (prestations), with one rate. A good or a service names its category in ResourceCategoryCatalog (`vatCategory`); this
 * file names the categories and reads the assignment. Presentation shows the labels from here, never a word of its own.
 */
export const VAT_CATEGORIES = Object.freeze({
  essential: Object.freeze({ label: 'Produits de première nécessité' }),
  craft: Object.freeze({ label: 'Produits artisanaux' }),
  other: Object.freeze({ label: 'Autres produits' }),
  luxury: Object.freeze({ label: 'Produits de luxe' }),
  art: Object.freeze({ label: "Œuvres d'art" }),
  service: Object.freeze({ label: 'Prestations de service' }),
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

/** @returns {string[]} every item the VAT taxes: the goods a house buys and the services it receives. */
export function getVatItems() {
  return [...getGoodCategories(), ...getServiceCategories()];
}

/** @param {string} category @returns {string[]} the items of one VAT category. */
export function getVatItemsOf(category) {
  return getVatItems().filter((item) => getVatCategoryOf(item) === category);
}

/**
 * The VAT category a good or a service belongs to. Throws when the good declares none or an unknown one: a good without a category
 * would be taxed at no rate, which is a catalog defect.
 * @param {string} item
 * @returns {string}
 */
export function getVatCategoryOf(item) {
  const category = getResourceCategoryPresentation(item).vatCategory;
  if (!category || !Object.hasOwn(VAT_CATEGORIES, category)) {
    throw new Error(`[vat] "${item}" declares no VAT category in ResourceCategoryCatalog`);
  }
  return category;
}
