import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { createSliderRow } from '../sliderRow.js';

/** What the market says of a skill this month, in words and in the colour family of the journal. */
const SIGNALS = Object.freeze({
  shortage: Object.freeze({ label: 'Pénurie de bras', tone: 'external' }),
  balanced: Object.freeze({ label: 'Équilibre', tone: 'sales' }),
  slack: Object.freeze({ label: 'Chômage qualifié', tone: 'tax-paid' }),
});

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * The Wages section: what the labour market pays each skill and level this month, why it moves (a shortage of hands raises it, qualified
 * citizens left idle lower it), and the two levers of the city: the minimum wage (the floor of every wage) and the unemployment benefit (a
 * share of it). Read from the wage log and the last worker distribution; nothing is stored here.
 */
export class WagesSectionPresenter {
  /** @param {{ accounting: object, employment: { getLabourMarket: () => object | null } }} deps */
  constructor({ accounting, employment }) {
    this.accounting = accounting;
    this.employment = employment;
    this.bounds = accounting.getFiscalSliderBounds();
  }

  async refresh() {
    const levers = document.getElementById('wages-levers');
    const board = document.getElementById('wages-board');
    if (!levers || !board) throw new Error('[wages] #wages-levers or #wages-board is missing from the page');

    const settings = await this.accounting.getSalarySettings();
    levers.replaceChildren(
      createSliderRow({
        label: 'Salaire minimum',
        scope: 'Hameau',
        min: this.bounds.minimumWage.min,
        max: this.bounds.minimumWage.max,
        value: settings.minimumWage,
        unit: '€/mois',
        ariaLabel: "Salaire minimum, en euros par mois — le plancher de tous les salaires et la base de l'allocation chômage",
        store: async (value) => {
          await this.accounting.setSalarySettings({ minimumWage: value });
          await this.refresh();
        },
      }),
      createSliderRow({
        label: 'Allocation chômage',
        scope: 'Hameau',
        min: this.bounds.unemploymentBenefitPercent.min,
        max: this.bounds.unemploymentBenefitPercent.max,
        value: Math.round(settings.unemploymentBenefitRate * 100),
        unit: '%',
        ariaLabel: 'Allocation chômage, en pourcentage du salaire minimum',
        store: (value) => this.accounting.setSalarySettings({ unemploymentBenefitRate: value / 100 }),
      }),
      createSliderRow({
        label: 'Cotisations patronales',
        scope: 'Hameau',
        min: this.bounds.employerContributionPercent.min,
        max: this.bounds.employerContributionPercent.max,
        value: Math.round(settings.employerContributionRate * 100),
        unit: '%',
        ariaLabel: "Cotisations patronales, en pourcentage du salaire brut, à la charge de l'entreprise",
        store: (value) => this.accounting.setSalarySettings({ employerContributionRate: value / 100 }),
      }),
      createSliderRow({
        label: 'Cotisations salariales',
        scope: 'Hameau',
        min: this.bounds.employeeContributionPercent.min,
        max: this.bounds.employeeContributionPercent.max,
        value: Math.round(settings.employeeContributionRate * 100),
        unit: '%',
        ariaLabel: 'Cotisations salariales, en pourcentage du salaire brut, retenues sur le salaire',
        store: (value) => this.accounting.setSalarySettings({ employeeContributionRate: value / 100 }),
      }),
    );

    const social = await this.accounting.getSocialSecurityBoard();
    const socialBoard = document.getElementById('wages-social');
    if (!socialBoard) throw new Error('[wages] #wages-social is missing from the page');
    socialBoard.replaceChildren(this.#socialCard(social));

    const market = this.employment.getLabourMarket();
    if (!market || market.rows.length === 0) {
      board.replaceChildren(el('p', 'commerce-customs-hint', "Aucun marché du travail n'a encore été lu : il faut des ouvriers et des emplois. Les salaires restent à leur niveau de départ."));
      return;
    }
    const { wages } = await this.accounting.getWageBoard(market.rows);
    board.replaceChildren(this.#table(wages));
  }

  /** @param {{ contributions: number, benefits: number, balance: number }} social */
  #socialCard(social) {
    const card = el('section', 'price-card');
    card.append(el('h3', 'price-card-title', 'Sécurité sociale — dernier règlement'));
    const table = el('table', 'price-table');
    const row = (label, amount, tone) => {
      const tr = el('tr');
      tr.dataset.step = tone;
      tr.append(el('th', null, label), el('td', 'price-total', formatEuro(amount)));
      return tr;
    };
    table.append(
      row('Cotisations perçues (patronales et salariales)', social.contributions, 'sales'),
      row('Allocations chômage versées', social.benefits, 'external'),
      row(social.balance >= 0 ? 'Excédent' : 'Déficit (pris sur le trésor de la ville)', social.balance, social.balance >= 0 ? 'sales' : 'external'),
    );
    card.append(table);
    return card;
  }

  /** @param {Array<object>} wages */
  #table(wages) {
    const card = el('section', 'price-card');
    const table = el('table', 'wage-table');
    const headRow = el('tr');
    for (const label of ['Métier', 'Salaire', 'Évolution', 'Emplois', 'Pourvus', 'Sans emploi', 'Marché']) headRow.append(el('th', null, label));
    const head = el('thead');
    head.append(headRow);
    table.append(head);

    const body = el('tbody');
    for (const wage of wages) {
      const skill = getSkillDisplay(wage.skill);
      const row = el('tr');
      const name = el('th', null, `${skill.emoji} ${skill.label}`);
      name.append(el('span', 'building-finance-pill wage-level', `niveau ${wage.level}`));
      const trend = this.#trend(wage);
      const signal = SIGNALS[wage.signal];
      const marketPill = el('span', 'building-finance-pill', signal.label);
      const marketCell = el('td');
      marketCell.append(marketPill);
      row.dataset.tone = signal.tone;
      row.append(
        name,
        el('td', 'wage-amount', formatEuro(wage.amount)),
        trend,
        el('td', null, String(wage.jobs)),
        el('td', null, String(wage.filled)),
        el('td', null, String(wage.idle)),
        marketCell,
      );
      body.append(row);
    }
    table.append(body);
    card.append(table);
    card.append(
      el(
        'p',
        'commerce-customs-hint',
        "Chaque mois, un métier où des emplois restent vacants voit son salaire monter (de quelques % au plus) ; un métier où des citoyens qualifiés restent sans emploi le voit baisser, sans jamais passer sous le salaire minimum. Le salaire minimum relève tout salaire qui serait en dessous.",
      ),
    );
    return card;
  }

  /** @param {{ amount: number, previous: number | null, atMinimum: boolean }} wage */
  #trend(wage) {
    const cell = el('td');
    if (wage.atMinimum) {
      cell.append(el('span', 'building-finance-pill', 'au minimum'));
      return cell;
    }
    if (wage.previous === null || wage.previous === wage.amount) {
      cell.textContent = '—';
      return cell;
    }
    const percent = Math.round(((wage.amount - wage.previous) / wage.previous) * 100);
    cell.append(el('span', `wage-trend ${percent > 0 ? 'is-up' : 'is-down'}`, `${percent > 0 ? '▲ +' : '▼ '}${percent} %`));
    return cell;
  }
}
