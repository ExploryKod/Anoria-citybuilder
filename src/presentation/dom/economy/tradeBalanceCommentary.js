import { TRADE_BALANCE_COMMENTARY } from '../../../shared/trade-catalog/TradeCatalog.js';
import { resolveHelp } from '../shell/HelpButton.js';

/**
 * The commentary under the trade balance: which paragraphs of the catalog (HelpCatalog.js, `trade.*`) the state of the balance calls for, with the figures of the moment.
 * Pure: the screen gives the figures and the names (a good, a city: the catalog's words), this decides what is said and in which state. Nothing here is a sentence.
 */

/**
 * @param {object} summary a period of the balance (TradeBalancePolicy.summarise)
 * @returns {'none' | 'deficit' | 'balanced' | 'surplus' | 'surplus-only'}
 */
export function balanceStateOf(summary) {
  if (summary.exports === 0 && summary.imports === 0) return 'none';
  // Nothing bought: a surplus with no rate of coverage.
  if (summary.imports === 0) return 'surplus-only';
  const { balancedBand } = TRADE_BALANCE_COMMENTARY;
  const share = summary.currentBalance / summary.imports;
  if (share > balancedBand) return 'surplus';
  if (share < -balancedBand) return 'deficit';
  return 'balanced';
}

/** @param {number} share @returns {'warning' | 'strong' | null} how much a share is worth a word */
function dependenceLevelOf(share) {
  const { warning, strong } = TRADE_BALANCE_COMMENTARY.dependence;
  if (share >= strong) return 'strong';
  if (share >= warning) return 'warning';
  return null;
}

/**
 * @param {object} params
 * @param {object} params.shown the period shown (a month, or the year)
 * @param {object} params.year the whole year (the dependence is told over it: a month says too little)
 * @param {object | null} params.previous the period before the shown one, or null when there is none
 * @param {number | null} params.interest what the city paid abroad in interest over twelve months (null: not known yet)
 * @param {{ period: string, previous: string }} params.words "ce mois" / "cette année", and the period before
 * @param {(good: string) => string} params.goodName the catalog's word for a good
 * @param {(cityId: string) => string} params.cityName the world's name of a city
 * @returns {Array<{ id: string, reading: { state?: string, figures?: Record<string, number | string> } }>} the paragraphs, in the order they are read
 */
export function commentaryOf({ shown, year, previous, interest, words, goodName, cityName }) {
  const state = balanceStateOf(shown);
  const paragraphs = [];
  const balance = Math.abs(shown.currentBalance);
  paragraphs.push({
    id: 'trade.balance',
    reading: { state, figures: state === 'none' ? { period: words.period } : { period: words.period, balance, ...(shown.coverage === null ? {} : { coverage: shown.coverage }) } },
  });

  if (previous && balanceStateOf(previous) !== 'none' && state !== 'none') {
    const change = shown.currentBalance - previous.currentBalance;
    const scale = (shown.exports + shown.imports) || 1;
    const trend = Math.abs(change) < 0.01 * scale ? 'same' : change > 0 ? 'better' : 'worse';
    paragraphs.push({ id: 'trade.balance.trend', reading: { state: trend, figures: { previous: words.previous, change: Math.abs(change) } } });
  }

  if (state === 'deficit' || state === 'surplus' || state === 'surplus-only') {
    const sign = state === 'deficit' ? -1 : 1;
    // The good (and the city) that weigh most on the side the balance leans: the most negative balance for a deficit, the most positive for a surplus.
    const heaviest = (rows) => rows.filter((row) => row.balance * sign > 0).sort((a, b) => b.balance * sign - a.balance * sign)[0] ?? null;
    const good = heaviest(shown.goods);
    const city = shown.partnersKnown ? heaviest(shown.partners) : null;
    const side = state === 'deficit' ? 'deficit' : 'surplus';
    if (good && city) paragraphs.push({ id: 'trade.balance.causes', reading: { state: side, figures: { good: goodName(good.good), city: cityName(city.cityId) } } });
    else if (good) paragraphs.push({ id: 'trade.balance.causes', reading: { state: `${side}-goods`, figures: { good: goodName(good.good) } } });
  }

  if (state === 'deficit') {
    if (interest !== null) paragraphs.push({ id: 'trade.balance.interest', reading: { state: interest > 0 ? 'some' : 'none', ...(interest > 0 ? { figures: { interest } } : {}) } });
    paragraphs.push({ id: 'trade.balance.levers', reading: {} });
  }

  // The structure of the whole year (read by the policy: TradeBalancePolicy.js): one partner or one good that holds too much of a side.
  const { exportPartner, importPartner, exportGood } = year.dependence;
  for (const [id, found] of [['trade.dependence.exportPartner', exportPartner], ['trade.dependence.importPartner', importPartner]]) {
    const level = found && dependenceLevelOf(found.share);
    if (level) paragraphs.push({ id, reading: { state: level, figures: { share: found.share, name: cityName(found.id) } } });
  }
  const goodLevel = exportGood && dependenceLevelOf(exportGood.share);
  if (goodLevel) paragraphs.push({ id: 'trade.dependence.exportGood', reading: { state: goodLevel, figures: { share: exportGood.share, name: goodName(exportGood.id) } } });

  return paragraphs;
}

/**
 * The text of the commentary, in the layout the modals use (richText.js): a paragraph per entry, its items as lines of a list.
 * @param {ReturnType<typeof commentaryOf>} paragraphs
 * @returns {string}
 */
export function commentaryText(paragraphs) {
  return paragraphs
    .map(({ id, reading }) => {
      const { message, items } = resolveHelp(id, reading);
      return [message, ...items.map((item) => `- **${item.label}** : ${item.text}`)].join('\n');
    })
    .join('\n\n');
}
