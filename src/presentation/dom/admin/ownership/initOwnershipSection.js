import { showActiveHamletNameIn } from '../hamletLabel.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { helpButton, bindStaticHelps } from '../../shell/HelpButton.js';
import { helpIdOfAccount } from '../../../../shared/help-catalog/HelpCatalog.js';

/** A share, as the player reads it: "25 %". @param {number} ratio */
const formatShare = (ratio) => `${(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** The three views of the claims: all of them, what the city owes, and what is owed to it. */
const CLAIM_FILTERS = Object.freeze({
  all: { label: 'Toutes', keeps: () => true },
  owed: { label: 'Ce que la ville doit', keeps: (claim) => claim.debtor.kind === 'city' },
  receivable: { label: 'Ce qu’on doit à la ville', keeps: (claim) => claim.creditor.kind === 'city' },
});

/**
 * The Patrimoine section (docs/gameplay/PLAN_OWNERSHIP.md): who owns what, read from the journal and the buildings. The companies and who holds their capital, the buildings and
 * their owners, and every debt with its creditor and its debtor. Lists that wrap on a phone, one line per fact.
 */
class OwnershipSectionPresenter {
  /** @param {{ accounting: object }} deps */
  constructor({ accounting }) {
    this.accounting = accounting;
    this.filter = 'all';
  }

  /** @param {string} id */
  #element(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`[ownership] #${id} is missing from the page`);
    return node;
  }

  bind() {
    // The titles marked `data-help` in the page (the same whatever happens) get their "?".
    bindStaticHelps(this.#element('admin-section-ownership'));
    const select = this.#element('ownership-claims-filter');
    select.replaceChildren(...Object.entries(CLAIM_FILTERS).map(([id, { label }]) => {
      const option = el('option', null, label);
      option.value = id;
      return option;
    }));
    select.addEventListener('change', () => {
      this.filter = select.value;
      void this.refresh();
    });
  }

  async refresh() {
    const register = await this.accounting.getOwnershipRegister();
    this.#renderCompanies(register.companies);
    this.#renderCooperatives(register.cooperatives);
    this.#renderBuildings(register.buildings);
    this.#renderSheet(register.stateBalanceSheet);
    this.#renderClaims(register.claims);
  }

  #renderCompanies(companies) {
    const list = this.#element('ownership-companies');
    list.replaceChildren(...(companies.length === 0 ? [el('li', 'ownership-none', 'Aucune entreprise.')] : companies.map((company) => {
      const item = el('li', 'ownership-row');
      item.append(el('span', 'ownership-row__subject', company.name));
      const holders = company.shareholders
        .map((holder) => `${holder.party.name} : ${formatShare(holder.share)} du capital (${formatEuro(holder.capital)}), ${formatShare(holder.dividendStake)} des dividendes`)
        .join(' · ');
      item.append(el('span', 'ownership-row__fact', holders));
      return item;
    })));
  }

  #renderCooperatives(cooperatives) {
    const list = this.#element('ownership-cooperatives');
    list.replaceChildren(...(cooperatives.length === 0 ? [el('li', 'ownership-none', 'Aucune coopérative.')] : cooperatives.map((cooperative) => {
      const item = el('li', 'ownership-row');
      item.append(el('span', 'ownership-row__subject', cooperative.name), el('span', 'ownership-row__fact', cooperative.owners));
      return item;
    })));
  }

  /** The balance sheet of the city: what it holds, then what it owes and its result, each side a list with its total. */
  #renderSheet(sheet) {
    // The cash is the State's account at its central bank (515); a State with nothing there has no such line, and holds nothing.
    const cash = sheet.assets.lines.find((line) => line.account === '515')?.amount ?? 0;
    const resultState = sheet.result < 0 ? 'loss' : 'gain';
    const side = (title, { lines, total }) => {
      const block = el('div', 'ownership-sheet__side');
      const heading = el('h5', 'ownership-sheet__title', `${title} — ${formatEuro(total)}`);
      heading.append(helpButton('city.balanceSheet', {
        state: resultState,
        figures: { assets: sheet.assets.total, liabilities: sheet.liabilities.total, cash, result: Math.abs(sheet.result) },
      }));
      block.append(heading);
      const list = el('ul', 'ownership-list');
      list.append(...lines.map((line) => {
        const item = el('li', 'ownership-row');
        const subject = el('span', 'ownership-row__subject', line.label);
        if (line.account === 'result') {
          subject.append(helpButton('city.result.total', { state: resultState, figures: { result: Math.abs(sheet.result) } }));
        } else if (helpIdOfAccount(line.account)) {
          subject.append(helpButton(helpIdOfAccount(line.account), { figures: { amount: line.amount } }));
        }
        item.append(subject, el('span', 'ownership-row__fact', formatEuro(line.amount)));
        return item;
      }));
      block.append(list);
      return block;
    };
    this.#element('ownership-sheet').replaceChildren(side('Ce que la ville détient', sheet.assets), side('Ce qu’elle doit et son résultat', sheet.liabilities));
  }

  #renderBuildings(buildings) {
    const list = this.#element('ownership-buildings');
    list.replaceChildren(...(buildings.length === 0 ? [el('li', 'ownership-none', 'Aucun bâtiment.')] : buildings.map((entry) => {
      const item = el('li', 'ownership-row');
      item.append(el('span', 'ownership-row__subject', entry.name), el('span', 'ownership-row__fact', entry.owner.name));
      return item;
    })));
  }

  #renderClaims(claims) {
    const list = this.#element('ownership-claims');
    const shown = claims.filter(CLAIM_FILTERS[this.filter].keeps);
    list.replaceChildren(...(shown.length === 0 ? [el('li', 'ownership-none', 'Aucune dette dans cette vue.')] : shown.map((claim) => {
      const item = el('li', 'ownership-row');
      item.append(
        el('span', 'ownership-row__subject', `${claim.label} — ${formatEuro(claim.amount)}`),
        el('span', 'ownership-row__fact', `${claim.creditor.name} (créancier) → ${claim.debtor.name} (débiteur)`),
      );
      return item;
    })));
  }
}

/** @param {{ accounting: object }} deps */
export function initOwnershipSection(deps) {
  const section = document.getElementById('admin-section-ownership');
  if (!section) return;
  const presenter = new OwnershipSectionPresenter(deps);
  let initialized = false;
  const open = async () => {
    if (!initialized) {
      initialized = true;
      presenter.bind();
    }
    await showActiveHamletNameIn(section);
    await presenter.refresh();
  };
  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
