/**
 * Clients tab — view layer (DOM only). One producer building's own priority over its candidate clients
 * (the specific instances on the map that draw its goods from a hub), set from this building's own panel —
 * see GetClientPriorityBoardForBuilding for where the ordering comes from.
 *
 * A producer making several goods (a merchant house: dealWood, dealDecoratedPot, dealBook) gets one
 * sub-tab per good, each its own independent ranking — who gets the wood first has nothing to do
 * with who gets the books first. A producer with just one good skips the sub-tab strip entirely.
 */

import { buildingName, goodLabel, goodIcon } from '../../shell/CatalogVocabulary.js';
import { appendStatusMessage } from '../layout/buildingInfoLayout.js';

/**
 * @typedef {object} ClientPriorityViewModel
 * @property {{
 *   getClientPriorityBoardForBuilding: (buildingId: string) => Promise<object | null>,
 *   saveClientPriorityForBuilding: (buildingId: string, category: string, value: { order: string[], disabled: string[] }) => Promise<void>,
 *   resetClientPriorityForBuilding: (buildingId: string, category: string) => Promise<void>,
 * }} supply
 * @property {string} buildingId
 */

/**
 * @param {HTMLElement} container
 * @param {ClientPriorityViewModel | null} model
 * @param {string | null} [selectedCategory] Which good's sub-tab to show — carried across
 *   re-renders (after a save) so editing one good's priority doesn't jump back to the first tab.
 */
export async function renderClientPriorityTab(container, model, selectedCategory = null) {
  if (!container || !model) return;
  container.innerHTML = '';

  let board;
  try {
    board = await model.supply.getClientPriorityBoardForBuilding(model.buildingId);
  } catch (error) {
    // Visible on purpose (no silent fallback to an empty panel): a broken query here must be
    // obvious, not indistinguishable from "this building genuinely has no clients."
    console.error('[ClientPriorityTab] getClientPriorityBoardForBuilding failed:', error);
    appendStatusMessage(container, `Erreur : ${error.message}`, 'error');
    return;
  }

  if (!board) {
    appendStatusMessage(container, 'Bâtiment introuvable.', 'error');
    return;
  }

  if (board.goods.length === 0) {
    // Defensive fallback only: a pure hub never shows this tab at all (see
    // buildingInfoSharedTabs.js's isVisible), so this should not be reachable in practice.
    appendStatusMessage(container, "Ce bâtiment ne produit rien lui-même : il n'a pas de clients propres.", 'neutral');
    return;
  }

  const activeCategory = board.goods.some((g) => g.category === selectedCategory)
    ? selectedCategory
    : board.goods[0].category;

  const rerender = (nextCategory = activeCategory) => void renderClientPriorityTab(container, model, nextCategory);

  const wrap = document.createElement('div');
  wrap.className = 'clients-board';

  if (board.goods.length > 1) {
    const subTabs = document.createElement('div');
    subTabs.className = 'clients-good-tabs';
    subTabs.setAttribute('role', 'tablist');
    for (const good of board.goods) {
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.setAttribute('role', 'tab');
      tabBtn.className = good.category === activeCategory ? 'clients-good-tab is-active' : 'clients-good-tab';
      tabBtn.setAttribute('aria-selected', String(good.category === activeCategory));
      tabBtn.textContent = `${goodIcon(good.category)} ${goodLabel(good.category)}`;
      tabBtn.addEventListener('click', () => rerender(good.category));
      subTabs.appendChild(tabBtn);
    }
    wrap.appendChild(subTabs);
  }

  const good = board.goods.find((g) => g.category === activeCategory);
  wrap.appendChild(renderGoodBoard(model, good, rerender));
  container.appendChild(wrap);
}

/**
 * A client is either a building instance (its display name is a catalog fact, `buildingName`) or an
 * external trade city (its own `label`, already read from WorldCityCatalog at the composition root —
 * see createSupplyContext.js's `listExternalClientsForCategory`). Never guess one from the other.
 */
function clientDisplayName(client) {
  return client.label ?? buildingName(client.type);
}

/** A building client sits at a tile; a trade city has no position among this city's own buildings. */
function clientPositionLabel(client) {
  return client.label != null ? 'ville lointaine' : `${client.x}, ${client.y}`;
}

