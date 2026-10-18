import { buildingName } from '../../shell/CatalogVocabulary.js';
import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/BuildingKind.js';

/**
 * Activités économiques — the interface only: the list of the hamlet's activities with an administrative closure toggle, and the liquidations with the
 * screen of one (a public buy-out offer from the hamlet, an offer put to the world). Neither the closure nor the offers act on the game yet: the closure is
 * kept in this presenter, to show how the toggle will behave.
 */
export class ActivitiesSectionPresenter {
  /**
   * @param {{ accounting: object, construction: object }} deps
   */
  constructor(deps) {
    this.accounting = deps.accounting;
    this.construction = deps.construction;
    /** @type {Set<string>} the activities the player has closed administratively (interface only) */
    this.closed = new Set();
    /** @type {Array<{ id: string, type: string, insolvency: object | null }>} */
    this.activities = [];
    this.root = document.getElementById('activities-board');
  }

  init() {
    for (const tab of this.root.querySelectorAll('.activities-tab')) {
      tab.addEventListener('click', () => this.#showTab(tab.dataset.activitiesTab));
    }
    this.root.querySelector('#activities-liquidation-back').addEventListener('click', () => this.#showLiquidationList());
    return this.refresh();
  }

  async refresh() {
    const rows = await this.construction.listAllBuildingRows();
    this.activities = [];
    for (const row of rows) {
      if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) continue;
      // An activity is a building with an account or one that asks for workers, staffed or not.
      const workerNeed = row.employees?.worker_need ?? 0;
      if (!this.accounting.hasBuildingAccount(row.type) && !(workerNeed > 0)) continue;
      const id = instanceIdFromHouseRow(row);
      const insolvency = await this.accounting.getInsolvency(id);
      // A liquidated company is closed: having no workers is not news about it.
      const withoutWorkers = workerNeed > 0 && !((row.employees?.worker ?? 0) > 0) && insolvency?.liquidated !== true;
      this.activities.push({ id, type: row.type, insolvency, withoutWorkers });
    }
    this.#renderList();
    this.#renderLiquidations();
  }

  #showTab(name) {
    for (const tab of this.root.querySelectorAll('.activities-tab')) tab.classList.toggle('active', tab.dataset.activitiesTab === name);
    for (const content of this.root.querySelectorAll('.activities-tab-content')) content.classList.toggle('active', content.id === `activities-${name}-tab`);
    if (name === 'liquidations') this.#showLiquidationList();
  }

  /** The pill of a company's state, with the words the accounting gives (impayés, liquidée). */
  #pill(insolvency) {
    if (!insolvency) return null;
    const pill = document.createElement('span');
    pill.className = 'activities-pill';
    if (insolvency.liquidated) {
      pill.classList.add('activities-pill-liquidated');
      pill.textContent = `${insolvency.liquidatedDisplay.icon} ${insolvency.liquidatedDisplay.label}`;
    } else if (insolvency.months > 0) {
      pill.classList.add('activities-pill-insolvent');
      pill.textContent = `${insolvency.display.icon} ${insolvency.display.label} ${insolvency.months}/${insolvency.graceMonths} mois`;
    } else {
      return null;
    }
    return pill;
  }

  #line(activity) {
    const line = document.createElement('div');
    line.className = 'activities-line';
    const name = document.createElement('span');
    name.className = 'activities-name';
    name.textContent = buildingName(activity.type);
    line.append(name);
    const pill = this.#pill(activity.insolvency);
    if (activity.withoutWorkers) {
      const noWorkers = document.createElement('span');
      noWorkers.className = 'activities-pill activities-pill-no-workers';
      noWorkers.textContent = '👷 sans main-d’œuvre';
      line.append(noWorkers);
    }
    if (pill) line.append(pill);
    return line;
  }

  #renderList() {
    const list = this.root.querySelector('#activities-list');
    list.replaceChildren();
    if (this.activities.length === 0) {
      list.textContent = 'Aucune activité dans le hameau.';
      return;
    }
    for (const activity of this.activities) {
      const line = this.#line(activity);
      const closed = this.closed.has(activity.id);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'activities-closure-btn';
      toggle.setAttribute('aria-pressed', String(closed));
      toggle.textContent = closed ? 'Rouvrir' : 'Fermer';
      // Nothing to close in an activity that has no workers (an activity already closed stays reopenable) or that is liquidated.
      toggle.disabled = activity.insolvency?.liquidated === true || (activity.withoutWorkers && !closed);
      if (activity.withoutWorkers && !closed) toggle.title = 'Aucune main-d’œuvre : rien à fermer';
      toggle.addEventListener('click', () => {
        if (this.closed.has(activity.id)) this.closed.delete(activity.id);
        else this.closed.add(activity.id);
        this.#renderList();
      });
      line.classList.toggle('activities-line-closed', closed);
      line.append(toggle);
      list.append(line);
    }
  }

  #renderLiquidations() {
    const list = this.root.querySelector('#activities-liquidations-list');
    list.replaceChildren();
    const concerned = this.activities.filter((activity) => activity.insolvency && (activity.insolvency.liquidated || activity.insolvency.months > 0));
    if (concerned.length === 0) {
      list.textContent = 'Aucune activité liquidée ou en cours de liquidation.';
      return;
    }
    for (const activity of concerned) {
      const line = this.#line(activity);
      line.classList.add('activities-line-clickable');
      line.tabIndex = 0;
      line.addEventListener('click', () => this.#showLiquidation(activity));
      line.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') this.#showLiquidation(activity);
      });
      list.append(line);
    }
  }

  #showLiquidationList() {
    this.root.querySelector('#activities-liquidations-list').hidden = false;
    this.root.querySelector('#activities-liquidation-detail').hidden = true;
  }

  #showLiquidation(activity) {
    this.root.querySelector('#activities-liquidations-list').hidden = true;
    this.root.querySelector('#activities-liquidation-detail').hidden = false;
    this.root.querySelector('#activities-liquidation-title').textContent = buildingName(activity.type);
    const state = this.root.querySelector('#activities-liquidation-state');
    state.replaceChildren();
    const pill = this.#pill(activity.insolvency);
    if (pill) state.append(pill);
    const owed = activity.insolvency.debts.map((debt) => `${debt.label} ${debt.amount.toFixed(2)} €`).join(' · ');
    if (owed) state.append(document.createTextNode(` Dettes : ${owed}`));
  }
}
