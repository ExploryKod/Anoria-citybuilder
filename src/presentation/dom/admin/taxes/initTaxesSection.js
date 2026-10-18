import { TaxesSectionPresenter } from './TaxesSectionPresenter.js';
import { showActiveHamletNameIn } from '../hamletLabel.js';

/** @param {{ accounting: object }} deps */
export function initTaxesSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-taxes');
  if (!section) return;

  const presenter = new TaxesSectionPresenter(deps);
  let initialized = false;
  const open = async () => {
    if (!initialized) {
      initialized = true;
      presenter.bind();
    }
    await showActiveHamletNameIn(section);
    await presenter.refresh();
  };

  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
