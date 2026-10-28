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

/**
 * A euro amount short enough for a small button: "€950", "€9,5K", "€10K", "€-10K", "€1,2M". The exact figure is `formatEuro`'s job.
 * @param {number} amount
 */
export function formatEuroCompact(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new Error(`formatEuroCompact: expected a number, got ${amount}`);
  }
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const shorten = (value, suffix) => {
    const digits = value < 10 ? 1 : 0;
    return `€${sign}${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })}${suffix}`;
  };
  if (abs >= 1_000_000) return shorten(abs / 1_000_000, 'M');
  if (abs >= 1_000) return shorten(abs / 1_000, 'K');
  return `€${sign}${Math.round(abs)}`;
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
