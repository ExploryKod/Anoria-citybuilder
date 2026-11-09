import { VOLUME_LIMIT_STEP, TRADE_CEASE_WORDING, TRADE_FLOW_WORDING, TRADE_POLICY_REFUSALS, SATISFACTION_FACTOR_WORDING, SATISFACTION_EFFECTS, DIPLOMATIC_GESTURE_REFUSALS } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { helpSlotHtml, bindStaticHelps } from '../../shell/HelpButton.js';
import { MONTH_ABBREVS } from '../../../../shared/time/TimeCalendar.js';
import { goodLabel, unresolvedTerm } from '../../shell/CatalogVocabulary.js';
import { formatSatisfaction } from '../../../../shared/trade-catalog/satisfaction.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { html } from '../../shell/safeHtml.js';
import { bindPager, pageSlice, pagerHtml } from '../../shell/pagination.js';

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
  .replace('{flow}', () => TRADE_FLOW_WORDING[event.flow] ?? unresolvedTerm('trade flow', event.flow))
  .replace('{amount}', () => formatEuro(event.cause.amount));

/** The cease reason an embargo gives, by flow (TradeCeasePolicy: `embargo` stops an import, `export_embargo` an export), the city's and the partner's. */
const EMBARGO_REASON = { export: 'export_embargo', import: 'embargo' };
const PARTNER_EMBARGO_REASON = { export: 'export_partner_embargo', import: 'partner_embargo' };

/** What the section shows while a reading comes back (the same markup game.html holds until the first one). */
const LOADER_HTML = html`<div class="commerce-loader" role="status" aria-live="polite"><span class="commerce-loader__spinner" aria-hidden="true"></span> Chargement du commerce…</div>`;

const FLOW_ARROW = { export: '↗', import: '↙' };

/** The side of an exchange as a small chip: an arrow out for what we sell, in for what we buy. */
const flowChipHtml = (flow) => html`<span class="commerce-chip commerce-chip--${flow}"><span aria-hidden="true">${FLOW_ARROW[flow]}</span> ${FLOW_LABEL[flow]}</span>`;

/**
 * What stops an exchange now, said at once from the journal (the cease marker of the cycle only follows at the next order month): our embargo, then the partner's, then what the cycle
 * found. `tone` colors the row (ok, city, partner, merchants), `by` is who stopped it and `reason` why, in the catalog's words.
 */
const stateOf = (good) => {
  let stop = null;
  let tone = 'merchants';
  if (good.embargoed) { stop = { by: 'city', reason: EMBARGO_REASON[good.flow] }; tone = 'city'; }
  else if (good.partnerEmbargoed) { stop = { by: 'partner', reason: PARTNER_EMBARGO_REASON[good.flow] }; tone = 'partner'; }
  else if (good.ceased) stop = good.ceased;
  if (!stop) return { tone: 'ok', by: 'En cours', reason: null };
  return {
    tone,
    by: TRADE_CEASE_WORDING.by[stop.by] ?? unresolvedTerm('cease actor', stop.by),
    reason: TRADE_CEASE_WORDING.reasons[stop.reason] ?? unresolvedTerm('cease reason', stop.reason),
  };
};

/** A message at the top of the sheet that asks for attention: a tone (danger, warning), a title, and what it holds. */
const calloutHtml = ({ tone, title, content }) => html`<aside class="commerce-callout commerce-callout--${tone}">
  <h5 class="commerce-callout__title">${title}</h5>
  ${content}
</aside>`;

/** What the partner has decreed on us: one chip per good and side, under the callout's title. */
const partnerEmbargoesHtml = (goods) => html`<ul class="commerce-callout__chips">${goods.map((good) => html`<li class="commerce-chip commerce-chip--${good.flow}">${goodLabel(good.good)} <small>(${TRADE_FLOW_WORDING[good.flow]})</small></li>`)}</ul>`;

