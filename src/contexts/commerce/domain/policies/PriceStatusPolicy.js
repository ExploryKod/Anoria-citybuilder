/**
 * @param {number} price
 * @param {number} marketPrice
 * @param {'selling' | 'buying'} type
 */
export function getPriceStatus(price, marketPrice, type) {
  const diff = Math.abs(price - marketPrice);
  const percentDiff = (diff / marketPrice) * 100;

  if (type === 'selling') {
    if (price < marketPrice * 0.7) return 'generous';
    if (price > marketPrice * 1.5) return 'unacceptable';
  } else if (type === 'buying') {
    if (price > marketPrice * 1.3) return 'generous';
    if (price < marketPrice * 0.5) return 'unacceptable';
  }

  return '';
}
