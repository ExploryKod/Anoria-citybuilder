import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { createSliderRow } from '../sliderRow.js';
import { UNRESOLVED_TERM, goodIcon, goodLabel } from '../../shell/CatalogVocabulary.js';
import { administratorPayNotice } from '../../shell/administratorPayNotice.js';

/** What the market says of a skill this month, in words and in the colour family of the journal. */
const SIGNALS = Object.freeze({
  shortage: Object.freeze({ label: 'Pénurie de bras', tone: 'external' }),
  balanced: Object.freeze({ label: 'Équilibre', tone: 'sales' }),
  slack: Object.freeze({ label: 'Chômage qualifié', tone: 'tax-paid' }),
});

/** The regimes of the minimum wage, in the words of the lever (the list itself is the catalog's MINIMUM_WAGE_MODES). */
const MINIMUM_WAGE_MODE_LABELS = Object.freeze([
  ['none', 'Aucun : le marché décide'],
  ['fixed', 'Fixe : un plancher qui ne bouge pas'],
  ['indexed', 'Indexé : suit le coût de la vie chaque janvier'],
]);

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

    const [settings, rentControl, rentQuote] = await Promise.all([
      this.accounting.getSalarySettings(),
      this.accounting.getRentControl(),
      this.accounting.getRentQuote(),
    ]);
    const mode = settings.minimumWageMode;
    levers.replaceChildren(
      this.#floorModeSelect(mode),
      createSliderRow({
        label: 'Salaire minimum',
        scope: 'Hameau',
        min: this.bounds.minimumWage.min,
        max: this.bounds.minimumWage.max,
        value: settings.minimumWage,
        unit: '€/mois',
        active: mode === 'fixed',
        ariaLabel: 'Salaire minimum, en euros par mois — le plancher de tous les salaires, quand la ville en fixe un (réévalué chaque janvier quand il est indexé)',
        store: async (value) => {
          await this.accounting.setSalarySettings({ minimumWage: value });
          await this.refresh();
        },
      }),
      createSliderRow({
        label: 'Salaire minimum / coût de la vie',
        scope: 'Hameau',
        min: this.bounds.minimumWageBasketPercent.min,
        max: this.bounds.minimumWageBasketPercent.max,
        value: Math.round(settings.minimumWageBasketRatio * 100),
        unit: '%',
        active: mode === 'indexed',
        ariaLabel: "Salaire minimum indexé, en pourcentage du coût de la vie d'un citoyen, réévalué chaque janvier",
        store: async (value) => {
          await this.accounting.setSalarySettings({ minimumWageBasketRatio: value / 100 });
          await this.accounting.revalueMinimumWage();
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
        ariaLabel: 'Allocation chômage, en pourcentage du plus bas salaire versé dans la ville',
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
      this.#rentControlSelect(rentControl.enabled),
      createSliderRow({
        label: 'Plafond du loyer',
        scope: 'Hameau',
        min: this.bounds.rentCapPerHouse.min,
        max: this.bounds.rentCapPerHouse.max,
        value: settings.rentCapPerHouse,
        unit: '€/mois',
        active: rentControl.enabled,
        ariaLabel: 'Plafond du loyer mensuel de chaque maison, quand le hameau encadre les loyers : au-delà, le propriétaire ne peut pas le demander et supporte la perte',
        store: async (value) => {
          await this.accounting.setSalarySettings({ rentCapPerHouse: value });
          await this.refresh();
        },
      }),
      this.#rentQuoteNotice(rentQuote),
      createSliderRow({
        label: 'Traitement des administrateurs',
        scope: 'Hameau',
        min: this.bounds.administratorStipend.min,
        max: this.bounds.administratorStipend.max,
        value: settings.administratorStipend,
        unit: '€/mois',
        ariaLabel: "Traitement mensuel de chaque administrateur (la maison du maire), à ne pas confondre avec le salaire minimum : une charge directe pour le hameau ; trop bas, la maison du maire ne paie pas ses besoins et ses compétences restent limitées",
        store: async (value) => {
          await this.accounting.setSalarySettings({ administratorStipend: value });
          await this.refresh();
        },
      }),
      administratorPayNotice(await this.accounting.getAdministratorPayStatus()),
    );

    const social = await this.accounting.getSocialSecurityBoard();
    const socialBoard = document.getElementById('wages-social');
    if (!socialBoard) throw new Error('[wages] #wages-social is missing from the page');
    socialBoard.replaceChildren(this.#socialCard(social));

    const costOfLivingBoard = document.getElementById('wages-cost-of-living');
    if (!costOfLivingBoard) throw new Error('[wages] #wages-cost-of-living is missing from the page');
    costOfLivingBoard.replaceChildren(this.#costOfLivingCard(await this.accounting.getCostOfLiving()));

    const market = this.employment.getLabourMarket();
    if (!market || market.rows.length === 0) {
      board.replaceChildren(el('p', 'commerce-customs-hint', "Aucun marché du travail n'a encore été lu : il faut des ouvriers et des emplois. Les salaires restent à leur niveau de départ."));
      return;
    }
    const { wages } = await this.accounting.getWageBoard(market.rows);
    board.replaceChildren(this.#table(wages));
  }

  /**
   * The first lever of the city's economic regime: no minimum wage (the market alone sets the wages), a fixed one, or one indexed on the cost of living.
   * @param {string} mode one of MINIMUM_WAGE_MODES
   */
  #floorModeSelect(mode) {
    const row = el('div', 'taxes-row');
    const head = el('div', 'taxes-row-head');
    head.append(el('span', 'taxes-row-label', 'Salaire minimum légal'), el('span', 'taxes-row-scope', 'Hameau'));
    const select = el('select');
    select.setAttribute('aria-label', 'Régime du salaire minimum : aucun, fixe, ou indexé sur le coût de la vie');
    for (const [value, label] of MINIMUM_WAGE_MODE_LABELS) {
      const option = el('option', null, label);
      option.value = value;
      option.selected = value === mode;
      select.append(option);
    }
    select.addEventListener('change', async () => {
      await this.accounting.setSalarySettings({ minimumWageMode: select.value });
      // An indexed floor takes the cost of living's measure at once, not only next January.
      if (select.value === 'indexed') await this.accounting.revalueMinimumWage();
      await this.refresh();
    });
    const controls = el('div', 'commerce-customs-controls');
    controls.append(select);
    row.append(head, controls);
    return row;
  }

  /** Whether the hamlet controls rents: without control the owner fixes the rent that covers its charges; with it, the rent cannot exceed the cap. */
  #rentControlSelect(enabled) {
    const row = el('div', 'taxes-row');
    const head = el('div', 'taxes-row-head');
    head.append(el('span', 'taxes-row-label', 'Encadrement des loyers'), el('span', 'taxes-row-scope', 'Hameau'));
    const select = el('select');
    select.setAttribute('aria-label', 'Encadrement des loyers : aucun, ou plafonné');
    for (const [value, label] of [['off', 'Aucun : le propriétaire fixe le loyer'], ['on', 'Plafonné : le loyer ne dépasse pas le plafond']]) {
      const option = el('option', null, label);
      option.value = value;
      option.selected = (value === 'on') === enabled;
      select.append(option);
    }
    select.addEventListener('change', async () => {
      await this.accounting.setRentControlEnabled(select.value === 'on');
      await this.refresh();
    });
    const controls = el('div', 'commerce-customs-controls');
    controls.append(select);
    row.append(head, controls);
    return row;
  }

  /**
   * The rent the owner asks now, and its result when the cap keeps it under what its charges need (a loss, shown as a negative figure for now).
   * @param {{ rent: number, breakEven: number, capped: boolean, monthlyLoss: number } | null} quote null when no house is an owner
   */
  #rentQuoteNotice(quote) {
    if (!quote) return el('p', 'commerce-customs-hint', "Aucun propriétaire : aucun loyer n'est demandé.");
    const text = quote.capped
      ? `Loyer demandé : ${formatEuro(quote.rent)} par maison, plafonné ; il en faudrait ${formatEuro(quote.breakEven)} pour couvrir les charges. Le propriétaire perd ${formatEuro(quote.monthlyLoss)} par mois (résultat : ${formatEuro(-quote.monthlyLoss)}).`
      : `Loyer demandé : ${formatEuro(quote.rent)} par maison, ce qui couvre les charges du propriétaire (après la subvention du hameau).`;
    return el('p', 'commerce-customs-hint', text);
  }

  /**
   * What a month costs a citizen at the prices on the shelves, need by need. A need nobody sells shows "…" and the total with it: no price is guessed.
   * @param {Awaited<ReturnType<import('../../../../contexts/accounting/domain/policies/CostOfLivingPolicy.js')['costOfLivingOf']>> & { householdSize: number }} cost
   */
  #costOfLivingCard(cost) {
    const card = el('section', 'price-card');
    card.append(el('h3', 'price-card-title', 'Coût de la vie — un citoyen, un mois'));
    const table = el('table', 'price-table');
    const row = (label, amount, tone) => {
      const tr = el('tr');
      tr.dataset.step = tone;
      tr.append(el('th', null, label), el('td', 'price-total', amount === null ? UNRESOLVED_TERM : formatEuro(amount)));
      return tr;
    };
    for (const line of cost.lines) {
      const label = `${goodIcon(line.key)} ${goodLabel(line.key)}`;
      table.append(row(line.kind === 'service' ? `${label} (partagé à ${cost.householdSize})` : label, line.amount, 'sales'));
    }
    table.append(row('Total', cost.total, 'external'));
    card.append(table);
    if (cost.missing.length > 0) {
      card.append(el('p', 'commerce-customs-hint', `Personne ne vend encore : ${cost.missing.map((key) => goodLabel(key)).join(', ')}. Le coût de la vie n'est connu que lorsque tout se vend.`));
    }
    return card;
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
        "Chaque mois, un métier où des emplois restent vacants voit son salaire monter (de quelques % au plus) ; un métier où des citoyens qualifiés restent sans emploi le voit baisser, sans jamais passer sous le salaire minimum quand la ville en fixe un. Sans salaire minimum, rien ne retient la baisse : le marché décide seul.",
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