/** The mission that renews a relation the partner broke: a button, disabled while the wait lasts; what happened last is told under it. */
const renewalHtml = (cityId, renewal, message) => html`<form class="commerce-callout__form" data-commerce-renew="${cityId}">
  <button type="submit" class="commerce-action commerce-action--primary" ${renewal.readyInMonths === null ? '' : 'disabled'}>Envoyer une mission · ${formatEuro(renewal.cost)}</button>
  <p class="commerce-note" role="status">${message ?? (renewal.readyInMonths === null ? '' : `Une mission sera possible dans ${renewal.readyInMonths} mois.`)}</p>
</form>`;

/**
 * The volume limits the city sets by law, one row per good and flow the cities trade: units a month, whoever the partner, filled in the order of the orders; empty: no limit.
 * A figure is kept when the field is left (the `change` event).
 */
const volumeLimitsHtml = (exchanges, limits, message) => {
  const limitOf = (exchange) => limits.find((limit) => limit.flow === exchange.flow && limit.good === exchange.good)?.perMonth ?? '';
  return html`<section class="commerce-panel">
    <h4 class="commerce-panel__title">Limitations en volume</h4>
    <p class="commerce-panel__lead">Un plafond par mois, quel que soit le partenaire : les premières commandes remplissent la place. Vide : pas de limite.</p>
    <ul class="commerce-limits">${exchanges.map((exchange) => html`<li class="commerce-limits__row">
      <span class="commerce-limits__name">${goodLabel(exchange.good)} ${flowChipHtml(exchange.flow)}</span>
      <div class="commerce-stepper">
        <button type="button" class="commerce-stepper__button" data-commerce-limit-step="${exchange.flow}:${exchange.good}" data-direction="-1"
          aria-label="Diminuer la limite : ${goodLabel(exchange.good)} (${FLOW_LABEL[exchange.flow]})">−</button>
        <label class="commerce-stepper__value">
          <input type="number" class="commerce-stepper__input" min="1" step="1" inputmode="numeric" placeholder="Sans limite" value="${limitOf(exchange)}"
            data-commerce-limit="${exchange.flow}:${exchange.good}" aria-label="Limite par mois : ${goodLabel(exchange.good)} (${FLOW_LABEL[exchange.flow]})">
          <span class="commerce-stepper__unit">/ mois</span>
        </label>
        <button type="button" class="commerce-stepper__button" data-commerce-limit-step="${exchange.flow}:${exchange.good}" data-direction="1"
          aria-label="Augmenter la limite : ${goodLabel(exchange.good)} (${FLOW_LABEL[exchange.flow]})">+</button>
      </div>
    </li>`)}</ul>
    <p class="commerce-note" role="status">${message ?? ''}</p>
  </section>`;
};

/** The button that decrees (or lifts) the embargo on one exchange: it names its good and its flow for the click handler. */
const embargoButtonHtml = ({ good, flow, embargoed }) => html`<button type="button" class="commerce-action ${embargoed ? 'commerce-action--lift' : 'commerce-action--embargo'}" data-commerce-embargo="${flow}:${good}" data-decreed="${embargoed ? 'false' : 'true'}">${embargoed ? 'Lever l’embargo' : 'Embargo'}</button>`;

/** The two shortcuts under the exchanges: embargo, or lift, a whole side of the trade at once. Offered only where the partner trades something in that side. */
const embargoFlowsHtml = (goods, message) => {
  const buttons = ['export', 'import'].filter((flow) => goods.some((good) => good.flow === flow)).map((flow) => {
    const allEmbargoed = goods.filter((good) => good.flow === flow).every((good) => good.embargoed);
    return html`<button type="button" class="commerce-action ${allEmbargoed ? 'commerce-action--lift' : 'commerce-action--embargo'}" data-commerce-embargo-flow="${flow}" data-decreed="${allEmbargoed ? 'false' : 'true'}">${allEmbargoed ? 'Lever l’embargo sur' : 'Embargo sur'} ${TRADE_FLOW_WORDING[flow]}</button>`;
  });
  return html`<div class="commerce-sheet__bulk">
    <div class="commerce-sheet__bulk-row">${buttons}</div>
    <p class="commerce-note" role="status">${message ?? ''}</p>
  </div>`;
};

