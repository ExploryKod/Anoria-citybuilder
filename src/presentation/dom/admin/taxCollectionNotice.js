import { getSkillDisplay } from '../../../shared/population/skillCatalog.js';

/**
 * Greys the controls of a tax nobody collects and says why in the notice under it. Such a tax is in force at 0 %, exactly as if the player had
 * set it so, but the code imposes it: the controls cannot be moved. The collection's name comes from the skill catalog.
 * @param {{ collected: boolean, skill: string, notice: HTMLElement, controls: Iterable<HTMLInputElement> }} params
 */
export function applyTaxCollection({ collected, skill, notice, controls }) {
  notice.hidden = collected;
  notice.textContent = collected
    ? ''
    : `Taux ramené à 0 % : personne ne détient la compétence « ${getSkillDisplay(skill).label.toLowerCase()} ». Elle revient aux administrateurs, selon le palier de leur maison : tant qu'elle manque, l'impôt ne peut être réglé ni perçu.`;
  for (const control of controls) control.disabled = !collected;
}
