import { formatEuro } from '../../../contexts/accounting/presentation/formatMoney.js';
import { UNRESOLVED_TERM } from './CatalogVocabulary.js';

/**
 * What the administrators' stipend means for the mayor's house, as one paragraph: a warning when it is under the cost of living, "…" when the cost
 * of living is not known yet (a good nobody sells), a plain reminder of the charge otherwise. Shown in the admin panel's Wages section and on the
 * mayor's house itself.
 * @param {{ stipend: number, known: boolean, tooLow: boolean, floor: number | null }} status from the accounting's getAdministratorPayStatus
 * @returns {HTMLParagraphElement}
 */
export function administratorPayNotice(status) {
  const notice = document.createElement('p');
  notice.className = 'commerce-customs-hint';
  if (!status.known) {
    notice.textContent = `Traitement des administrateurs : ${UNRESOLVED_TERM} — le coût de la vie n'est pas encore connu, impossible de juger s'il suffit. C'est une charge directe pour les fonds publics.`;
  } else if (status.tooLow) {
    notice.setAttribute('role', 'alert');
    notice.textContent = `⚠ Traitement trop bas : ${formatEuro(status.stipend)} par mois pour un coût de la vie de ${formatEuro(status.floor)}. La maison du maire ne peut pas payer ses besoins : ses services sont coupés et ses compétences restent limitées, ce qui freine le développement de la ville.`;
  } else {
    notice.textContent = `Traitement des administrateurs : ${formatEuro(status.stipend)} par mois chacun, au-dessus du coût de la vie (${formatEuro(status.floor)}). C'est une charge directe pour les fonds publics.`;
  }
  return notice;
}
