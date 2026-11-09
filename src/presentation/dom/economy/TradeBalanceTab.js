import { html } from '../shell/safeHtml.js';
import { renderRichText } from '../shell/richText.js';
import { goodLabel, unresolvedTerm } from '../shell/CatalogVocabulary.js';
import { getWorldCityById } from '../../../composition/worldCityCatalog.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { formatEuro } from '../../../contexts/accounting/presentation/formatMoney.js';
import { tableHtml } from './ecoTable.js';
import { commentaryOf, commentaryText } from './tradeBalanceCommentary.js';

/**
 * The "Commerce extérieur" tab of the economy panel: the city's trade balance, read from the journal (TradeBalancePolicy.js) when the player opens the tab, never on a timer.
 * A year and a month are chosen (the year's twelve months come in one reading, so another month is not another reading); a commentary says the state and what it brings in the game
 * (tradeBalanceCommentary.js, the catalog's words); the twelve months are drawn as bars above and below zero; the weight of each city and each good is told underneath.
 */

const signed = (amount) => `${amount > 0 ? '+' : ''}${formatEuro(amount)}`;
const percent = (ratio) => `${Math.round(ratio * 100).toLocaleString('fr-FR')} %`;
const cityName = (cityId) => getWorldCityById(cityId)?.name ?? unresolvedTerm('city name', cityId);
const yearLabel = (year) => `An ${year + 1}`;

/** The twelve months as bars: above the line a surplus, under it a deficit, the shown month marked. The bars are as tall as the biggest month is large. */
function chartHtml(months, shownMonth) {
  const largest = Math.max(...months.map((month) => Math.abs(month.currentBalance)), 1);
  return html`<section class="eco-card">
    <h5>Solde de chaque mois</h5>
    <div class="eco-trade-chart" role="img" aria-label="Solde du commerce extérieur, mois par mois">
      ${months.map((month) => {
        const height = Math.round((Math.abs(month.currentBalance) / largest) * 100);
        const bar = html`<span class="eco-trade-chart__bar" style="height:${height}%"></span>`;
        const surplus = month.currentBalance >= 0;
        return html`<div class="eco-trade-chart__month${month.monthIndex === shownMonth ? ' is-shown' : ''}" title="${TimeManager.MONTHS[month.monthIndex]} : ${signed(month.currentBalance)}">
          <span class="eco-trade-chart__half eco-trade-chart__half--up">${surplus ? bar : ''}</span>
          <span class="eco-trade-chart__half eco-trade-chart__half--down">${surplus ? '' : bar}</span>
          <span class="eco-trade-chart__label">${TimeManager.MONTHS[month.monthIndex].slice(0, 1).toUpperCase()}</span>
        </div>`;
      })}
    </div>
  </section>`;
}

/** @param {object} shown a month or a year of the balance */
function balanceTableHtml(shown, caption) {
  return tableHtml({
    caption,
    heads: ['Poste', 'Montant'],
    rows: [
      { cells: ['Exportations', formatEuro(shown.exports)], hint: 'ce que les négociants ont vendu à l’étranger' },
      { cells: ['Importations', formatEuro(shown.imports)], hint: 'ce qu’ils ont acheté à l’étranger' },
      { cells: ['Solde des biens', signed(shown.goodsBalance)], strong: true },
      { cells: ['Transport', formatEuro(-shown.freight)], hint: 'payé à l’étranger, sur les achats' },
      { cells: ['Solde courant', signed(shown.currentBalance)], strong: true, hint: 'les biens et leur transport' },
      { cells: ['Taux de couverture', shown.coverage === null ? '—' : percent(shown.coverage)], hint: 'exportations ÷ importations' },
      { cells: ['Recette des douanes', formatEuro(shown.customs)], muted: true, hint: 'à part : c’est une recette de la ville, pas un flux extérieur' },
    ],
  });
}

/** @param {Array<{ balance: number, exports: number, imports: number }>} rows @param {(row: object) => string} nameOf */
function weightRows(rows, nameOf) {
  return rows.slice(0, 6).map((row) => ({ cells: [nameOf(row), signed(row.balance)], hint: `ventes ${formatEuro(row.exports)} · achats ${formatEuro(row.imports)}` }));
}

