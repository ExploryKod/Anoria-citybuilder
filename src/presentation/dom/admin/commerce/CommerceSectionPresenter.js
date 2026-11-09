import { TRADE_CEASE_WORDING, SATISFACTION_FACTOR_WORDING, SATISFACTION_EFFECTS, DIPLOMATIC_GESTURE_REFUSALS } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { helpSlotHtml, bindStaticHelps } from '../../shell/HelpButton.js';
import { MONTH_ABBREVS } from '../../../../shared/time/TimeCalendar.js';
import { goodLabel, unresolvedTerm } from '../../shell/CatalogVocabulary.js';
import { formatSatisfaction } from '../../../../shared/trade-catalog/satisfaction.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { html } from '../../shell/safeHtml.js';

const STATUS_LABEL = { none: 'Pas de relation', active: 'Actif', suspended: 'Suspendu', expired: 'Rompu' };
/** The tone of a status pill (commerce-section.css). */
const STATUS_TONE = { none: 'none', active: 'active', suspended: 'suspended', expired: 'expired' };
const FLOW_LABEL = { export: 'Vente', import: 'Achat' };

/**
 * Downloads the whole relation rows, as stored: status, satisfaction, contract dates, last order.
 * @param {{ getAllRelations: () => Promise<object[]> }} trade
 */
