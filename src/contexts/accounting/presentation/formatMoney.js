/** @param {number} amount */
export function formatEuro(amount) {
  return `${(amount ?? 0).toLocaleString('fr-FR')}€`;
}

/** @param {number|string} amount */
export function formatEuroOrNa(amount) {
  if (typeof amount === 'number') {
    return formatEuro(amount);
  }
  return 'N/A';
}
