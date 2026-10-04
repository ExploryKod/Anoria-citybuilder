import { TRADE_CATALOG } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { getResourceBaseValue } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

const STATUS_LABEL = { active: 'Actif', suspended: 'Suspendu', expired: 'Expiré' };

/**
 * Renders the commerce admin section: customs rate slider, active city
 * relations with satisfaction scores, and last-month export revenue.
 */
export class CommerceSectionPresenter {
  /**
   * @param {{
   *   trade: { getAllRelations: () => Promise<object[]> },
   *   accounting: { getCustomsRate: () => number, setCustomsRate: (r: number) => number,
   *                  getGeneralLedger?: Function },
   * }} deps
   */
  constructor({ trade, accounting }) {
    this.trade = trade;
    this.accounting = accounting;
  }

  /** Called once when the section is first activated. */
  async init() {
    this.#bindCustomsSlider();
    await this.refresh();
  }

  async refresh() {
    await Promise.all([this.#renderRelations(), this.#renderBudgetImpact()]);
  }

  #bindCustomsSlider() {
    const slider = document.getElementById('commerce-customs-slider');
    const valueEl = document.getElementById('commerce-customs-value');
    if (!slider || !valueEl) return;

    const current = Math.round(this.accounting.getCustomsRate() * 100);
    slider.value = String(current);
    valueEl.textContent = `${current} %`;

    slider.addEventListener('input', () => {
      const pct = Number(slider.value);
      valueEl.textContent = `${pct} %`;
      this.accounting.setCustomsRate(pct / 100);
    });
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
    const score = rel.satisfactionScore ?? 50;
    const fillClass = score >= 60 ? '' : score >= 30 ? ' medium' : ' low';
    const goodsWanted = entry?.wants?.map((w) => w.good).join(', ') ?? '—';
    const lastOrder = rel.lastOrderMonth != null ? `mois ${rel.lastOrderMonth}` : 'jamais';
    const customsRate = this.accounting.getCustomsRate();

    const priceRows = (entry?.wants ?? [])
      .filter((w) => w.merchantGood)
      .map((w) => {
        const base = getResourceBaseValue(w.good);
        const { spread } = entry.sale;
        const low = +(base * w.baseMultiplier * (1 - spread)).toFixed(2);
        const high = +(base * w.baseMultiplier * (1 + spread)).toFixed(2);
        return `<div class="commerce-relation-row">${w.good} : <strong>${low} à ${high} €/u</strong> · douane ${Math.round(customsRate * 100)} %</div>`;
      })
      .join('');

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
          <div class="commerce-satisfaction-bar">
            <div class="commerce-satisfaction-track">
              <div class="commerce-satisfaction-fill${fillClass}" style="width:${score}%"></div>
            </div>
            <span class="commerce-satisfaction-label">Satisfaction ${score}/100</span>
          </div>
        </div>
      </div>`;
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
      el.textContent = total > 0 ? `+${total.toLocaleString('fr-FR')} €` : '—';
    } catch {
      el.textContent = '—';
    }
  }
}
