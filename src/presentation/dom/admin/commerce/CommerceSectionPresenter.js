import { TRADE_CATALOG, TRADE_CEASE_WORDING } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { goodLabel, unresolvedTerm } from '../../shell/CatalogVocabulary.js';
import { getSessionGameTime } from '../../../../composition/sessionRuntime.js';
import { satisfactionOf, formatSatisfaction } from '../../../../shared/trade-catalog/satisfaction.js';
import { getResourceBaseValue } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';

const STATUS_LABEL = { active: 'Actif', suspended: 'Suspendu', expired: 'Expiré' };

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

/**
 * Renders the commerce admin section: active city
 * relations with satisfaction scores, and last-month export revenue.
 */
export class CommerceSectionPresenter {
  /**
   * @param {{
   *   trade: { getAllRelations: () => Promise<object[]> },
   *   accounting: { getCustomsDuty: (authority: string, flow: string, good: string, turn: number) => number,
   *                  getGeneralLedger?: Function },
   * }} deps
   */
  constructor({ trade, accounting }) {
    this.trade = trade;
    this.accounting = accounting;
  }

  /** Called once when the section is first activated. */
  async init() {
    this.#bindRelationsExport();
    await this.refresh();
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
    await Promise.all([this.#renderRelations(), this.#renderBudgetImpact()]);
  }

  async #renderRelations() {
    const container = document.getElementById('commerce-relations-list');
    if (!container) return;

    const relations = await this.trade.getAllRelations();
    if (relations.length === 0) {
      container.innerHTML = '<p class="commerce-empty-state">Aucune relation commerciale active.</p>';
      return;
    }

    container.innerHTML = relations.map((rel) => this.#relationCard(rel)).join('');
  }

  /** @param {object} rel */
  #relationCard(rel) {
    const entry = TRADE_CATALOG.find((e) => e.cityId === rel.cityId);
    const cityLabel = rel.cityId.charAt(0).toUpperCase() + rel.cityId.slice(1);
    const status = rel.status ?? 'active';
    const statusLabel = STATUS_LABEL[status] ?? status;
    const score = satisfactionOf(rel);
    const signed = formatSatisfaction(score);
    const half = Math.abs(score) / 2;
    const fillStyle = score >= 0
      ? `left:50%;width:${half}%`
      : `left:${50 - half}%;width:${half}%`;
    const goodsWanted = entry?.wants?.map((w) => w.good).join(', ') ?? '—';
    const lastOrder = rel.lastOrderMonth != null ? `mois ${rel.lastOrderMonth}` : 'jamais';

    const priceRows = (entry?.wants ?? [])
      .filter((w) => w.merchantGood)
      .map((w) => {
        const base = getResourceBaseValue(w.good);
        const { spread } = entry.sale;
        const customsRate = this.accounting.getCustomsDuty('anoria', 'export', w.good, getSessionGameTime());
        const low = +(base * w.baseMultiplier * (1 - spread)).toFixed(2);
        const high = +(base * w.baseMultiplier * (1 + spread)).toFixed(2);
        return `<div class="commerce-relation-row">${w.good} : <strong>${low} à ${high} €/u</strong> · douane ${Math.round(customsRate * 100)} %</div>`;
      })
      .join('');

    const ceaseRows = this.#ceaseRows(rel);

    return `
      <div class="commerce-relation-card ${status !== 'active' ? status : ''}">
        <div class="commerce-relation-header">
          <span class="commerce-relation-city">${cityLabel}</span>
          <span class="commerce-relation-status ${status !== 'active' ? status : ''}">${statusLabel}</span>
        </div>
        <div class="commerce-relation-body">
          <div class="commerce-relation-row">Biens demandés : <strong>${goodsWanted}</strong></div>
          ${priceRows}
          <div class="commerce-relation-row">Dernier ordre : <strong>${lastOrder}</strong></div>
          ${ceaseRows}
          <div class="commerce-satisfaction-bar">
            <div class="commerce-satisfaction-track">
              <div class="commerce-satisfaction-fill ${score >= 0 ? 'positive' : 'negative'}" style="${fillStyle}"></div>
            </div>
            <span class="commerce-satisfaction-label">Satisfaction ${signed} (−100 à +100)</span>
          </div>
        </div>
      </div>`;
  }

  /**
   * Who ceased to deal and why: the city for the whole relation, our merchants for one good of one flow (imports and exports
   * apart). The words come from the trade catalog (TRADE_CEASE_WORDING).
   * @param {{ ceased: object | null, importCeased: Record<string, object>, exportCeased: Record<string, object> }} rel
   */
  #ceaseRows(rel) {
    const say = ({ by, reason }) =>
      `${TRADE_CEASE_WORDING.by[by] ?? unresolvedTerm('cease actor', by)} : ${TRADE_CEASE_WORDING.reasons[reason] ?? unresolvedTerm('cease reason', reason)}`;
    const rows = [];
    if (rel.ceased) rows.push(`<div class="commerce-relation-row">${say(rel.ceased)}</div>`);
    for (const [good, ceased] of Object.entries(rel.importCeased)) {
      rows.push(`<div class="commerce-relation-row">Import ${goodLabel(good)} — ${say(ceased)}</div>`);
    }
    for (const [good, ceased] of Object.entries(rel.exportCeased)) {
      rows.push(`<div class="commerce-relation-row">Export ${goodLabel(good)} — ${say(ceased)}</div>`);
    }
    return rows.join('');
  }

  async #renderBudgetImpact() {
    const el = document.getElementById('commerce-export-this-month');
    if (!el) return;

    if (typeof this.accounting.getGeneralLedger !== 'function') {
      el.textContent = '—';
      return;
    }

    try {
      const ledger = await this.accounting.getGeneralLedger({ type: 'export' });
      const entries = ledger?.entries ?? ledger ?? [];
      const total = entries
        .filter((e) => e?.type?.startsWith('export_'))
        .reduce((sum, e) => sum + (e.amount ?? 0), 0);
      el.textContent = total > 0 ? `+${formatEuro(total)}` : '—';
    } catch {
      el.textContent = '—';
    }
  }
}
