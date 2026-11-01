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
 * @property {object | null} material One card, even for a multi-input recipe — see houseInfoFormat.js's materialCardOf; null when the recipe takes no material.
 * @property {object} product
 * @property {object} collected When this good was last taken by a hub, and how much.
 * @property {ReadonlyArray<object>} steps
 * @property {ReadonlyArray<string>} gapMessages Structural gaps — why an input cannot even be reached or sourced.
 * @property {ReadonlyArray<{ icon: string, label: string }>} upstream The materials this house made itself in another recipe (the chain this one continues).
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
  const { enterprises, defaultId } = model.activity;
  let enterpriseId = defaultId;
  const views = [
    { id: 'productions', label: 'Productions', render: (target) => renderHouseActivityView(target, model.activity, enterpriseId) },
    ...(model.clients ? [{ id: 'clients', label: 'Clients', render: (target) => renderClientPriorityTab(target, model.clients) }] : []),
  ];
  // Nothing to choose between, and no business type to name: just the view.
  if (views.length === 1 && enterprises.length === 0) {
    views[0].render(container);
    return;
  }

  // One bar: the views on the left (they slide sideways when the width is short), the type of the business as a badge pinned on the right,
  // so the badge costs no row of its own.
  const bar = document.createElement('div');
  bar.className = 'building-info-view-bar';
  const panel = document.createElement('div');
  panel.setAttribute('role', 'tabpanel');
  container.append(bar, panel);

  let current = views.find((view) => view.id === enterprisesView) ?? views[0];
  const viewButtons = new Map();
  const badgeButtons = new Map();
  const paint = () => {
    for (const [id, button] of viewButtons) {
      button.classList.toggle('is-active', id === current.id);
      button.setAttribute('aria-selected', String(id === current.id));
    }
    for (const [id, button] of badgeButtons) {
      button.classList.toggle('is-active', id === enterpriseId);
      button.setAttribute('aria-selected', String(id === enterpriseId));
    }
    panel.replaceChildren();
    current.render(panel);
  };

  if (views.length > 1) {
    const pills = document.createElement('div');
    pills.className = 'building-info-view-pills';
    pills.setAttribute('role', 'tablist');
    for (const view of views) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'building-info-view-pill';
      button.setAttribute('role', 'tab');
      button.textContent = view.label;
      button.addEventListener('click', () => {
        current = view;
        enterprisesView = view.id;
        paint();
      });
      viewButtons.set(view.id, button);
      pills.append(button);
    }
    bar.append(pills);
  }

  if (enterprises.length > 0) {
    // The type of each business (cooperative, property company…): a badge, not a button of the same family as the views.
    const badges = document.createElement('div');
    badges.className = 'enterprise-badges';
    badges.setAttribute('role', 'tablist');
    for (const enterprise of enterprises) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'enterprise-badge';
      button.setAttribute('role', 'tab');
      button.textContent = enterprise.label;
      button.addEventListener('click', () => {
        enterpriseId = enterprise.id;
        paint();
      });
      badgeButtons.set(enterprise.id, button);
      badges.append(button);
    }
    bar.append(badges);
  }
  paint();
}

/**
 * The Productions view of one business of the house (its legal form: a cooperative, a property company): what its activity does,
 * the recipes the house makes, or the rents it collects. Which business is shown is picked with the badge of the tab's bar.
 * @param {HTMLElement} container
 * @param {HouseActivityViewModel} model
 * @param {string | null} enterpriseId The business to show (null for a house that declares none).
 */
export function renderHouseActivityView(container, model, enterpriseId) {
  container.innerHTML = '';
  if (model.enterprises.length === 0) {
    renderRecipes(container, model.recipes);
    return;
  }
  const enterprise = model.enterprises.find((candidate) => candidate.id === enterpriseId);
  if (!enterprise) throw new Error(`[house] no enterprise "${enterpriseId}" among ${model.enterprises.map((candidate) => candidate.id).join(', ')}`);
  if (enterprise.activity === 'rental') renderRental(container, model.rental);
  else renderRecipes(container, model.recipes);
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

  // What blocks a recipe from reaching its inputs or its clients. The same problem met by several recipes is said once, with
  // how many (×2, ×3…) and which recipes, not repeated.
  const gaps = new Map();
  for (const recipe of recipes) {
    for (const message of recipe.gapMessages ?? []) {
      const gap = gaps.get(message) ?? { message, recipeLabels: [] };
      gap.recipeLabels.push(recipe.label);
      gaps.set(message, gap);
    }
  }
  if (gaps.size === 0) {
    renderProductionChains(container, recipes);
    return;
  }

  // Two pills: the problems to settle (open first, they are what the player must act on) or the production chains.
  const pills = document.createElement('div');
  pills.className = 'enterprise-pills';
  pills.setAttribute('role', 'tablist');
  const panel = document.createElement('div');
  container.append(pills, panel);
  const views = [
    { id: 'gaps', label: `⚠️ À régler (${gaps.size})`, render: () => renderGaps(panel, [...gaps.values()]) },
    { id: 'chains', label: 'Chaînes de production', render: () => renderProductionChains(panel, recipes) },
  ];
  const buttons = new Map();
  const show = (view) => {
    for (const [id, button] of buttons) {
      button.classList.toggle('is-active', id === view.id);
      button.setAttribute('aria-selected', String(id === view.id));
    }
    panel.replaceChildren();
    view.render();
  };
  for (const view of views) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'enterprise-pill';
    button.setAttribute('role', 'tab');
    button.textContent = view.label;
    button.addEventListener('click', () => show(view));
    buttons.set(view.id, button);
    pills.append(button);
  }
  show(views[0]);
}

/**
 * The problems to settle, one line each: the sentence once, ×N when several recipes meet it, and the recipes it holds back.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ message: string, recipeLabels: string[] }>} gaps
 */
function renderGaps(container, gaps) {
  const list = document.createElement('ul');
  list.className = 'building-info-gaps';
  for (const gap of gaps) {
    const item = document.createElement('li');
    const message = document.createElement('span');
    message.className = 'building-info-gaps__message';
    message.textContent = gap.message;
    item.appendChild(message);
    if (gap.recipeLabels.length > 1) {
      const count = document.createElement('span');
      count.className = 'building-info-gaps__count';
      count.textContent = `×${gap.recipeLabels.length}`;
      item.appendChild(count);
    }
    const recipes = document.createElement('span');
    recipes.className = 'building-info-gaps__recipes';
    recipes.textContent = gap.recipeLabels.join(', ');
    item.appendChild(recipes);
    list.appendChild(item);
  }
  container.appendChild(list);
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<HouseActivityRecipeViewModel>} recipes
 */
function renderProductionChains(container, recipes) {
  for (const recipe of recipes) {
    const block = document.createElement('div');
    block.className = 'building-info-activity-recipe';

    const heading = document.createElement('h3');
    heading.className = 'building-info-section-label';
    heading.textContent = recipe.label;
    block.appendChild(heading);

    // This recipe continues another one of the house's: its material is a good the house made itself, not one bought from nothing.
    if (recipe.upstream.length > 0) {
      const origin = document.createElement('p');
      origin.className = 'building-info-recipe-origin';
      const goods = recipe.upstream.map((good) => `${good.icon} ${good.label}`).join(', ');
      origin.textContent = `↳ Suite de la production précédente de cette maison : ${goods}`;
      block.appendChild(origin);
    }

    appendMetricCardGroups(block, [
      recipe.material ? [recipe.material] : [],
      recipe.steps,
      [recipe.product],
      [recipe.collected],
    ]);

    container.appendChild(block);
  }
}
