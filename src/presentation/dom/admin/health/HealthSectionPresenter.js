import { HEALTH_LABELS, sickExplanation } from '../../../../shared/population/HealthFactorCatalog.js';
import { SICKNESS_COVERS, SICKNESS_COVER_LABELS, sicknessCoverExplanation } from '../../../../shared/accounting-catalog/SicknessCoverCatalog.js';
import { HEALTH_FUND_ACCOUNT, SOCIAL_FUND_LABELS, UNEMPLOYMENT_FUND_ACCOUNT } from '../../../../shared/accounting-catalog/SocialFundsCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
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
        this.housing = deps.housing;
        this.accounting = deps.accounting;
        this.cityHealth = null;
        /** What the city holds for each social fund (euros, negative = deficit), by account; null while it loads: the panel then shows "…". */
        this.socialFunds = null;
        /** The cover in force (SICKNESS_COVERS); null while it loads: the control then shows "…". */
        this.sicknessCover = null;
    }

    init() {
        this.render();
        this.load();
    }

    async load() {
        const { monthIndex } = TimeManager.getTimeInfo(getSessionGameTime());
        const [health, cover, statements] = await Promise.all([
            this.housing.getCityHealth({ periodKey: monthIndex }),
            this.accounting.getSicknessCover(),
            this.accounting.getCityStatements(),
        ]);
        this.cityHealth = health;
        this.sicknessCover = cover;
        // A fund nothing was ever booked on has no line in the city's balance: it holds nothing.
        const heldBy = (account) => {
            const row = statements.trialBalance.accounts.find((candidate) => candidate.account === account);
            return row ? row.creditBalance - row.debitBalance : 0;
        };
        this.socialFunds = { [HEALTH_FUND_ACCOUNT]: heldBy(HEALTH_FUND_ACCOUNT), [UNEMPLOYMENT_FUND_ACCOUNT]: heldBy(UNEMPLOYMENT_FUND_ACCOUNT) };
        this.render();
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
                        <span class="health-item-label">Habitants</span>
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
            section.append(renderHealthHistogram(health.environment, 0));
            healthSections.append(section);
        }
        healthSections.append(this.#sicknessCoverControl(), this.#socialFundsSection());
    }
}
