import { HEALTH_LABELS, sickExplanation } from '../../../../shared/population/HealthFactorCatalog.js';
import { SICKNESS_COVERS, SICKNESS_COVER_LABELS, sicknessCoverExplanation } from '../../../../shared/accounting-catalog/SicknessCoverCatalog.js';
import { HEALTH_FUND_ACCOUNT, SOCIAL_FUND_LABELS, UNEMPLOYMENT_FUND_ACCOUNT } from '../../../../shared/accounting-catalog/SocialFundsCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { INSURANCE_LAW_LABELS } from '../../../../shared/accounting-catalog/InsuranceCatalog.js';
import { showErrorToast } from '../../shell/ToastNotifier.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';
import { getSessionGameTime } from '../../../../composition/sessionRuntime.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { renderHealthHistogram } from '../../info/views/healthHistogramView.js';

/**
 * The city's health, read from its citizens (`housing.getCityHealth`): the average over the inhabitants, how many they are and how
 * many are sick. Nothing here is invented: while the figures load the panel shows "…", and a city nobody lives in shows no average.
 * Its words come from `HEALTH_LABELS`.
 */
export class HealthSectionPresenter {
    /**
     * @param {{
     *   housing?: { getCityHealth: (params: { periodKey: number }) => Promise<{ average: number | null, citizens: number, sick: number, environment: object | null }> },
     *   accounting?: { getSicknessCover: () => Promise<string>, setSicknessCover: (cover: string) => Promise<string>, getCityStatements: () => Promise<{ trialBalance: { accounts: Array<{ account: string, debitBalance: number, creditBalance: number }> } }> },
     * }} deps
     */
    constructor(deps = {}) {
        if (!deps.housing?.getCityHealth) throw new Error('[health] the health panel needs housing.getCityHealth');
        if (!deps.accounting?.getSicknessCover || !deps.accounting?.setSicknessCover) throw new Error('[health] the health panel needs accounting.getSicknessCover and setSicknessCover');
        if (!deps.accounting?.getCityStatements) throw new Error('[health] the health panel needs accounting.getCityStatements to read the social funds');
        if (!deps.accounting?.getInsuranceLaw || !deps.accounting?.setInsuranceMandatory) throw new Error('[health] the health panel needs accounting.getInsuranceLaw and setInsuranceMandatory');
        this.housing = deps.housing;
        this.accounting = deps.accounting;
        this.cityHealth = null;
        /** What the city holds for each social fund (euros, negative = deficit), by account; null while it loads: the panel then shows "…". */
        this.socialFunds = null;
        /** The cover in force (SICKNESS_COVERS); null while it loads: the control then shows "…". */
        this.sicknessCover = null;
        /** The law of compulsory insurance (InsuranceLawPolicy.js), null while it loads: the control then shows "…". */
        this.insuranceLaw = null;
    }

    init() {
        this.render();
        this.load();
    }

    async load() {
        const { monthIndex } = TimeManager.getTimeInfo(getSessionGameTime());
        const [health, cover, statements, law] = await Promise.all([
            this.housing.getCityHealth({ periodKey: monthIndex }),
            this.accounting.getSicknessCover(),
            this.accounting.getCityStatements(),
            this.accounting.getInsuranceLaw(),
        ]);
        this.cityHealth = health;
        this.sicknessCover = cover;
        this.insuranceLaw = law;
        // A fund nothing was ever booked on has no line in the city's balance: it holds nothing.
        const heldBy = (account) => {
            const row = statements.trialBalance.accounts.find((candidate) => candidate.account === account);
            return row ? row.creditBalance - row.debitBalance : 0;
        };
        this.socialFunds = { [HEALTH_FUND_ACCOUNT]: heldBy(HEALTH_FUND_ACCOUNT), [UNEMPLOYMENT_FUND_ACCOUNT]: heldBy(UNEMPLOYMENT_FUND_ACCOUNT) };
        this.render();
    }

