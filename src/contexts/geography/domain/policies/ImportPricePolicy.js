import { TRADE_IMPORT, transportPerUnit } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { getResourceBaseValue, getTransportWeight } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * What one delivery of an import costs the merchants and what they sell it for, step by step (see TRADE_IMPORT):
 * the city's price, the transport (outside Anoria), the customs duty on those two (to the city's treasury), then the
 * merchants' margin on the whole cost (earned inside Anoria, so outside the duty's base). Amounts are rounded to the
 * centime; the sale is the sum of the rounded parts, so the lines of a delivery always add up to what the warehouse pays.
 *
 * @param {{ cityId: string, offer: { good: string, baseMultiplier: number }, quantity: number, dutyRate: number }} delivery
 * @returns {{
 *   quantity: number,
 *   foreign: number, transport: number, customsValue: number, duty: number, cost: number, margin: number, sale: number,
 *   unit: { foreign: number, transport: number, duty: number, margin: number, sale: number },
 * }}
 */
export function priceImportDelivery({ cityId, offer, quantity, dutyRate }) {
  if (!(quantity > 0)) throw new Error(`[trade] a delivery of ${offer.good} from ${cityId} has no quantity (${quantity})`);
  if (!Number.isFinite(dutyRate) || dutyRate < 0) throw new Error(`[trade] the import duty of ${offer.good} must be a rate >= 0, got ${dutyRate}`);
  const foreignUnit = getResourceBaseValue(offer.good) * offer.baseMultiplier;
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