/**
 * Draws the tab in its container and keeps it alive: a change of year reads the balance of that year (kept by the query), a change of month redraws from what was read.
 * @param {HTMLElement} container
 * @param {{ accounting: { getTradeBalance: (options?: { year?: number | null }) => Promise<object> }, interest: number | null }} params `interest`: what the city paid abroad in interest
 *   over twelve months (the economy's), or null while it is not known
 * @returns {Promise<void>}
 */
export async function renderTradeBalanceTab(container, { accounting, interest }) {
  container.replaceChildren(Object.assign(document.createElement('p'), { className: 'supply-balance-loading', textContent: '…' }));
  let result = await accounting.getTradeBalance();
  // `monthIndex`: the month shown, or 'all' for the whole year; the running month for the running year.
  let monthIndex = result.currentMonthIndex;
  let previousYear = null;

  const draw = () => {
    const shown = monthIndex === 'all' ? result.total : result.months[monthIndex];
    const previous = monthIndex === 'all' ? previousYear?.total ?? null : monthIndex > 0 ? result.months[monthIndex - 1] : null;
    const words = monthIndex === 'all'
      ? { period: 'cette année', previous: 'l’année précédente' }
      : { period: `en ${TimeManager.MONTHS[monthIndex].toLowerCase()}`, previous: 'le mois précédent' };
    const years = [...new Set([...result.years, result.currentYear])].sort((a, b) => a - b);
    const caption = monthIndex === 'all' ? `${yearLabel(result.year)}, toute l’année` : `${yearLabel(result.year)}, ${TimeManager.MONTHS[monthIndex].toLowerCase()}`;

    container.innerHTML = html`
      <div class="eco-trade-controls">
        <label>Année
          <select id="economy-trade-year">${years.map((year) => html`<option value="${year}" ${year === result.year ? 'selected' : ''}>${yearLabel(year)}</option>`)}</select>
        </label>
        <label>Période
          <select id="economy-trade-month">
            <option value="all" ${monthIndex === 'all' ? 'selected' : ''}>Toute l’année</option>
            ${TimeManager.MONTHS.map((name, index) => html`<option value="${index}" ${index === monthIndex ? 'selected' : ''}>${name}</option>`)}
          </select>
        </label>
      </div>
      <div class="eco-trade-commentary" id="economy-trade-commentary"></div>
      ${balanceTableHtml(shown, caption)}
      ${chartHtml(result.months, monthIndex === 'all' ? null : monthIndex)}
      ${tableHtml({ caption: 'Par ville', heads: ['Ville', 'Solde'], rows: weightRows(shown.partners, (row) => cityName(row.cityId)), note: shown.partnersKnown ? '' : 'Le détail par ville n’est pas conservé pour une année clôturée.' })}
      ${tableHtml({ caption: 'Par bien', heads: ['Bien', 'Solde'], rows: weightRows(shown.goods, (row) => goodLabel(row.good)) })}`;

    // The commentary is set apart as text nodes (richText.js): the words are the catalog's, the figures are numbers and names.
    const entries = commentaryOf({ shown, year: result.total, previous, interest, words, goodName: goodLabel, cityName });
    renderRichText(container.querySelector('#economy-trade-commentary'), commentaryText(entries));

    container.querySelector('#economy-trade-year').addEventListener('change', async (event) => {
      result = await accounting.getTradeBalance({ year: Number(event.target.value) });
      previousYear = result.years.includes(result.year - 1) ? await accounting.getTradeBalance({ year: result.year - 1 }) : null;
      monthIndex = result.year === result.currentYear ? result.currentMonthIndex : 'all';
      draw();
    });
    container.querySelector('#economy-trade-month').addEventListener('change', (event) => {
      monthIndex = event.target.value === 'all' ? 'all' : Number(event.target.value);
      draw();
    });
  };

  previousYear = result.years.includes(result.year - 1) ? await accounting.getTradeBalance({ year: result.year - 1 }) : null;
  draw();
}
