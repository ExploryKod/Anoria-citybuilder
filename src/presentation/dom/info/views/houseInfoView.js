/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendHouseholdEmployers,
  appendHouseholdProblems,
  appendHouseholdSkills,
  appendLocationFootnote,
  appendMetricCardGroups,
  appendMetricCards,
} from '../layout/buildingInfoLayout.js';
import { renderClientPriorityTab } from './clientPriorityInfoView.js';

/**
 * @typedef {object} HouseSkillsDisplayItem
 * @property {string} emoji
 * @property {number} count
 * @property {string} label
 * @property {string} ariaLabel
 */

/**
 * @typedef {object} HouseSkillsViewModel
 * @property {ReadonlyArray<HouseSkillsDisplayItem>} skills
 * @property {ReadonlyArray<HouseSkillsDisplayItem> | null} employers Where its people work, one per employer category; null when unknown
 * @property {number} anchorX
 * @property {number} anchorY
 */

/**
 * @param {HTMLElement} container
 * @param {HouseSkillsViewModel} model
 */
export function renderHouseSkillsView(container, model) {
  container.innerHTML = '';

  appendHouseholdSkills(container, model.skills, model.upcomingSkills);
  appendHouseholdEmployers(container, model.employers);
  appendHouseholdProblems(container, model.problems);
  appendLocationFootnote(container, model.anchorX, model.anchorY);
}

/**
 * @typedef {object} HouseResourcesViewModel
 * @property {string} [caption] Says what the figures below are (e.g. "Consommé le mois dernier :")
 * @property {ReadonlyArray<{ kind: string, card: object, details: ReadonlyArray<object> }>} needs One per need:
 *   its own card, and the cards of its goods shown once it is picked.
 */

/**
 * The needs as cards, the first (the diet) picked from the start; the cards of the picked need's goods sit
 * under them. One need is always picked, so the detail never disappears.
 * @param {HTMLElement} container
 * @param {HouseResourcesViewModel} model
 */
export function renderHouseResourcesView(container, model) {
  container.innerHTML = '';

  if (model.caption) {
    const caption = document.createElement('p');
    caption.className = 'building-info-footnote';
    caption.textContent = model.caption;
    container.appendChild(caption);
  }
  if (model.needs.length === 0) return;

  const detail = document.createElement('div');
  detail.className = 'building-info-metrics-detail';
  const needByKind = new Map(model.needs.map((need) => [need.kind, need]));

  let grid = null;
  const pick = (kind) => {
    grid?.querySelectorAll('button').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(model.needs[index].kind === kind));
    });
    detail.innerHTML = '';
    appendMetricCards(detail, needByKind.get(kind).details);
  };

  grid = appendMetricCards(container, model.needs.map((need) => need.card), { onSelect: (card) => pick(card.kind) });
  container.appendChild(detail);
  pick(model.needs[0].kind);
}

/**
 * @typedef {object} HouseActivityRecipeViewModel
 * @property {string} category
 * @property {string} label
 * @property {object} material One card, even for a multi-input recipe — see houseInfoFormat.js's materialCardOf.
 * @property {object} product
 * @property {object} collected When this good was last taken by a hub, and how much.
 * @property {ReadonlyArray<object>} steps
 * @property {ReadonlyArray<string>} gapMessages Structural gaps — why an input cannot even be reached or sourced.
 */

/**
 * @typedef {object} HouseRentalViewModel
 * @property {ReadonlyArray<{ label: string, value: string }>} rows
 * @property {ReadonlyArray<{ name: string, status: string, owing: boolean }>} tenants
 * @property {string | null} note Said instead of the figures when the house is not letting anything.
 */

/**
 * @typedef {object} HouseActivityViewModel
 * @property {ReadonlyArray<HouseActivityRecipeViewModel>} recipes
 * @property {ReadonlyArray<{ id: string, label: string, activity: 'recipes' | 'rental' }>} enterprises The legal forms of the house's businesses, one pill each
 * @property {string | null} defaultId The pill the tab opens on
 * @property {HouseRentalViewModel | null} rental What the `rental` activity shows
 */

/** The view the Entreprises tab was left on (a per-viewer convenience, not game state). */
let enterprisesView = 'productions';

/**
 * The Entreprises tab of a house: two pills, Productions (what its businesses make) and Clients (who they serve first).
 * The Clients pill is there only when the house produces goods that have clients (`model.clients` is null otherwise).
 * @param {HTMLElement} container
 * @param {{ activity: HouseActivityViewModel, clients: object | null }} model
 */
