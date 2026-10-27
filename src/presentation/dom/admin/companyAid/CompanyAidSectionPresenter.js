/**
 * The Aide aux entreprises section: the policy the player sets for the working capital the city finances for its companies (see CompanyAidCatalog.js): how much of their stock,
 * in which forms (participation, loan, State shareholder), the loan's interest and when it starts, the dividend of the State shareholder, and how many years the decision binds him.
 * The sliders only draft the policy; "Valider et s'engager" stores it, and from then on it cannot be changed until the end of the commitment.
 */
export class CompanyAidSectionPresenter {
  /** @param {{ accounting: object }} deps */
  constructor({ accounting }) {
    this.accounting = accounting;
    /** @type {{ policy: Record<string, number>, committedUntilYear: number | null, year: number, bounds: Record<string, { min: number, max: number }> } | null} */
    this.state = null;
    /** The policy being drafted, in the unit the sliders use (percent, months, years). */
    this.draft = null;
  }

  /** The sliders: id prefix, the policy field, how a slider's number maps to the field's value. */
  static CONTROLS = Object.freeze([
    { id: 'aid-working-capital', field: 'workingCapitalShare', unit: '%', scale: 100 },
    { id: 'aid-loan', field: 'loanShare', unit: '%', scale: 100 },
    { id: 'aid-shareholder', field: 'shareholderShare', unit: '%', scale: 100 },
    { id: 'aid-interest', field: 'loanInterestRate', unit: '%', scale: 100 },
    { id: 'aid-grace', field: 'interestStartsAfterMonths', unit: 'mois', scale: 1 },
    { id: 'aid-payout', field: 'dividendPayoutRate', unit: '%', scale: 100 },
    { id: 'aid-commitment', field: 'commitmentYears', unit: 'ans', scale: 1 },
  ]);

  /** @param {string} id */
  #element(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`[company-aid] #${id} is missing from the page`);
    return node;
  }

  /** Reads the policy and shows it: every slider at the value in force, locked while a commitment binds. */
  async refresh() {
    this.state = await this.accounting.getCompanyAid();
    this.draft = { ...this.state.policy };
    const locked = this.state.committedUntilYear !== null && this.state.year < this.state.committedUntilYear;
    for (const control of CompanyAidSectionPresenter.CONTROLS) {
      const bounds = this.state.bounds[control.field];
      const slider = this.#element(`${control.id}-slider`);
      slider.min = String(Math.round(bounds.min * control.scale));
      slider.max = String(Math.round(bounds.max * control.scale));
      slider.step = '1';
      slider.value = String(Math.round(this.draft[control.field] * control.scale));
      slider.disabled = locked;
      this.#showValue(control);
    }
    this.#element('aid-apply').disabled = locked;
    this.#showParticipation();
    this.#element('aid-commitment').textContent = this.#commitmentText();
    this.#showError('');
    await this.#loadCompanies();
  }

  /** The companies the player can put money into, each with what the city holds in it. */
  async #loadCompanies() {
    this.companies = await this.accounting.describeAidCompanies();
    const select = this.#element('aid-company');
    const chosen = select.value;
    select.replaceChildren(...this.companies.map((company) => new Option(`${company.name} (${company.x}, ${company.y})`, company.buildingId)));
    if (this.companies.some((company) => company.buildingId === chosen)) select.value = chosen;
    this.#showPreview();
  }

  /** What the city holds in the chosen company now, and the stake a contribution as a shareholder would make. */
  #showPreview() {
    const company = this.companies?.find((candidate) => candidate.buildingId === this.#element('aid-company').value);
    const preview = this.#element('aid-preview');
    if (!company) {
      preview.textContent = 'Aucune entreprise.';
      return;
    }
    const amount = Number(this.#element('aid-amount').value);
    const percent = (share) => `${Math.round(share * 1000) / 10} %`;
    const bought = Number.isFinite(amount) && amount > 0 ? amount / company.sharePrice : null;
    const after = bought === null ? null : (company.shareholderShares + bought) / (company.shares + bought);
    const held = `Valeur de l'entreprise : ${Math.round(company.equity)} € · prix d'une part : ${Math.round(company.sharePrice * 100) / 100} € · part de l'État : ${percent(company.stake)}${company.loanOutstanding > 0 ? ` · prêt dû : ${Math.round(company.loanOutstanding)} €` : ''}.`;
    preview.textContent = this.#element('aid-form').value === 'shareholder' && after !== null ? `${held} Après ce versement : ${percent(after)}.` : held;
  }

  #showInjectError(message) {
    const node = this.#element('aid-inject-error');
    node.hidden = message === '';
    node.textContent = message;
  }

  /** @returns {string} what binds the player now, or that nothing does yet */
  #commitmentText() {
    const { committedUntilYear, year } = this.state;
    if (committedUntilYear === null) return "Aucune politique choisie : les valeurs du catalogue s'appliquent. En validant, vous vous engagez pour la durée choisie.";
    if (year < committedUntilYear) return `Engagé jusqu'à l'année ${committedUntilYear} : la politique ne peut plus être modifiée avant.`;
    return `L'engagement a pris fin à l'année ${committedUntilYear} : vous pouvez choisir une nouvelle politique.`;
  }

  #showValue(control) {
    const value = Math.round(this.draft[control.field] * control.scale);
    this.#element(`${control.id}-value`).textContent = `${value} ${control.unit}`;
  }

  /** The participation is what the loan and the shareholder leave of the financing: never set, always shown. */
  #showParticipation() {
    const participation = Math.max(0, Math.round((1 - this.draft.loanShare - this.draft.shareholderShare) * 100));
    this.#element('aid-participation').textContent = `Forme : participation (capital sans contrepartie) : ${participation} % du financement, ce qui reste après le prêt et l'État actionnaire.`;
  }

  #showError(message) {
    const node = this.#element('aid-error');
    node.hidden = message === '';
    node.textContent = message;
  }

  /** Binds the sliders and the button once. */
  bind() {
    for (const control of CompanyAidSectionPresenter.CONTROLS) {
      const slider = this.#element(`${control.id}-slider`);
      slider.addEventListener('input', () => {
        this.draft[control.field] = Number(slider.value) / control.scale;
        this.#showValue(control);
        this.#showParticipation();
      });
    }
    for (const id of ['aid-company', 'aid-form', 'aid-amount']) this.#element(id).addEventListener('input', () => this.#showPreview());
    this.#element('aid-inject-apply').addEventListener('click', async () => {
      this.#showInjectError('');
      try {
        await this.accounting.injectCompanyAid({ buildingId: this.#element('aid-company').value, amount: Number(this.#element('aid-amount').value), form: this.#element('aid-form').value });
        await this.#loadCompanies();
      } catch (error) {
        this.#showInjectError(error.message.replace(/^\[company-aid\]\s*/, ''));
      }
    });
    this.#element('aid-apply').addEventListener('click', async () => {
      this.#showError('');
      try {
        await this.accounting.setCompanyAid(this.draft);
        await this.refresh();
      } catch (error) {
        // The policy refuses what is out of bounds, shares that add up to more than the whole, and a change while a commitment binds: the player is told why.
        this.#showError(error.message.replace(/^\[company-aid\]\s*/, ''));
      }
    });
  }
}
