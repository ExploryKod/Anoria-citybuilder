/**
 * How a buyer spreads its purchase over the goods a seller holds: by what it SPENDS on each, not by how many units.
 * Each unit is bought from the good that has had the smallest spend so far (ties: the cheaper next unit, then the order of
 * the goods), so every good gets an equal share of the money. At equal spend the cheaper good comes in larger quantity:
 * what is sold off because it is about to go bad leaves the seller first (see FreshnessPricePolicy.js).
 * The share is equal for now; a basket per need (a % per good) will replace it.
 *
 * @param {object} params
 * @param {number[]} params.caps Units of each good the buyer may take (what the seller can give it)
 * @param {number} params.units Units the buyer wants in all
 * @param {(index: number, nth: number) => number} params.priceOf Price of the nth unit (from 0) of the good at `index`
 * @param {number} params.budget Money the buyer may spend in all (Infinity: no limit); a unit that would go over it is not bought
 * @returns {{ amounts: number[], spent: number[] }} Units and money per good
 */
export function shareByExpenditure({ caps, units, priceOf, budget }) {
  if (!(budget >= 0)) throw new Error(`[supply] a purchase needs a budget (a number of euros, 0 or more), got ${budget}`);
  let budgetLeft = budget;
  const amounts = caps.map(() => 0);
  const spent = caps.map(() => 0);
  const nextPrice = caps.map((cap, index) => (cap > 0 ? priceOf(index, 0) : Infinity));
  for (let left = Math.max(0, Math.floor(units)); left > 0; left -= 1) {
    let pick = -1;
    for (let index = 0; index < caps.length; index += 1) {
      if (amounts[index] >= caps[index] || nextPrice[index] > budgetLeft) continue;
      if (pick < 0 || spent[index] < spent[pick] || (spent[index] === spent[pick] && nextPrice[index] < nextPrice[pick])) pick = index;
    }
    if (pick < 0) break;
    spent[pick] += nextPrice[pick];
    budgetLeft -= nextPrice[pick];
    amounts[pick] += 1;
    nextPrice[pick] = amounts[pick] < caps[pick] ? priceOf(pick, amounts[pick]) : Infinity;
  }
  return { amounts, spent };
}
