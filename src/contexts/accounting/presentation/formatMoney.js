/**
 * A euro amount, to the centime, as a receipt shows it: rounded to the nearest centime, a half centime going up (the
 * commercial rounding), with two decimals always.
 */
const euroFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  roundingMode: 'halfExpand',
});

/** The number alone, without the € sign — for a display that already shows its own currency icon. @param {number} amount */
export function formatEuroAmount(amount) {
  return euroFormat.format(amount ?? 0);
}

/** @param {number} amount */
export function formatEuro(amount) {
  return `${formatEuroAmount(amount)}€`;
}

/** @param {number|string} amount */
export function formatEuroOrNa(amount) {
  if (typeof amount === 'number') {
    return formatEuro(amount);
  }
  return 'N/A';
}
