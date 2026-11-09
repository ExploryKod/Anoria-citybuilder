import { TRADE_IMPORT, getTradeCatalogEntry, transportPerUnit } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { getTransportWeight } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { worldUnitPrice } from './WorldPricePolicy.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * What one delivery of an import costs the merchants and what they sell it for, step by step (see TRADE_IMPORT):
 * the city's price, the transport (outside Anoria), the customs duty on those two (to the city's treasury), then the
 * merchants' margin on the whole cost (earned inside Anoria, so outside the duty's base). Amounts are rounded to the
 * centime; the sale is the sum of the rounded parts, so the lines of a delivery always add up to what the warehouse pays.
 *
 * @param {{ cityId: string, offer: { good: string, baseMultiplier: number }, quantity: number, dutyRate: number, worldIndex: number, referencePrice: number }} delivery `worldIndex`: the world price index of the good that month (WorldMarket.js); `referencePrice`: the world's reference price of the good (createWorldReferencePrices.js)
 * @returns {{
 *   quantity: number,
 *   foreign: number, transport: number, customsValue: number, duty: number, cost: number, margin: number, sale: number,
 *   unit: { foreign: number, transport: number, duty: number, margin: number, sale: number },
 * }}
 */
export function priceImportDelivery({ cityId, offer, quantity, dutyRate, worldIndex, referencePrice }) {
  if (!(worldIndex > 0)) throw new Error(`[trade] the world price index of ${offer.good} must be above 0, got ${worldIndex}`);
  if (!(quantity > 0)) throw new Error(`[trade] a delivery of ${offer.good} from ${cityId} has no quantity (${quantity})`);
  if (!Number.isFinite(dutyRate) || dutyRate < 0) throw new Error(`[trade] the import duty of ${offer.good} must be a rate >= 0, got ${dutyRate}`);
  // The city's price is the world's price of the good in that city (its level and its premium), at the world's price index of the month.
  const entry = getTradeCatalogEntry(cityId);
  if (!entry) throw new Error(`[trade] "${cityId}" is not in the trade catalog`);
  const foreignUnit = worldUnitPrice({ referencePrice, entry, multiplier: offer.baseMultiplier }) * worldIndex;
  const transportUnit = transportPerUnit({ cityId, quantity, weight: getTransportWeight(offer.good) });
  const foreign = centimes(quantity * foreignUnit);
  const transport = centimes(quantity * transportUnit);
  const customsValue = centimes(foreign + transport);
  const duty = centimes(customsValue * dutyRate);
  const cost = centimes(customsValue + duty);
  const margin = centimes(cost * TRADE_IMPORT.merchantMargin);
  const sale = centimes(cost + margin);
  return {
    quantity,
    foreign, transport, customsValue, duty, cost, margin, sale,
    unit: { foreign: foreignUnit, transport: transportUnit, duty: duty / quantity, margin: margin / quantity, sale: sale / quantity },
  };
}

/**
 * Whether the merchants make a deal for a good the city already makes: only when buying it abroad is cheaper than what the market charges at home (the landed price with the
 * merchants' margin, against the shelf price, which already carries the scarcity). A glut at home, or a dear world, and the deal is not worth making.
 * @param {{ landedUnitSale: number, localUnitPrice: number }} params euros per unit: `landedUnitSale` from `priceImportDelivery` (`unit.sale`); `localUnitPrice` the market's price now
 * @returns {boolean}
 */
export function importPaysAtHome({ landedUnitSale, localUnitPrice }) {
  for (const [name, value] of Object.entries({ landedUnitSale, localUnitPrice })) {
    if (!Number.isFinite(value) || !(value > 0)) throw new Error(`[trade] ${name} must be a price above 0, got ${value}`);
  }
  return landedUnitSale < localUnitPrice;
}
