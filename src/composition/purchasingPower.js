import { developmentIndexOf, isServedNow } from '../shared/population/DevelopmentIndexPolicy.js';

/**
 * The purchasing power of the houses, by kind of house (a social category is named by its house): what a house earns in a month, what it must pay whatever it does (taxes,
 * contributions, services, rent), what is left to live on, and what its basic needs cost at the markets' prices. The two readings come from two contexts (the journal's, the markets'),
 * joined here by house. Nothing is stored; a house with no basket throws, a need no market prices is told apart, never given a price.
 *
 * @param {object} params
 * @param {Array<{ id: string, type: string, savings: number, income: number, mandatory: number, goodsBought: number }>} params.households the accounting's monthly averages per house
 * @param {Array<{ houseId: string, pop: number, cost: number, needs: Array<{ totalKey: string, unitPrice: number | null }> }>} params.baskets the supply's monthly basket per house
 * @returns {Array<{ type: string, houses: number, residents: number, perHouse: { savings: number, income: number, mandatory: number, livingMargin: number, goodsBought: number, basket: number }, coverage: number | null, housesShort: number, unpriced: string[] }>}
 *   `coverage`: the living margin over the basket (1 = it just covers the basic needs), null when the basket is nothing; `unpriced`: the needs no market sells, left out of the basket
 */
/**
 * What the economy of the hamlet is worth once prices are compared with the reference chain's: the domestic product in purchasing power parity (the product, scaled by what the
 * same basket costs at the reference prices over what it costs at the hamlet's), the same per inhabitant, and the debts against the product. The accounting's figures are joined
 * with the markets' baskets here: neither context knows the other's.
 *
 * @param {{ ready: boolean, population?: number, gdp?: number, gni?: number, publicDebt?: { gross: number, net: number, loans: number, domesticLoans: number }, householdSavings?: number }} economy the accounting's reading
 * @param {Array<{ cost: number, needs: Array<{ unitPrice: number | null, cost: number, referenceCost: number }> }>} baskets the supply's baskets
 * @returns {object} the economy with `parity` (null when no market prices a need yet), `gdpPpp`, per-inhabitant figures and the ratios (null when the product is not above 0)
 */
export function economyOf({ economy, baskets }) {
  if (!economy.ready) return economy;
  let actual = 0;
  let reference = 0;
  for (const basket of baskets) {
    for (const need of basket.needs) {
      if (need.unitPrice === null) continue;
      actual += need.cost;
      reference += need.referenceCost;
    }
  }
  const parity = actual > 0 ? Math.round((reference / actual) * 1000) / 1000 : null;
  const perInhabitant = (amount) => (economy.population > 0 ? Math.round((amount * 100) / economy.population) / 100 : null);
  const share = (amount) => (economy.gdp > 0 ? Math.round((amount / economy.gdp) * 1000) / 10 : null);
  const debt = economy.publicDebt;
  return {
    ...economy,
    parity,
    gdpPpp: parity === null ? null : Math.round(economy.gdp * parity * 100) / 100,
    perInhabitant: { gdp: perInhabitant(economy.gdp), gdpPpp: parity === null ? null : perInhabitant(economy.gdp * parity), gni: perInhabitant(economy.gni) },
    ratios: {
      grossDebtOfGdp: share(debt.gross),
      netDebtOfGdp: share(debt.net),
      privateDebtOfGdp: share(economy.privateDebt.total),
      domesticShareOfLoans: debt.loans > 0 ? Math.round((debt.domesticLoans / debt.loans) * 1000) / 10 : null,
      savingsCoverOfPublicDebt: debt.gross > 0 ? Math.round((economy.householdSavings / debt.gross) * 1000) / 10 : null,
    },
  };
}

/**
 * The human development index of the hamlet, from what the houses say (see DevelopmentCatalog.js): the share of inhabitants fed, the share each group of services reaches, and the
 * income per inhabitant in purchasing power parity. Nothing is guessed: an index that cannot be read yet is null.
 * @param {{ ready: boolean, gdpPpp?: number | null, population?: number }} economy the economy joined with the markets (`economyOf`)
 * @param {{ population: number, famished: number, unemploymentPercentage: number, houses: Array<{ pop: number, servedFlags: Record<string, number> }> }} reading
 * @param {number} periodKey the month index now
 * @returns {object} the index with its parts, and the figures it is read from
 */
export function developmentOf({ economy, reading, periodKey }) {
  const population = reading.population;
  const coverageOf = (group) =>
    population > 0
      ? Math.round((reading.houses.filter((house) => group.some((service) => isServedNow(house.servedFlags[service], periodKey))).reduce((sum, house) => sum + house.pop, 0) / population) * 1000) / 1000
      : null;
  const fedShare = population > 0 ? Math.round((1 - reading.famished / population) * 1000) / 1000 : null;
  const incomePerInhabitant = economy.ready && economy.gdpPpp !== null && economy.gdpPpp !== undefined && population > 0 ? economy.gdpPpp / population : null;
  const index = developmentIndexOf({ fedShare, coverageOf, incomePerInhabitant });
  return { population, fedShare, unemploymentPercentage: reading.unemploymentPercentage, incomePerInhabitant, ...index };
}

export function purchasingPowerOf({ households, baskets }) {
  const basketOf = new Map(baskets.map((basket) => [basket.houseId, basket]));
  const kinds = new Map();
  for (const household of households) {
    const basket = basketOf.get(household.id);
    if (!basket) throw new Error(`[purchasing-power] house ${household.id} (${household.type}) has no basket: its needs are not read from the supply`);
    const kind = kinds.get(household.type) ?? { type: household.type, houses: 0, residents: 0, sums: { savings: 0, income: 0, mandatory: 0, goodsBought: 0, basket: 0 }, housesShort: 0, unpriced: new Set() };
    kind.houses += 1;
    kind.residents += basket.pop;
    kind.sums.savings += household.savings;
    kind.sums.income += household.income;
    kind.sums.mandatory += household.mandatory;
    kind.sums.goodsBought += household.goodsBought;
    kind.sums.basket += basket.cost;
    if (household.income - household.mandatory < basket.cost) kind.housesShort += 1;
    for (const need of basket.needs) if (need.unitPrice === null) kind.unpriced.add(need.totalKey);
    kinds.set(household.type, kind);
  }
  const mean = (sum, count) => Math.round((sum * 100) / count) / 100;
  return [...kinds.values()].map((kind) => {
    const perHouse = {
      savings: mean(kind.sums.savings, kind.houses),
      income: mean(kind.sums.income, kind.houses),
      mandatory: mean(kind.sums.mandatory, kind.houses),
      goodsBought: mean(kind.sums.goodsBought, kind.houses),
      basket: mean(kind.sums.basket, kind.houses),
    };
    const livingMargin = Math.round((perHouse.income - perHouse.mandatory) * 100) / 100;
    return {
      type: kind.type,
      houses: kind.houses,
      residents: kind.residents,
      perHouse: { ...perHouse, livingMargin },
      coverage: perHouse.basket > 0 ? Math.round((livingMargin / perHouse.basket) * 100) / 100 : null,
      housesShort: kind.housesShort,
      unpriced: [...kind.unpriced],
    };
  });
}
