import { showActiveHamletNameIn } from '../hamletLabel.js';
import { buildingName } from '../../shell/CatalogVocabulary.js';
import { formatEuro, formatYearlyRate } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { balanceSheetView } from '../../info/views/balanceSheetView.js';
import { helpButton } from '../../shell/HelpButton.js';

/** A share of the deposits, as the player reads it: "20 %". @param {number} ratio */
const formatShare = (ratio) => `${(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

/**
 * The central bank's section: its two levers the player sets, the policy rate (taux directeur) and the reserve ratio (réserve obligatoire), and what they give today
 * (the savings rate, each loan's rate at the city's health, the bank's credit to the companies, the bank's cash against its reserve, what it owes the central bank).
 * The sliders move the levers only while a central bank works; otherwise they show the catalog's defaults, locked, and the notice says why
 * (LoanRatePolicy.policyRateStatusOf). When the bank's losses ate its capital, the section offers the two ways out: recapitalise it, or liquidate it. The building
 * names come from the catalog.
 */
class CentralBankSectionPresenter {
  /** @param {{ accounting: object, gameplay: object }} deps */
  constructor({ accounting, gameplay }) {
    if (!gameplay?.liquidateBank) throw new Error('[central-bank] the section needs gameplay.liquidateBank: the player may liquidate an insolvent bank from it');
    this.accounting = accounting;
    this.gameplay = gameplay;
    const bounds = accounting.getFiscalSliderBounds();
    /** The two levers: their slider, how a value reads, how it is stored, what is said when it is not. */
    this.levers = [
      { id: 'policy-rate', bounds: bounds.policyRatePercent, format: formatYearlyRate, store: (value) => accounting.setPolicyRate(value), failure: "Le taux directeur n'a pas pu être changé." },
      { id: 'reserve-ratio', bounds: bounds.reserveRatioPercent, format: formatShare, store: (value) => accounting.setReserveRatio(value), failure: "La réserve obligatoire n'a pas pu être changée." },
    ];
  }

  /** @param {string} id */
  #element(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`[central-bank] #${id} is missing from the page`);
    return node;
  }

  /** Binds the sliders and the rescue buttons once: a move shows the value, the release stores it and reads what it gives. */
  bind() {
    for (const lever of this.levers) {
      const slider = this.#element(`${lever.id}-slider`);
      slider.min = String(lever.bounds.min);
      slider.max = String(lever.bounds.max);
      slider.addEventListener('input', () => {
        this.#element(`${lever.id}-value`).textContent = lever.format(Number(slider.value) / 100);
      });
      slider.addEventListener('change', async () => {
        try {
          await lever.store(Number(slider.value) / 100);
          this.#showError('');
        } catch (error) {
          console.error(`[central-bank] the ${lever.id} was not stored:`, error);
          this.#showError(lever.failure);
        }
        await this.refresh();
      });
    }
    this.#element('bank-recapitalise').addEventListener('click', async () => {
      const result = await this.accounting.recapitaliseBank();
      this.#showError(result.recorded ? '' : `La ville n'a pas les ${formatEuro(result.amount)} qu'il faut pour recapitaliser la banque.`);
      await this.refresh();
    });
    this.#element('bank-liquidate').addEventListener('click', async () => {
      // The bank is demolished, which cannot be undone: the player is asked once more.
      if (!window.confirm(this.#element('bank-insolvency-text').textContent)) return;
      const outcome = await this.gameplay.liquidateBank();
      this.#showError(outcome.liquidated ? '' : "La banque n'a pas pu être liquidée.");
      await this.refresh();
    });
  }

  /** Reads the levers, what they give and the bank's state, and shows them. */
  async refresh() {
    const [policy, solvency] = await Promise.all([this.accounting.getPolicyRate(), this.accounting.getBankSolvency()]);
    const name = buildingName(policy.centralBankType);

    const showLever = (id, value, format) => {
      const slider = this.#element(`${id}-slider`);
      slider.value = String(Math.round(value * 100));
      slider.disabled = !policy.available;
      this.#element(`${id}-value`).textContent = format(value);
    };
    showLever('policy-rate', policy.rate, formatYearlyRate);
    showLever('reserve-ratio', policy.reserveRatio, formatShare);

    const notice = this.#element('policy-rate-notice');
    notice.hidden = policy.available;
    notice.textContent = policy.available ? '' : this.#reasonText(policy.reasons, name, policy);
    // The levers are federal, the refinancing is the State's own: a State without its own central bank at work cannot refinance its bank.
    const refinancing = this.#element('refinancing-notice');
    refinancing.hidden = policy.refinancingAvailable;
    refinancing.textContent = policy.refinancingAvailable
      ? ''
      : `Cet État n'a pas de ${name} en activité : sa banque ne peut pas être refinancée, un retrait ou un prêt qu'elle ne peut pas payer est refusé.`;

    this.#element('policy-rate-savings').textContent = formatYearlyRate(policy.savingsRate);
    this.#element('policy-rate-saving-share').textContent = formatShare(policy.householdSavingShare);
    this.#element('policy-rate-loan-bank').textContent = formatYearlyRate(policy.loanRates.bank);
    this.#element('policy-rate-loan-commercial').textContent = formatYearlyRate(policy.loanRates.commercial);
    this.#element('policy-rate-company-credit').textContent = formatYearlyRate(policy.companyCreditRate);
    this.#element('policy-rate-refinancing').textContent = formatEuro(policy.refinancingOutstanding);
    // No bank built: there is no cash, reserve or equity to show, and the line shows a dash rather than a zero.
    const noBank = '—';
    this.#element('bank-reserve-position').textContent = policy.bankPosition
      ? `${formatEuro(policy.bankPosition.reserves)} / ${formatEuro(policy.bankPosition.requiredReserve)}`
      : noBank;
    this.#element('bank-equity').textContent = solvency ? formatEuro(solvency.equity) : noBank;
    this.#element('bank-capital-ratio').textContent = solvency ? (solvency.ratio === null ? noBank : formatShare(solvency.ratio)) : noBank;
    this.#element('policy-rate-corridor').textContent = `${formatYearlyRate(policy.corridor.deposit)} · ${formatYearlyRate(policy.corridor.main)} · ${formatYearlyRate(policy.corridor.marginal)}`;
    const borrowing = await this.accounting.getCityBorrowing();
    this.#element('city-debt-ceiling').textContent = `${formatEuro(borrowing.debt)} / ${formatEuro(borrowing.ceiling)}`;
    this.#element('bank-collateral').textContent = policy.bankPosition ? formatEuro(policy.bankPosition.collateralCapacity) : noBank;
    this.#element('bank-deposits').textContent = policy.bankPosition ? formatEuro(policy.bankPosition.deposits) : noBank;

    // The central bank's own books (it has no building, so no panel shows them): only the lines that hold something.
    this.#element('central-bank-books').replaceChildren(balanceSheetView(await this.accounting.getCentralBankBooks(), {
      onlyHeld: true,
      note: 'Les comptes de la banque centrale de cet État, tels qu’ils sont aujourd’hui. Elle ne détient pas d’argent à elle : ce qu’elle doit au Trésor et aux banques (leurs réserves) fait face à ce qu’elle leur a prêté, à la dotation de fondation de l’État et aux devises qu’elle a converties.',
    }));

    this.#attachHelps({ policy, solvency, borrowing });

    const insolvency = this.#element('bank-insolvency');
    // The supervisor's word: a bank thin on capital is warned, then its lending is frozen, then (equity below nothing) it is insolvent and may be liquidated.
    const thin = solvency && solvency.capitalStatus !== 'sound';
    insolvency.hidden = !thin;
    this.#element('bank-liquidate').hidden = !solvency?.insolvent;
    if (thin) {
      const bank = buildingName(solvency.bankType);
      const needed = formatEuro(Math.ceil(Math.max(0, policy.capitalRatios.warning * solvency.loans) - solvency.equity));
      const share = solvency.ratio === null ? '' : `, soit ${formatShare(solvency.ratio)} de ses prêts`;
      const texts = {
        warning: `${bank} manque de fonds propres : ${formatEuro(solvency.equity)}${share}. Sous ${formatShare(policy.capitalRatios.minimum)}, le superviseur gèlera ses prêts. `,
        frozen: `${bank} a ses prêts gelés par le superviseur : ${formatEuro(solvency.equity)} de fonds propres${share}, sous le minimum de ${formatShare(policy.capitalRatios.minimum)}. Ni la ville ni les entreprises ne peuvent emprunter. `,
        insolvent: `${bank} est insolvable : ses pertes dépassent son capital (${formatEuro(solvency.equity)}). `,
      };
      this.#element('bank-insolvency-text').textContent = texts[solvency.capitalStatus]
        + `Recapitaliser : la ville apporte ${needed} en capital. `
        + (solvency.insolvent ? 'Liquider : la banque est démolie, la ville rembourse d\'un coup ses prêts, les épargnants récupèrent ce que sa caisse permet et la ville garantit le reste.' : '');
      this.#element('bank-recapitalise').textContent = `Recapitaliser (${needed})`;
    }
  }

  /**
   * A "?" (HelpCatalog.js) after the label of the line whose value sits in `valueId`: what the term is, with the figures of the moment. Put again at each refresh, since the
   * state a text is written for moves with the bank. A line the bank does not yet have (no bank built) has none.
   * @param {string} valueId
   * @param {string} id the entry of the help catalog
   * @param {{ state?: string, figures?: Record<string, number> }} reading
   */
  #help(valueId, id, reading) {
    const value = this.#element(valueId);
    // A line of the effects list is `<div><dt>label</dt><dd>value</dd></div>`; a lever's value sits beside the label of its row.
    const label = value.parentElement.querySelector(':scope > dt') ?? value.closest('.taxes-row')?.querySelector('.taxes-row-label');
    if (!label) throw new Error(`[central-bank] #${valueId} has no label to put a "?" on`);
    label.querySelector(':scope > .help-btn')?.remove();
    label.append(helpButton(id, reading));
  }

  /** The "?" of the section: only on what is not obvious (the levers, the bank's health and its link with the central bank). */
  #attachHelps({ policy, solvency, borrowing }) {
    const catalog = this.accounting.getBankHelpFigures();
    this.#help('policy-rate-value', 'bank.policyRate', { figures: { rate: policy.rate, marginalSpread: catalog.marginalSpread, depositSpread: catalog.depositSpread } });
    this.#help('reserve-ratio-value', 'bank.reserveRatio', { figures: { ratio: policy.reserveRatio } });
    this.#help('policy-rate-saving-share', 'bank.savingShare', { figures: { share: policy.householdSavingShare } });
    this.#help('policy-rate-company-credit', 'bank.companyCredit', { figures: { rate: policy.companyCreditRate, months: catalog.companyCreditCeilingMonths } });
    this.#help('policy-rate-corridor', 'bank.corridor', { figures: { deposit: policy.corridor.deposit, main: policy.corridor.main, marginal: policy.corridor.marginal } });
    this.#help('policy-rate-refinancing', 'bank.refinancing', { figures: { owed: policy.refinancingOutstanding } });
    this.#help('city-debt-ceiling', 'economy.debt', {
      state: borrowing.headroom > 0 ? 'room' : 'ceiling',
      figures: { gross: borrowing.debt, ceiling: borrowing.ceiling, headroom: borrowing.headroom },
    });
    // What the bank holds or owes exists only once a bank is built: before that the lines show a dash and explain nothing.
    if (policy.bankPosition) {
      const { reserves, requiredReserve, collateralCapacity } = policy.bankPosition;
      this.#help('bank-reserve-position', 'bank.reservePosition', { state: reserves >= requiredReserve ? 'ok' : 'short', figures: { reserves, required: requiredReserve } });
      this.#help('bank-collateral', 'bank.collateral', { figures: { capacity: collateralCapacity, haircut: catalog.collateralHaircut } });
    }
    if (solvency && solvency.ratio !== null) {
      this.#help('bank-capital-ratio', 'bank.capitalRatio', {
        state: solvency.capitalStatus,
        figures: { ratio: solvency.ratio, warning: policy.capitalRatios.warning, minimum: policy.capitalRatios.minimum, cap: catalog.depositGuaranteeCap },
      });
    }
  }

  /** @param {string[]} reasons @param {string} name the central bank's name @param {{ rate: number, reserveRatio: number }} inForce the levers in force */
  #reasonText(reasons, name, inForce) {
    const kept = `le taux directeur reste à ${formatYearlyRate(inForce.rate)} et la réserve obligatoire à ${formatShare(inForce.reserveRatio)} dans toute la fédération.`;
    if (reasons.includes('noCentralBank')) return `${name} : aucun État de la fédération n'en a ; à construire dans un hameau pour fixer les taux ; d'ici là, ${kept}`;
    if (reasons.includes('notStaffed')) return `${name} : dans aucun État de la fédération tous ses postes ne sont pourvus par nomination (la maison des administrateurs) ; d'ici là, ${kept}`;
    throw new Error(`[central-bank] no wording for the reasons ${reasons.join(', ')}`);
  }

  /** @param {string} message */
  #showError(message) {
    const node = this.#element('policy-rate-error');
    node.hidden = message === '';
    node.textContent = message;
  }
}

/** @param {{ accounting: object, gameplay: object }} deps */
export function initCentralBankSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-centralBank');
  if (!section) return;

  // The nav button, the section's title and the city ledger's line name the building as the catalog does.
  const name = buildingName(deps.accounting.getCentralBankType());
  const navButton = document.getElementById('admin-nav-centralBank');
  if (!navButton) throw new Error('[central-bank] #admin-nav-centralBank is missing from the page');
  navButton.title = name;
  navButton.setAttribute('aria-label', `Ouvrir la section ${name}`);
  navButton.querySelector('.sr-only').textContent = name;
  for (const node of document.querySelectorAll('[data-central-bank-name]')) node.textContent = name;

  const presenter = new CentralBankSectionPresenter(deps);
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