    /**
     * The law of compulsory insurance. It can be passed only while the insurance works: otherwise the choice is greyed and says why; a law already passed that the insurance
     * can no longer carry is shown as suspended, never silently off.
     */
    #insuranceLawControl() {
        const section = document.createElement('div');
        section.className = 'health-section';
        const title = document.createElement('div');
        title.className = 'health-section-title';
        title.textContent = INSURANCE_LAW_LABELS.title;
        section.append(title);
        const law = this.insuranceLaw;
        if (law === null) {
            const loading = document.createElement('div');
            loading.className = 'health-item';
            loading.textContent = '…';
            section.append(loading);
            return section;
        }
        const select = document.createElement('select');
        select.setAttribute('aria-label', INSURANCE_LAW_LABELS.title);
        for (const [value, label] of [['off', INSURANCE_LAW_LABELS.off], ['on', INSURANCE_LAW_LABELS.on]]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.selected = (value === 'on') === law.mandatory;
            select.append(option);
        }
        // Passing it is refused while the insurance does not work; repealing it never is.
        select.querySelector('option[value="on"]').disabled = !law.available && !law.mandatory;
        select.addEventListener('change', async () => {
            // A refused vote (the insurance stopped working meanwhile) is said, and the control reads the real state again instead of keeping the choice that was not made.
            try {
                await this.accounting.setInsuranceMandatory(select.value === 'on');
            } catch (error) {
                showErrorToast(error.message);
            }
            await this.load();
        });
        const note = document.createElement('small');
        note.className = 'health-note';
        note.textContent = law.inForce
            ? INSURANCE_LAW_LABELS.inForce
            : [law.mandatory ? INSURANCE_LAW_LABELS.suspended : null, ...law.reasons.map((reason) => INSURANCE_LAW_LABELS.reasons[reason])].filter(Boolean).join(' ');
        section.append(select, note);
        return section;
    }

    /** What the city holds for each branch of its social security, and a deficit shown as such. */
    #socialFundsSection() {
        const section = document.createElement('div');
        section.className = 'health-section';
        const title = document.createElement('div');
        title.className = 'health-section-title';
        title.textContent = SOCIAL_FUND_LABELS.title;
        const items = document.createElement('div');
        items.className = 'health-items';
        for (const [account, label] of [[HEALTH_FUND_ACCOUNT, SOCIAL_FUND_LABELS.health], [UNEMPLOYMENT_FUND_ACCOUNT, SOCIAL_FUND_LABELS.unemployment]]) {
            const held = this.socialFunds === null ? null : this.socialFunds[account];
            const item = document.createElement('div');
            item.className = `health-item${held !== null && held < 0 ? ' high-risk' : ''}`;
            const name = document.createElement('span');
            name.className = 'health-item-label';
            name.textContent = label;
            const value = document.createElement('span');
            value.className = 'health-item-value number';
            value.textContent = held === null ? '…' : held < 0 ? `${SOCIAL_FUND_LABELS.deficit} ${formatEuro(-held)}` : formatEuro(held);
            item.append(name, value);
            items.append(item);
        }
        const note = document.createElement('small');
        note.className = 'health-note';
        note.textContent = SOCIAL_FUND_LABELS.note;
        section.append(title, items, note);
        return section;
    }

    /** The law of the sick leave: who pays a worker who is sick. A choice of the player, none by default. */
    #sicknessCoverControl() {
        const section = document.createElement('div');
        section.className = 'health-section';
        const title = document.createElement('div');
        title.className = 'health-section-title';
        title.textContent = SICKNESS_COVER_LABELS.title;
        section.append(title);
        if (this.sicknessCover === null) {
            const loading = document.createElement('div');
            loading.className = 'health-item';
            loading.textContent = '…';
            section.append(loading);
            return section;
        }
        const select = document.createElement('select');
        select.setAttribute('aria-label', SICKNESS_COVER_LABELS.title);
        for (const cover of SICKNESS_COVERS) {
            const option = document.createElement('option');
            option.value = cover;
            option.textContent = SICKNESS_COVER_LABELS[cover];
            option.selected = cover === this.sicknessCover;
            select.append(option);
        }
        select.addEventListener('change', async () => {
            this.sicknessCover = await this.accounting.setSicknessCover(select.value);
            this.render();
        });
        const note = document.createElement('small');
        note.className = 'health-note';
        note.textContent = sicknessCoverExplanation(this.sicknessCover);
        section.append(select, note);
        return section;
    }

    render() {
        const healthSections = document.getElementById('health-sections');
        if (!healthSections) return;

        const health = this.cityHealth;
        const average = health === null ? '…' : health.average === null ? '—' : `${Math.round(health.average)} / ${HEALTH_MAX}`;
        const mentalAverage = health === null ? '…' : health.mentalAverage === null ? '—' : `${Math.round(health.mentalAverage)} / ${HEALTH_MAX}`;
        const citizens = health === null ? '…' : String(health.citizens);
        const sick = health === null ? '…' : `${health.sick}${health.citizens > 0 ? ` (${Math.round((health.sick / health.citizens) * 100)} %)` : ''}`;
        const sickClass = health !== null && health.sick > 0 ? 'high-risk' : '';

        healthSections.innerHTML = `
            <div class="health-section">
                <div class="health-section-title">${HEALTH_LABELS.score}</div>
                <div class="health-items">
                    <div class="health-item">
                        <span class="health-item-label">${HEALTH_LABELS.score} moyenne</span>
                        <span class="health-item-value number">${average}</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">${HEALTH_LABELS.mentalAverage}</span>
                        <span class="health-item-value number">${mentalAverage}</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">${HEALTH_LABELS.citizens}</span>
                        <span class="health-item-value number">${citizens}</span>
                    </div>
                    <div class="health-item ${sickClass}">
                        <span class="health-item-label">
                            ${HEALTH_LABELS.sickCount}
                            <small class="health-note">${sickExplanation()}</small>
                        </span>
                        <span class="health-item-value number ${sickClass}">${sick}</span>
                    </div>
                </div>
            </div>
        `;
        if (health?.environment) {
            const section = document.createElement('div');
            section.className = 'health-section';
            section.append(renderHealthHistogram(health.environment, 0, HEALTH_LABELS.environment));
            if (health.mentalEnvironment) section.append(renderHealthHistogram(health.mentalEnvironment, 0, HEALTH_LABELS.mentalEnvironment));
            healthSections.append(section);
        }
        healthSections.append(this.#sicknessCoverControl(), this.#insuranceLawControl(), this.#socialFundsSection());
    }
}