/** The gift gesture: a sum and a button, disabled while the last gift is too recent; what happened last is told under it. */
const giftHtml = (cityId, gift, message) => html`<section class="commerce-panel">
  <h4 class="commerce-panel__title">Faire un don à la ville</h4>
  <form class="commerce-gift" data-commerce-gift="${cityId}">
    <label class="commerce-gift__label">Somme (€)
      <input type="number" name="amount" min="${gift.minAmount}" step="50" value="${gift.minAmount}" inputmode="numeric" required>
    </label>
    <button type="submit" class="commerce-action commerce-action--primary" ${gift.readyInMonths === null ? '' : 'disabled'}>Offrir</button>
  </form>
  <p class="commerce-note" role="status">${message ?? (gift.readyInMonths === null ? '' : `Prochain don possible dans ${gift.readyInMonths} mois.`)}</p>
</section>`;

/** The chronology of the relation: what marked it, when, and what each still weighs today against what it weighed when it happened (the fading of the memory). */
const chronologyHtml = (events, requestedPage) => {
  if (events.length === 0) return html`<p class="commerce-empty-state">Rien n’a encore marqué la relation.</p>`;
  const signed = (points) => Math.round(points).toLocaleString('fr-FR', { signDisplay: 'exceptZero' });
  // Ten events a page, the newest first: the older ones are behind the bar at the foot of the list.
  const { items, page, pageCount } = pageSlice(events, requestedPage);
  return html`<ul class="commerce-sheet__events">${items.map((event) => html`<li>
    <span class="commerce-sheet__event-date">${eventDate(event)}</span>
    <span class="commerce-sheet__event-text">${eventText(event)}</span>
    <span class="commerce-sheet__event-weight">${signed(event.currentWeight)} <small>(${signed(event.weight)} au départ)</small></span>
  </li>`)}</ul>${pagerHtml({ page, pageCount })}`;
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
    /** @type {string | null} what is drawn now: a city id (its sheet), '' (the cards), null (nothing yet: the loader of game.html is showing) */
    this.renderedView = null;
    /** @type {number} the page of the relation's chronology shown (PAGE_SIZE events a page); the first one whenever a sheet is opened */
    this.chronologyPage = 1;
    /** @type {string | null} what the last embargo did or why it was refused (told under the table, once) */
    this.embargoMessage = null;
    /** @type {string | null} what the last mission to renew a relation did or why it was refused (told under its button, once) */
    this.renewalMessage = null;
    /** @type {string | null} what the last volume limit did or why it was refused (told under the limits, once) */
    this.limitMessage = null;
  }

  /** The player's sentence for a mission that renewed the relation or was refused. */
  #renewalSentence(result, renewal) {
    if (result.done) return 'Mission réussie : la relation est renouée.';
    const words = TRADE_POLICY_REFUSALS[result.reason] ?? unresolvedTerm('renewal refusal', result.reason);
    return words.replace('{months}', String(renewal.cooldownMonths));
  }

  async #renewRelation(cityId) {
    const { renewal } = await this.trade.describeTradeRelation(cityId);
    this.renewalMessage = this.#renewalSentence(await this.trade.renewRelation(cityId), renewal);
    await this.refresh();
    this.renewalMessage = null;
  }

  async #setVolumeLimit(flow, good, perMonth) {
    const result = await this.trade.setVolumeLimit(flow, good, perMonth);
    this.limitMessage = result.done ? null : TRADE_POLICY_REFUSALS[result.reason] ?? unresolvedTerm('limit refusal', result.reason);
    await this.refresh();
    this.limitMessage = null;
  }

  /** The player's sentence for an embargo that was decreed, lifted or refused. */
  #embargoSentence(result, decreed) {
    if (!result.done) return TRADE_POLICY_REFUSALS[result.reason] ?? unresolvedTerm('embargo refusal', result.reason);
    const goods = result.goods.map((good) => goodLabel(good)).join(', ');
    return `${decreed ? 'Embargo décrété' : 'Embargo levé'} : ${goods}.`;
  }

  async #setEmbargo(cityId, measure) {
    this.embargoMessage = this.#embargoSentence(await this.trade.setEmbargo(cityId, measure), measure.decreed);
    await this.refresh();
    this.embargoMessage = null;
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
        this.chronologyPage = 1;
        void this.refresh();
        return;
      }
      if (event.target.closest('[data-commerce-back]')) {
        this.selectedCityId = null;
        this.chronologyPage = 1;
        void this.refresh();
        return;
      }
      // + and − move a limit by one step: from no limit, + sets the first step; going under 1 removes the limit.
      const stepper = event.target.closest('[data-commerce-limit-step]');
      if (stepper) {
        const [flow, good] = stepper.dataset.commerceLimitStep.split(':');
        const input = stepper.closest('.commerce-stepper').querySelector('input');
        const next = (input.value === '' ? 0 : Number(input.value)) + Number(stepper.dataset.direction) * VOLUME_LIMIT_STEP;
        void this.#setVolumeLimit(flow, good, next < 1 ? null : next);
        return;
      }
      const one = event.target.closest('[data-commerce-embargo]');
      if (one) {
        const [flow, good] = one.dataset.commerceEmbargo.split(':');
        void this.#setEmbargo(this.selectedCityId, { flow, good, decreed: one.dataset.decreed === 'true' });
        return;
      }
      const side = event.target.closest('[data-commerce-embargo-flow]');
      if (side) void this.#setEmbargo(this.selectedCityId, { flow: side.dataset.commerceEmbargoFlow, good: null, decreed: side.dataset.decreed === 'true' });
    });
    list?.addEventListener('submit', (event) => {
      if (!(event.target instanceof Element)) return;
      const renew = event.target.closest('[data-commerce-renew]');
      if (renew) {
        event.preventDefault();
        void this.#renewRelation(renew.dataset.commerceRenew);
        return;
      }
      const form = event.target.closest('[data-commerce-gift]');
      if (!form) return;
      event.preventDefault();
      void this.#makeGift(form.dataset.commerceGift, Number(new FormData(form).get('amount')));
    });
    // The page buttons under the chronology of a relation.
    if (list) {
      bindPager(list, (page) => {
        this.chronologyPage = page;
        void this.refresh();
      });
    }
    // A volume limit is kept when its field is left: a figure sets it, an empty field removes it.
    list?.addEventListener('change', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-commerce-limit]') : null;
      if (!field) return;
      const [flow, good] = field.dataset.commerceLimit.split(':');
      void this.#setVolumeLimit(flow, good, field.value === '' ? null : Number(field.value));
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
    // A view that is not on screen yet (the first reading, a city's sheet, the way back to the cities) shows the loader while its reading comes back; a view drawn again
    // in place (after an embargo, a gift) stays on screen until the new one replaces it.
    const view = this.selectedCityId ?? '';
    if (this.renderedView !== view) container.innerHTML = html`${LOADER_HTML}`;
    if (this.selectedCityId) {
      container.innerHTML = html`${await this.#sheetHtml(this.selectedCityId)}`;
      bindStaticHelps(container);
    } else {
      const [readings, limits] = await Promise.all([this.trade.describeTradeRelations(), this.trade.listVolumeLimits()]);
      container.innerHTML = html`<ul class="commerce-cities">${readings.map((reading) => this.#cardHtml(reading))}</ul>
        ${volumeLimitsHtml(this.trade.listTradedExchanges(), limits, this.limitMessage)}`;
    }
    this.renderedView = view;
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
    const exchanges = reading.goods.map((good) => {
      const done = balanceOf(good.good, good.flow);
      const state = stateOf(good);
      return html`<li class="commerce-exchange commerce-exchange--${state.tone}">
        <div class="commerce-exchange__head">
          <span class="commerce-exchange__name">${goodLabel(good.good)}</span>
          ${flowChipHtml(good.flow)}
          <span class="commerce-pill commerce-pill--${state.tone}">${state.by}</span>
        </div>
        ${state.reason ? html`<p class="commerce-exchange__reason">${state.reason}</p>` : ''}
        <dl class="commerce-exchange__figures">
          <div><dt>Climat</dt><dd>${good.satisfaction === null ? '—' : `${good.satisfactionTier} (${formatSatisfaction(good.satisfaction)})`}</dd></div>
          <div><dt>Droit</dt><dd>${Math.round(good.ourDuty * 100)} %</dd></div>
          <div><dt>Prix</dt><dd>${good.priceRange ? `${good.priceRange.low.toFixed(2)} à ${good.priceRange.high.toFixed(2)} €` : '—'}</dd></div>
          <div><dt>Solde de l’année</dt><dd>${done === null ? '—' : formatEuro(done)}</dd></div>
        </dl>
        ${good.satisfaction === null ? '' : html`<p class="commerce-exchange__factors">${factorsLine(good.review)}</p>`}
        ${reading.status === 'active' ? html`<div class="commerce-exchange__action">${embargoButtonHtml(good)}</div>` : ''}
      </li>`;
    });
    const partnerEmbargoes = reading.goods.filter((good) => good.partnerEmbargoed);
    return html`
      <div class="commerce-sheet">
        <button type="button" class="commerce-sheet__back" data-commerce-back>← Les villes</button>
        <header class="commerce-sheet__head">
          <h4>${reading.name ?? unresolvedTerm('city name', cityId)}</h4>
          <span class="commerce-pill commerce-pill--${STATUS_TONE[reading.status]}">${STATUS_LABEL[reading.status]}</span>
        </header>
        ${reading.development ? html`<p class="commerce-sheet__character">Niveau de développement : <strong>${reading.development.label}</strong></p>` : ''}
        ${reading.character.length > 0 ? html`<p class="commerce-sheet__character">Caractère : <strong>${reading.character.join(', ')}</strong></p>` : ''}
        ${reading.entry?.culture ? html`<p class="commerce-sheet__culture">${reading.entry.culture}</p>` : ''}
        ${reading.ceased ? calloutHtml({
          tone: 'danger',
          title: 'Relation rompue',
          content: html`<p class="commerce-callout__text">${ceaseSentence(reading.ceased)}</p>${reading.renewal ? renewalHtml(cityId, reading.renewal, this.renewalMessage) : ''}`,
        }) : ''}
        ${partnerEmbargoes.length > 0 ? calloutHtml({
          tone: 'warning',
          title: 'Embargo du partenaire',
          content: html`<p class="commerce-callout__text">Il a décrété un embargo : ces échanges sont à l’arrêt jusqu’à son terme.</p>${partnerEmbargoesHtml(partnerEmbargoes)}`,
        }) : ''}
        ${reading.satisfaction === null ? html`<p class="commerce-empty-state">Aucune relation n’est encore ouverte avec cette ville.</p>` : html`
          <div class="commerce-sheet__bars">
            ${relationHtml(reading.relationScore, reading.relationTier)}
            ${satisfactionHtml(reading.satisfaction, reading.satisfactionTier)}
          </div>`}
        ${reading.goods.length === 0 ? '' : html`
          <section class="commerce-panel">
            <h4 class="commerce-panel__title">Échanges</h4>
            <ul class="commerce-exchanges">${exchanges}</ul>
            ${reading.status === 'active' ? embargoFlowsHtml(reading.goods, this.embargoMessage) : ''}
          </section>`}
        ${reading.satisfaction === null ? '' : html`
          <section class="commerce-panel">
            <h4 class="commerce-panel__title">Ce qui a marqué la relation</h4>
            ${chronologyHtml(reading.relationEvents, this.chronologyPage)}
          </section>
          ${giftHtml(cityId, reading.gift, this.giftMessage)}`}
      </div>`;
  }
}