export function renderHouseEnterprisesView(container, model) {
  container.innerHTML = '';
  const views = [
    { id: 'productions', label: 'Productions', render: (target) => renderHouseActivityView(target, model.activity) },
    ...(model.clients ? [{ id: 'clients', label: 'Clients', render: (target) => renderClientPriorityTab(target, model.clients) }] : []),
  ];
  if (views.length === 1) {
    views[0].render(container);
    return;
  }

  const pills = document.createElement('div');
  pills.className = 'building-info-view-pills';
  pills.setAttribute('role', 'tablist');
  const panel = document.createElement('div');
  panel.setAttribute('role', 'tabpanel');
  container.append(pills, panel);

  const buttons = new Map();
  const show = (view) => {
    enterprisesView = view.id;
    for (const [id, button] of buttons) {
      button.classList.toggle('is-active', id === view.id);
      button.setAttribute('aria-selected', String(id === view.id));
    }
    panel.replaceChildren();
    view.render(panel);
  };
  for (const view of views) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'building-info-view-pill';
    button.setAttribute('role', 'tab');
    button.textContent = view.label;
    button.addEventListener('click', () => show(view));
    buttons.set(view.id, button);
    pills.append(button);
  }
  show(views.find((view) => view.id === enterprisesView) ?? views[0]);
}

/**
 * The Productions view: one pill per business the house runs (its legal form: a cooperative, a property company), the default one
 * open. Each pill shows what its activity does: the recipes the house makes, or the rents it collects.
 * @param {HTMLElement} container
 * @param {HouseActivityViewModel} model
 */
export function renderHouseActivityView(container, model) {
  container.innerHTML = '';
  if (model.enterprises.length === 0) {
    renderRecipes(container, model.recipes);
    return;
  }

  const pills = document.createElement('div');
  pills.className = 'enterprise-pills';
  pills.setAttribute('role', 'tablist');
  const panel = document.createElement('div');
  panel.className = 'enterprise-panel';
  container.append(pills, panel);

  const buttons = new Map();
  const show = (enterprise) => {
    for (const [id, button] of buttons) {
      button.classList.toggle('is-active', id === enterprise.id);
      button.setAttribute('aria-selected', String(id === enterprise.id));
    }
    panel.replaceChildren();
    if (enterprise.activity === 'rental') renderRental(panel, model.rental);
    else renderRecipes(panel, model.recipes);
  };
  for (const enterprise of model.enterprises) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'enterprise-pill';
    button.setAttribute('role', 'tab');
    button.textContent = enterprise.label;
    button.addEventListener('click', () => show(enterprise));
    buttons.set(enterprise.id, button);
    pills.append(button);
  }
  show(model.enterprises.find((enterprise) => enterprise.id === model.defaultId));
}

/**
 * What a property company shows: the rent it asks, what it collected and is owed at the last settlement, and each tenant's situation.
 * @param {HTMLElement} container
 * @param {HouseRentalViewModel | null} rental
 */
function renderRental(container, rental) {
  if (!rental) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = '…';
    container.appendChild(note);
    return;
  }
  if (rental.note) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = rental.note;
    container.appendChild(note);
    return;
  }
  for (const row of rental.rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kv-row';
    const key = document.createElement('div');
    key.className = 'kv-key';
    key.textContent = row.label;
    const value = document.createElement('div');
    value.className = 'kv-value';
    value.textContent = row.value;
    rowEl.append(key, value);
    container.appendChild(rowEl);
  }
  for (const tenant of rental.tenants) {
    const rowEl = document.createElement('div');
    rowEl.className = `kv-row${tenant.owing ? ' enterprise-tenant--owing' : ''}`;
    const key = document.createElement('div');
    key.className = 'kv-key';
    key.textContent = tenant.name;
    const value = document.createElement('div');
    value.className = 'kv-value';
    value.textContent = tenant.status;
    rowEl.append(key, value);
    container.appendChild(rowEl);
  }
}

/**
 * One block per recipe the house's catalog entry declares, each a SINGLE row of card groups — material,
 * steps, product, collected — close together within a group and apart between groups, so the phases read
 * apart without four separate labeled sections (2026-10-10). A house without any recipe gets a plain note
 * instead of an empty panel.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<HouseActivityRecipeViewModel>} recipes
 */
function renderRecipes(container, recipes) {
  if (!recipes.length) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = "Cette entreprise n'a pas d'activité propre.";
    container.appendChild(note);
    return;
  }

  // What blocks a recipe from reaching its inputs or its clients, said once up front in a table (good, then what is missing).
  const gaps = recipes.flatMap((recipe) => (recipe.gapMessages ?? []).map((message) => ({ label: recipe.label, message })));
  if (gaps.length > 0) {
    const table = document.createElement('table');
    table.className = 'building-info-gaps';
    const caption = document.createElement('caption');
    caption.textContent = '⚠️ À régler';
    const body = document.createElement('tbody');
    for (const gap of gaps) {
      const row = document.createElement('tr');
      const good = document.createElement('th');
      good.scope = 'row';
      good.textContent = gap.label;
      const message = document.createElement('td');
      message.textContent = gap.message;
      row.append(good, message);
      body.append(row);
    }
    table.append(caption, body);
    container.appendChild(table);
  }

  for (const recipe of recipes) {
    const block = document.createElement('div');
    block.className = 'building-info-activity-recipe';

    const heading = document.createElement('h3');
    heading.className = 'building-info-section-label';
    heading.textContent = recipe.label;
    block.appendChild(heading);

    appendMetricCardGroups(block, [
      [recipe.material],
      recipe.steps,
      [recipe.product],
      [recipe.collected],
    ]);

    container.appendChild(block);
  }
}