/**
 * @param {ClientPriorityViewModel} model
 * @param {{ category: string, isCustom: boolean, clients: Array<object> }} good
 * @param {(category?: string) => void} rerender
 * @returns {HTMLElement}
 */
function renderGoodBoard(model, good, rerender) {
  const section = document.createElement('div');
  section.className = 'clients-good-board';

  // Nothing here applies to a good that never reaches a hub (see buildingCatalog.js's `deliversTo`):
  // there is no client PRIORITY to set, since it never goes to a market or workshop in the first place.
  if (good.deliversDirectlyToHouses) {
    appendStatusMessage(section, 'Ce bien part directement vers les habitants : pas de client à gérer ici.', 'neutral');
    return section;
  }

  const hint = document.createElement('p');
  hint.className = 'clients-hint';
  hint.textContent = 'Ce bâtiment sert ses clients dans cet ordre : 1 = servi en premier. La croix arrête de servir un client.';
  section.appendChild(hint);

  if (good.isCustom) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'clients-card__reset';
    reset.textContent = 'Par défaut';
    reset.addEventListener('click', async () => {
      await model.supply.resetClientPriorityForBuilding(model.buildingId, good.category);
      rerender(good.category);
    });
    section.appendChild(reset);
  }

  if (good.clients.length === 0) {
    const message = good.hasEligibleClientTypes
      ? 'Aucun client (marché ou atelier) à proximité pour ce bien.'
      : 'Ce bien ne se vend pas à un marché ou un atelier : il part directement vers un entrepôt (voir Activité > Collecté).';
    appendStatusMessage(section, message, 'neutral');
    return section;
  }

  const table = document.createElement('table');
  table.className = 'work-table clients-table';
  table.innerHTML = '<thead><tr><th class="priority-col">Priorité</th><th>Client</th><th>Position</th><th>Dernier cycle</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');

  good.clients.forEach((client, index) => {
    const row = document.createElement('tr');
    row.className = client.disabled ? 'clients-row clients-row--disabled' : 'clients-row';

    const rank = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'work-priority-input';
    input.min = '1';
    input.max = String(good.clients.length);
    input.step = '1';
    input.value = String(index + 1);
    input.setAttribute('aria-label', `Priorité ${clientDisplayName(client)} (${clientPositionLabel(client)})`);
    input.addEventListener('change', async () => {
      const wanted = Math.max(1, Math.min(good.clients.length, Math.round(Number(input.value)) || index + 1));
      const order = good.clients.map((c) => c.id).filter((id) => id !== client.id);
      order.splice(wanted - 1, 0, client.id);
      await model.supply.saveClientPriorityForBuilding(model.buildingId, good.category, {
        order,
        disabled: good.clients.filter((c) => c.disabled).map((c) => c.id),
      });
      rerender(good.category);
    });
    rank.appendChild(input);

    const name = document.createElement('td');
    name.textContent = clientDisplayName(client);

    const position = document.createElement('td');
    position.textContent = clientPositionLabel(client);

    const effect = document.createElement('td');
    effect.className = 'clients-effect';
    effect.textContent = client.disabled ? '—' : client.wanted > 0 ? `${client.served} / ${client.wanted}` : '–';
    if (!client.disabled && client.wanted > client.served) effect.classList.add('clients-effect--short');

    const toggle = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clients-toggle';
    button.textContent = client.disabled ? '↺' : '✕';
    button.title = client.disabled ? 'Servir de nouveau' : 'Ne plus servir';
    button.setAttribute('aria-label', `${button.title} : ${clientDisplayName(client)} (${clientPositionLabel(client)})`);
    button.addEventListener('click', async () => {
      const disabled = client.disabled
        ? good.clients.filter((c) => c.disabled && c.id !== client.id).map((c) => c.id)
        : [...good.clients.filter((c) => c.disabled).map((c) => c.id), client.id];
      await model.supply.saveClientPriorityForBuilding(model.buildingId, good.category, {
        order: good.clients.map((c) => c.id),
        disabled,
      });
      rerender(good.category);
    });
    toggle.appendChild(button);

    row.append(rank, name, position, effect, toggle);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}
