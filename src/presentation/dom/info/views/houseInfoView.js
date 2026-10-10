/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendHouseholdSkills,
  appendLocationFootnote,
  appendMetricCardGroups,
  appendMetricCards,
} from '../layout/buildingInfoLayout.js';

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
 * @property {number} anchorX
 * @property {number} anchorY
 */

/**
 * @param {HTMLElement} container
 * @param {HouseSkillsViewModel} model
 */
export function renderHouseSkillsView(container, model) {
  container.innerHTML = '';

  appendHouseholdSkills(container, model.skills);
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
 * @typedef {object} HouseActivityViewModel
 * @property {ReadonlyArray<HouseActivityRecipeViewModel>} recipes
 */

/**
 * One block per recipe the house's catalog entry declares, each a SINGLE row of card groups — material,
 * steps, product, collected — close together within a group and apart between groups, so the phases read
 * apart without four separate labeled sections (2026-10-10). A house without any recipe gets a plain note
 * instead of an empty panel.
 * @param {HTMLElement} container
 * @param {HouseActivityViewModel} model
 */
export function renderHouseActivityView(container, model) {
  container.innerHTML = '';

  if (!model.recipes.length) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = "Cette catégorie n'a pas d'activité propre.";
    container.appendChild(note);
    return;
  }

  for (const recipe of model.recipes) {
    const block = document.createElement('div');
    block.className = 'building-info-activity-recipe';

    const heading = document.createElement('h3');
    heading.className = 'building-info-section-label';
    heading.textContent = recipe.label;
    block.appendChild(heading);

    for (const message of recipe.gapMessages ?? []) {
      const warning = document.createElement('p');
      warning.className = 'building-info-footnote building-info-gap-warning';
      warning.textContent = `⚠️ ${message}`;
      block.appendChild(warning);
    }

    appendMetricCardGroups(block, [
      [recipe.material],
      recipe.steps,
      [recipe.product],
      [recipe.collected],
    ]);

    container.appendChild(block);
  }
}
