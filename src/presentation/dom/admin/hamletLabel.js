import { listHamlets, requireActiveHamletId } from '../../../core/persistence/hamlet/hamletSession.js';

/**
 * Names the active hamlet in every label of a section (`[data-hamlet-label]`): what a section's figures are the
 * hamlet's own, so the player always sees which hamlet they are setting.
 * @param {HTMLElement | null} section
 */
export async function showActiveHamletNameIn(section) {
  if (!section) return;
  const activeId = requireActiveHamletId();
  const active = (await listHamlets()).find((hamlet) => hamlet.id === activeId);
  if (!active) throw new Error(`[admin] active hamlet ${activeId} is not in the catalogue`);
  for (const label of section.querySelectorAll('[data-hamlet-label]')) {
    label.textContent = active.name;
  }
}
