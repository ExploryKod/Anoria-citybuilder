import { buildingCatalog } from '../../../../../shared/building-catalog/buildingCatalog.js';
import { getShelfLifeMonths, listShelfLifeGoods } from '../../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../../shared/time/TimeCalendar.js';
import { buildingName, goodAmount, goodIcon, goodLabel } from '../../../shell/CatalogVocabulary.js';

/**
 * Shelf-life tab — pure format. It tells what a building's stock has left to live, good by good (bars), and, as a reference, how long each good keeps by
 * itself and in the places built to keep it longer. Every name and unit comes from the catalogs.
 */

/** @param {number} months @returns {string} e.g. "2,5 mois" */
function formatMonths(months) {
  return `${String(Math.round(months * 10) / 10).replace('.', ',')} mois`;
}

/** The span a delivery cycle covers, as the player reads it: "sur l'année écoulée", "sur les 6 derniers mois", "sur le mois écoulé". */
function cycleSpanText(months) {
  if (months === MONTHS_PER_YEAR) return "sur l'année écoulée";
  if (months === 1) return 'sur le mois écoulé';
  return `sur les ${months} derniers mois`;
}

/** Share of its life a batch has already used (0 = fresh, 1 = lost), whatever the rounding of the turns. */
function usedFractionOf(remainingTurns, lifeTurns) {
  return 1 - Math.max(0, Math.min(1, remainingTurns / lifeTurns));
}

/**
 * The bars of the goods a building holds right now: the oldest batch of each good, how much of its life it has used and what it has left of the
 * whole. A good with no stock has none.
 * @param {Awaited<ReturnType<import('../../../../../contexts/supply/application/queries/DescribeShelfLife.js').DescribeShelfLife['execute']>>} board
 * @returns {Array<{ icon: string, label: string, amountText: string, usedFraction: number, remainingText: string, spoilage: { fraction: number, text: string, cycleText: string } }>}
 */
export function shelfLifeBarsModel(board) {
  return board.goods
    .filter((good) => good.amount > 0 && good.lots.length > 0)
    .map((good) => {
      const oldest = good.lots[0];
      return {
        icon: goodIcon(good.category),
        label: goodLabel(good.category),
        amountText: goodAmount(good.category, good.amount),
        usedFraction: usedFractionOf(oldest.remainingTurns, good.lifeTurns),
        remainingText: `reste ${formatMonths(oldest.remainingTurns / board.daysPerMonth)} sur ${formatMonths(good.lifeTurns / board.daysPerMonth)}`,
        spoilage: {
          fraction: good.cycle.handled > 0 ? good.cycle.spoiled / good.cycle.handled : 0,
          text:
            good.cycle.handled > 0
              ? `${goodAmount(good.category, good.cycle.spoiled)} périmé sur ${goodAmount(good.category, good.cycle.handled)}`
              : 'Rien écoulé sur ce cycle',
          cycleText: cycleSpanText(good.cycleMonths),
        },
      };
    });
}

/**
 * The places built to keep goods longer, from their hub role's `shelfLifeFactor`.
 * @returns {Array<{ name: string, factor: number, categories: readonly string[] }>}
 */
function keepingPlaces() {
  const places = [];
  for (const [type, definition] of Object.entries(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.role === 'hub' && entry.shelfLifeFactor > 0) places.push({ name: buildingName(type), factor: entry.shelfLifeFactor, categories: entry.categories });
    }
  }
  return places;
}

/**
 * How long each good keeps, by itself and in the places built to keep it longer; and the goods that never go bad.
 * @returns {{ perishable: Array<{ icon: string, label: string, baseText: string, places: string[] }>, lasting: string[] }}
 */
export function shelfLifeReferenceModel() {
  const places = keepingPlaces();
  const perishable = [];
  const lasting = [];
  for (const category of listShelfLifeGoods()) {
    const baseMonths = getShelfLifeMonths(category);
    if (baseMonths === Infinity) {
      lasting.push(goodLabel(category));
      continue;
    }
    perishable.push({
      icon: goodIcon(category),
      label: goodLabel(category),
      baseText: formatMonths(baseMonths),
      places: places.filter((place) => place.categories.includes(category)).map((place) => `${place.name} : ${formatMonths(baseMonths * place.factor)}`),
    });
  }
  return { perishable, lasting };
}