export async function exportRelationsToJSON(trade) {
  const relations = await trade.getAllRelations();
  const payload = {
    exportDate: new Date().toISOString(),
    relations: [...relations].sort((a, b) => a.cityId.localeCompare(b.cityId)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relations-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** What stopped, and who stopped it, in the words of the trade catalog (TRADE_CEASE_WORDING). */
const ceaseSentence = ({ by, reason }) =>
  `${TRADE_CEASE_WORDING.by[by] ?? unresolvedTerm('cease actor', by)} : ${TRADE_CEASE_WORDING.reasons[reason] ?? unresolvedTerm('cease reason', reason)}`;

/** A score as a bar around zero, with its label, its signed value, its step and its "?". */
const scoreBarHtml = ({ label, score, tier, help }) => {
  const half = Math.abs(score) / 2;
  const fillStyle = score >= 0 ? `left:50%;width:${half}%` : `left:${50 - half}%;width:${half}%`;
  return html`<div class="commerce-satisfaction-bar">
    <div class="commerce-satisfaction-track"><div class="commerce-satisfaction-fill ${score >= 0 ? 'positive' : 'negative'}" style="${fillStyle}"></div></div>
    <span class="commerce-satisfaction-label">${label} : ${tier} (${formatSatisfaction(score)} sur −100 à +100)${help}</span>
  </div>`;
};

/** The climate of the business (the commercial satisfaction, good by good). */
const satisfactionHtml = (score, tier) =>
  scoreBarHtml({ label: 'Climat des affaires', score, tier, help: helpSlotHtml('trade.satisfaction', { figures: { floor: SATISFACTION_EFFECTS.quantityFloor } }) });

/** The memory between the two States (the relation, read from the journal of its events). */
const relationHtml = (score, tier) =>
  scoreBarHtml({ label: 'Relation', score, tier, help: helpSlotHtml('trade.relation') });

/** The date an event was written, from the year and the month stamped on it. */
const eventDate = (event) => `${MONTH_ABBREVS[event.monthIndex]} | ${event.year === 0 ? '0 JC' : `${event.year} ap JC`}`;

/** An event in the catalog's words, with the good or the sum it concerns put in. */
const eventText = (event) => event.wording
  .replace('{good}', () => goodLabel(event.good))
  .replace('{amount}', () => formatEuro(event.cause.amount));

/** The gift gesture: a sum and a button, disabled while the last gift is too recent; what happened last is told under it. */
const giftHtml = (cityId, gift, message) => html`<form class="commerce-gift" data-commerce-gift="${cityId}">
  <h5 class="commerce-sheet__subtitle">Faire un don à la ville</h5>
  <div class="commerce-gift__row">
    <label class="commerce-gift__label">Somme (€)
      <input type="number" name="amount" min="${gift.minAmount}" step="50" value="${gift.minAmount}" inputmode="numeric" required>
    </label>
    <button type="submit" class="commerce-gift__button" ${gift.readyInMonths === null ? '' : 'disabled'}>Offrir</button>
  </div>
  <p class="commerce-gift__note" role="status">${message ?? (gift.readyInMonths === null ? '' : `Prochain don possible dans ${gift.readyInMonths} mois.`)}</p>
</form>`;

/** The chronology of the relation: what marked it, when, and what each still weighs today against what it weighed when it happened (the fading of the memory). */
const chronologyHtml = (events) => {
  if (events.length === 0) return html`<p class="commerce-empty-state">Rien n’a encore marqué la relation.</p>`;
  const signed = (points) => Math.round(points).toLocaleString('fr-FR', { signDisplay: 'exceptZero' });
  return html`<ul class="commerce-sheet__events">${events.map((event) => html`<li>
    <span class="commerce-sheet__event-date">${eventDate(event)}</span>
    <span class="commerce-sheet__event-text">${eventText(event)}</span>
    <span class="commerce-sheet__event-weight">${signed(event.currentWeight)} <small>(${signed(event.weight)} au départ)</small></span>
  </li>`)}</ul>`;
};

/** What the last review gave, factor by factor ("fiabilité des commandes +2 · barrières −1"), in the catalog's words; nothing before the first order. */
const factorsLine = (review) => {
  if (!review) return 'Pas encore de commande';
  const signed = (points) => (Math.round(points * 10) / 10).toLocaleString('fr-FR', { signDisplay: 'exceptZero' });
  return Object.entries(review)
    .map(([name, points]) => `${SATISFACTION_FACTOR_WORDING[name] ?? unresolvedTerm('satisfaction factor', name)} ${signed(points)}`)
    .join(' · ');
};

/**
 * Renders the commerce admin section. First a card per partner city (its state at a glance), then, on a click, the sheet of the relation with that city: its satisfaction, what it
 * exchanges good by good (what stopped, the duty, the price, the balance of the year), and why. Both read the same thing as the world map (`trade.describeTradeRelation`), so the
 * panel and the map never disagree; the sheet is light, nothing but text, where the map is a canvas.
 */
export class CommerceSectionPresenter {
  /**
   * @param {{
   *   trade: { getAllRelations: () => Promise<object[]>, describeTradeRelation: (cityId: string) => Promise<object>, describeTradeRelations: () => Promise<object[]> },
   *   accounting: { getGeneralLedger?: Function, getTradeBalance: (options?: { year?: number | null }) => Promise<object> },
   * }} deps
   */
  constructor({ trade, accounting }) {
    this.trade = trade;
    this.accounting = accounting;
    /** @type {string | null} the city whose sheet is open, none: the cards */
    this.selectedCityId = null;
    /** @type {string | null} what the last gift came to (told under the form, once) */
    this.giftMessage = null;
  }

  /** The player's sentence for a gift that was made or refused. */
  #giftSentence(result, gift) {
    if (result.done) return `Don accepté : la relation gagne ${result.points.toLocaleString('fr-FR')} points.`;
    const words = DIPLOMATIC_GESTURE_REFUSALS[result.reason] ?? unresolvedTerm('gift refusal', result.reason);
    return words.replace('{min}', formatEuro(gift.minAmount)).replace('{months}', String(gift.cooldownMonths));
  }

  /** Called once when the section is first activated. */
  async init() {
    this.#bindRelationsExport();
    const list = document.getElementById('commerce-relations-list');
    // One listener for the cards, the sheet's back button and its refresh: the lists are drawn again at each refresh.
    list?.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest('[data-commerce-city]');
      if (card) {
        this.selectedCityId = card.dataset.commerceCity;
        void this.refresh();
        return;
      }
      if (event.target.closest('[data-commerce-back]')) {
        this.selectedCityId = null;
        void this.refresh();
      }
    });
    list?.addEventListener('submit', (event) => {
      const form = event.target instanceof Element ? event.target.closest('[data-commerce-gift]') : null;
      if (!form) return;
      event.preventDefault();
      void this.#makeGift(form.dataset.commerceGift, Number(new FormData(form).get('amount')));
    });
    await this.refresh();
  }

  async #makeGift(cityId, amount) {
    const { gift } = await this.trade.describeTradeRelation(cityId);
    this.giftMessage = this.#giftSentence(await this.trade.makeGift(cityId, amount), gift);
    await this.refresh();
    this.giftMessage = null;
  }

  /** The whole relation rows, as stored: status, satisfaction, contract dates, last order. */
  #bindRelationsExport() {
    const button = document.getElementById('commerce-relations-export');
    if (!button) return;
    button.addEventListener('click', () => {
      void this.#exportRelationsJson();
    });
  }

  async #exportRelationsJson() {
    await exportRelationsToJSON(this.trade);
  }

  async refresh() {
    await this.#renderRelations();
  }

  async #renderRelations() {
    const container = document.getElementById('commerce-relations-list');
    if (!container) return;
    if (this.selectedCityId) {
      container.innerHTML = html`${await this.#sheetHtml(this.selectedCityId)}`;
      bindStaticHelps(container);
      return;
    }
    const readings = await this.trade.describeTradeRelations();
    container.innerHTML = html`<ul class="commerce-cities">${readings.map((reading) => this.#cardHtml(reading))}</ul>`;
  }

  /** One partner city at a glance: its name, its state, its satisfaction, how many exchanges and how many are stopped. */
  #cardHtml(reading) {
    const stopped = reading.goods.filter((good) => good.ceased !== null).length;
    return html`<li>
      <button type="button" class="commerce-city-card commerce-city-card--${STATUS_TONE[reading.status]}" data-commerce-city="${reading.cityId}">
        <span class="commerce-city-card__head">
          <span class="commerce-city-card__name">${reading.name ?? unresolvedTerm('city name', reading.cityId)}</span>
          <span class="commerce-pill commerce-pill--${STATUS_TONE[reading.status]}">${STATUS_LABEL[reading.status]}</span>
        </span>
        <span class="commerce-city-card__facts">
          ${reading.satisfaction === null ? 'Pas encore d’échange' : `Relation ${reading.relationTier} · climat ${reading.satisfactionTier} (${formatSatisfaction(reading.satisfaction)})`}
          · ${reading.goods.length} échange${reading.goods.length > 1 ? 's' : ''}${stopped > 0 ? ` dont ${stopped} à l’arrêt` : ''}
        </span>
      </button>
    </li>`;
  }

  /** The sheet of the relation with one city. */
  async #sheetHtml(cityId) {
    const [reading, balance] = await Promise.all([this.trade.describeTradeRelation(cityId), this.accounting.getTradeBalance()]);
    // What this year's journal says of the exchanges with this city, good by good (the balance of the trade, seen from the city).
    const partner = balance.total.partners.find((row) => row.cityId === cityId) ?? null;
    const balanceOf = (good, flow) => {
      const row = partner?.goods?.find((candidate) => candidate.good === good);
      if (!row) return null;
      return flow === 'export' ? row.exports : -row.imports;
    };
    const rows = reading.goods.map((good) => {
      const done = balanceOf(good.good, good.flow);
      return html`<tr class="${good.ceased ? 'is-stopped' : ''}">
        <th scope="row">${goodLabel(good.good)}</th>
        <td>${FLOW_LABEL[good.flow]}</td>
        <td>${good.ceased ? ceaseSentence(good.ceased) : 'En cours'}</td>
        <td>
          ${good.satisfaction === null ? '—' : html`<strong>${good.satisfactionTier}</strong> (${formatSatisfaction(good.satisfaction)})`}
          <span class="commerce-sheet__factors">${good.satisfaction === null ? '' : factorsLine(good.review)}</span>
        </td>
        <td class="commerce-sheet__minor">${Math.round(good.ourDuty * 100)} %</td>
        <td class="commerce-sheet__minor">${good.priceRange ? `${good.priceRange.low.toFixed(2)} à ${good.priceRange.high.toFixed(2)} €` : '—'}</td>
        <td>${done === null ? '—' : formatEuro(done)}</td>
      </tr>`;
    });
    return html`
      <div class="commerce-sheet">
        <button type="button" class="commerce-sheet__back" data-commerce-back>← Les villes</button>
        <header class="commerce-sheet__head">
          <h4>${reading.name ?? unresolvedTerm('city name', cityId)}</h4>
          <span class="commerce-pill commerce-pill--${STATUS_TONE[reading.status]}">${STATUS_LABEL[reading.status]}</span>
        </header>
        ${reading.character.length > 0 ? html`<p class="commerce-sheet__character">Caractère : <strong>${reading.character.join(', ')}</strong></p>` : ''}
        ${reading.entry?.culture ? html`<p class="commerce-sheet__culture">${reading.entry.culture}</p>` : ''}
        ${reading.satisfaction === null ? html`<p class="commerce-empty-state">Aucune relation n’est encore ouverte avec cette ville.</p>` : html`
          ${relationHtml(reading.relationScore, reading.relationTier)}
          ${satisfactionHtml(reading.satisfaction, reading.satisfactionTier)}`}
        ${reading.ceased ? html`<p class="commerce-sheet__ceased">${ceaseSentence(reading.ceased)}</p>` : ''}
        ${reading.goods.length === 0 ? '' : html`
          <div class="commerce-sheet__table-wrap">
            <table class="commerce-sheet__table">
              <thead><tr><th scope="col">Bien</th><th scope="col">Sens</th><th scope="col">État</th><th scope="col">Climat</th><th scope="col" class="commerce-sheet__minor">Droit</th><th scope="col" class="commerce-sheet__minor">Prix</th><th scope="col">Solde de l’année</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
        ${reading.satisfaction === null ? '' : html`
          <h5 class="commerce-sheet__subtitle">Ce qui a marqué la relation</h5>
          ${chronologyHtml(reading.relationEvents)}
          ${giftHtml(cityId, reading.gift, this.giftMessage)}`}
      </div>`;
  }
}
