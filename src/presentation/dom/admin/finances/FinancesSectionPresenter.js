import { listHamlets } from '../../../../core/persistence/hamlet/hamletSession.js';
import { renderCityLedger, renderCityLedgerMessage } from '../../compta/livret/CityLedgerPresenter.js';
import { getSessionGameTime } from '../../../../composition/sessionRuntime.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { buildingName } from '../../shell/CatalogVocabulary.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';


const ALL_HAMLETS_VALUE = 'all';

export class FinancesSectionPresenter {
  /**
   * @param {{ accounting: object }} deps
   */
  constructor(deps) {
    this.accounting = deps.accounting;
    this.financialData = null;
  }

  /** The hamlet chosen in the budget dropdown, or null for the whole city. */
  selectedHamletId() {
    const value = document.getElementById('finances-hamlet-filter').value;
    return value === ALL_HAMLETS_VALUE ? null : value;
  }

  async populateHamletFilter() {
    const select = document.getElementById('finances-hamlet-filter');
    const hamlets = await listHamlets();
    const previous = select.value;
    // Rebuilt only when the hamlets change: the board refreshes every turn, and a rebuilt list would close the menu.
    const expected = [ALL_HAMLETS_VALUE, ...hamlets.map((hamlet) => hamlet.id)];
    const current = [...select.options].map((option) => option.value);
    if (current.length !== expected.length || current.some((value, index) => value !== expected[index])) {
      select.replaceChildren(
        new Option('Tous les hameaux', ALL_HAMLETS_VALUE),
        ...hamlets.map((hamlet) => new Option(hamlet.name, hamlet.id))
      );
    }
    select.value = hamlets.some((hamlet) => hamlet.id === previous) ? previous : ALL_HAMLETS_VALUE;

    if (!this._hamletFilterBound) {
      select.addEventListener('change', () => this.loadFinancialData());
      this._hamletFilterBound = true;
    }
  }

  init() {
    this.loadFinancialData();
  }

  async loadFinancialData() {
    // Loads can overlap (a turn while the hamlet changes): only the latest one may render.
    const load = (this._latestLoad = (this._latestLoad ?? 0) + 1);
    this.showLoading();

    await this.populateHamletFilter();

    try {
      const financialData = await this.accounting.getCityLedgerYearComparison({
        hamletId: this.selectedHamletId(),
      });
      if (load !== this._latestLoad) return;
      this.financialData = financialData;
      this.render();
    } catch (error) {
      console.error('[FinancesSection] Error loading financial data:', error);
      this.showError(`Budget indisponible : ${error.message}`);
      throw error;
    }

    await this.loadProducerRanking();
  }

  /**
   * The last fully settled month's producer ranking: goods sold to houses (dated by delivery) and services sold to
   * houses (dated by their settlement, the 1st of this same month, for the month before). See the panel's own note
   * for why a service's sale lags a good's by one extra month under the same label.
   */
  async loadProducerRanking() {
    const period = this.#lastSettledMonth();
    const periodLabel = document.getElementById('producer-ranking-period');
    const body = document.getElementById('producer-ranking-body');
    if (!body) return;

    if (!period) {
      // The very first month of the game: no month has closed yet, so there is nothing to rank.
      if (periodLabel) periodLabel.textContent = '';
      body.replaceChildren(emptyRankingRow('Pas encore de mois révolu.'));
      return;
    }

    if (periodLabel) periodLabel.textContent = `${TimeManager.MONTHS[period.monthIndex]} ${period.year}`;
    body.replaceChildren(emptyRankingRow('…'));

    try {
      const rankings = await this.accounting.getProducerRevenues(period.year, period.monthIndex);
      if (rankings.length === 0) {
        body.replaceChildren(emptyRankingRow('Aucune vente aux maisons ce mois-là.'));
      } else {
        body.replaceChildren(...rankings.map((entry, index) => rankingRow(index + 1, entry)));
      }
    } catch (error) {
      console.error('[FinancesSection] Error loading the producer ranking:', error);
      body.replaceChildren(emptyRankingRow(`Classement indisponible : ${error.message}`));
    }
  }

  /**
   * The month before the current one — the current month's own lines are still open (see loadProducerRanking).
   * Null in the game's very first month (year 0, January): there is no earlier month to show.
   */
  #lastSettledMonth() {
    const now = TimeManager.getTimeInfo(getSessionGameTime());
    if (now.year === 0 && now.monthIndex === 0) return null;
    return now.monthIndex === 0
      ? { year: now.year - 1, monthIndex: TimeManager.MONTHS.length - 1 }
      : { year: now.year, monthIndex: now.monthIndex - 1 };
  }

  /** Until the journal is read, no figure is shown: each one reads "…", never a stale or a zero value. */
  showLoading() {
    for (const cell of document.querySelectorAll('#finances-board [data-field]')) {
      cell.textContent = '…';
    }
    renderCityLedgerMessage({ text: 'Chargement du budget…', type: 'info' });
  }

  /** Loud, visible error in the budget panel itself (the table is left untouched, never blanked to zeros). */
  showError(text) {
    renderCityLedgerMessage({ text, type: 'danger' });
  }


  getEmptyYearData(year) {
    return this.accounting.createEmptyCityLedgerYearLines(year);
  }

  render() {
    if (!this.financialData) {
      this.renderStaticData();
      return;
    }

    renderCityLedger(this.financialData);
  }

  renderStaticData() {
    const staticData = {
      thisYear: this.getEmptyYearData(0),
      lastYear: this.getEmptyYearData(0),
      twoYearsAgo: this.getEmptyYearData(0),
      debt: 0,
      message: {
        text: 'La situation financière est stable.',
        type: 'info',
      },
    };

    this.financialData = staticData;
    this.render();
  }
}

/** @param {number} rank @param {{ buildingType: string, revenueHT: number }} entry */
function rankingRow(rank, entry) {
  const row = document.createElement('tr');
  const rankCell = document.createElement('td');
  rankCell.className = 'producer-ranking-rank-col';
  rankCell.textContent = String(rank);
  const nameCell = document.createElement('td');
  nameCell.className = 'producer-ranking-name-col';
  nameCell.textContent = buildingName(entry.buildingType);
  const revenueCell = document.createElement('td');
  revenueCell.className = 'producer-ranking-revenue-col';
  revenueCell.textContent = formatEuro(entry.revenueHT);
  row.append(rankCell, nameCell, revenueCell);
  return row;
}

/** @param {string} text */
function emptyRankingRow(text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'producer-ranking-empty';
  cell.textContent = text;
  row.append(cell);
  return row;
}
