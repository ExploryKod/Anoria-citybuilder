import { buildingName, goodLabel, goodIcon } from '../../shell/CatalogVocabulary.js';

/**
 * The Clients tab: for each producer type whose goods go to a hub, who it serves first. The player orders the
 * client types (the building types that buy its goods — never one building at given coordinates) with a rank
 * per line, as with the labour priorities, or stops serving one with the cross; a change is applied and saved at
 * once, and the list reorders at once. Everything shown — producer types, their clients, names, icons — is read
 * from the catalog through the supply query; nothing is named here.
 */
export class ClientsSectionPresenter {
  /**
   * @param {{ supply: { listClientPriorityBoards: Function, saveClientPriorities: Function, resetClientPriorities: Function } }} deps
   * @param {HTMLElement} section
   */
  constructor(deps, section) {
    this.supply = deps.supply;
    this.list = section.querySelector('#clients-list');
    this.hint = section.querySelector('#clients-hint');
    /** @type {Array<object>} */
    this.boards = [];
  }

  async refresh() {
    this.boards = await this.supply.listClientPriorityBoards();
    this.render();
  }

  render(focusFor = null) {
    if (!this.list) return;
    if (this.hint) {
      this.hint.textContent = this.boards.length === 0
        ? 'Aucun producteur ne livre encore à un entrepôt.'
        : 'Chaque producteur sert ses clients dans l’ordre : 1 = servi en premier. Le reste passe au suivant. La croix arrête de servir un client.';
    }
    this.list.innerHTML = '';
    for (const board of this.boards) this.list.appendChild(this.#renderBoard(board));

    if (focusFor) {
      this.list.querySelector(`[data-board="${focusFor.producerType}"] [data-client="${focusFor.client}"] input`)?.focus();
    }
  }

  #renderBoard(board) {
    const card = document.createElement('section');
    card.className = 'clients-card';
    card.dataset.board = board.producerType;

    const header = document.createElement('div');
    header.className = 'clients-card__header';
    const title = document.createElement('h4');
    title.textContent = `${board.categories.map(goodIcon).join(' ')} ${buildingName(board.producerType)}`;
    const meta = document.createElement('span');
    meta.className = 'clients-card__meta';
    meta.textContent = `${board.placed} posé(s) · ${board.categories.map(goodLabel).join(', ')}`;
    header.append(title, meta);
    if (board.isCustom) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'clients-card__reset';
      reset.textContent = 'Par défaut';
      reset.addEventListener('click', () => {
        this.supply.resetClientPriorities(board.producerType);
        void this.refresh();
      });
      header.appendChild(reset);
    }

    const table = document.createElement('table');
    table.className = 'work-table clients-table';
    table.innerHTML = '<thead><tr><th class="priority-col">Priorité</th><th>Client</th><th>Posés</th><th>Dernier cycle</th><th></th></tr></thead>';
    const body = document.createElement('tbody');
    board.clients.forEach((client, index) => body.appendChild(this.#renderClient(board, client, index)));
    table.appendChild(body);

    card.append(header, table);
    return card;
  }

  #renderClient(board, client, index) {
    const row = document.createElement('tr');
    row.dataset.client = client.type;
    row.className = client.disabled ? 'clients-row clients-row--disabled' : 'clients-row';

    const rank = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'work-priority-input';
    input.min = '1';
    input.max = String(board.clients.length);
    input.step = '1';
    input.value = String(index + 1);
    input.setAttribute('aria-label', `Priorité ${buildingName(client.type)}`);
    input.addEventListener('change', () => {
      const wanted = Math.max(1, Math.min(board.clients.length, Math.round(Number(input.value)) || index + 1));
      this.#move(board, client.type, wanted - 1);
    });
    rank.appendChild(input);

    const name = document.createElement('td');
    name.textContent = buildingName(client.type);

    const placed = document.createElement('td');
    placed.textContent = String(client.placed);

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
    button.setAttribute('aria-label', `${button.title} : ${buildingName(client.type)}`);
    button.addEventListener('click', () => this.#toggle(board, client.type));
    toggle.appendChild(button);

    row.append(rank, name, placed, effect, toggle);
    return row;
  }

  /** Put a client at another rank; the others shift, as with labour priorities. */
  #move(board, type, toIndex) {
    const order = board.clients.map((client) => client.type).filter((candidate) => candidate !== type);
    order.splice(toIndex, 0, type);
    const byType = new Map(board.clients.map((client) => [client.type, client]));
    board.clients = order.map((candidate) => byType.get(candidate));
    this.#save(board);
    this.render({ producerType: board.producerType, client: type });
  }

  #toggle(board, type) {
    const client = board.clients.find((candidate) => candidate.type === type);
    client.disabled = !client.disabled;
    this.#save(board);
    board.isCustom = true;
    this.render({ producerType: board.producerType, client: type });
  }

  #save(board) {
    board.isCustom = true;
    this.supply.saveClientPriorities(board.producerType, {
      order: board.clients.map((client) => client.type),
      disabled: board.clients.filter((client) => client.disabled).map((client) => client.type),
    });
  }
}
