import { getBuildingDefinition } from './buildingCatalog.js';

/**
 * A building type that lists `companies` in the catalog (the insurance building) is one company per building: the id of the company a building is
 * stays on its row (`companyId`), chosen when it is placed. The place of a company is free again when its building is gone.
 */

/**
 * @param {string} type a building id
 * @returns {ReadonlyArray<{ id: string, name: string }> | null} the type's companies, or null for a type that is not a company of the list
 */
export function companiesOf(type) {
  return getBuildingDefinition(type)?.companies ?? null;
}

/**
 * The company a new building of the type takes: the first of the catalog's list that no standing building holds.
 * @param {string} type a building id that lists companies
 * @param {Iterable<string | null | undefined>} takenIds the `companyId` of every standing building of the type
 * @returns {string} the company's id
 */
export function nextFreeCompanyId(type, takenIds) {
  const companies = companiesOf(type);
  if (!companies) throw new Error(`[companies] "${type}" lists no companies in the catalog`);
  const taken = new Set(takenIds);
  const free = companies.find((company) => !taken.has(company.id));
  if (!free) throw new Error(`[companies] every company of "${type}" already stands (${companies.map((company) => company.id).join(', ')}): the construction should have been refused`);
  return free.id;
}

/**
 * The name of a building that stands: the name of its company when its type lists companies (so two of them are told apart), otherwise its catalog name. One
 * rule, for every place that names a stored building (the journal, the lists, the info panel).
 * @param {string} type a building id
 * @param {{ companyId?: string | null } | null | undefined} row its stored row
 * @returns {string | undefined} undefined when the type has no catalog name (the caller says what that means for it)
 */
export function buildingNameOf(type, row) {
  return companiesOf(type) ? companyNameOf(type, row?.companyId) : getBuildingDefinition(type)?.displayName;
}

/**
 * The name of the company a building is, as the catalog gives it.
 * @param {string} type a building id that lists companies
 * @param {string | null | undefined} companyId the `companyId` of its row
 * @returns {string}
 */
export function companyNameOf(type, companyId) {
  const companies = companiesOf(type);
  if (!companies) throw new Error(`[companies] "${type}" lists no companies in the catalog`);
  const company = companies.find((candidate) => candidate.id === companyId);
  if (!company) throw new Error(`[companies] "${type}" has no company "${companyId}" in the catalog (it lists ${companies.map((candidate) => candidate.id).join(', ')})`);
  return company.name;
}
