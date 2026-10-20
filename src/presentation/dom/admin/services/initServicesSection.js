import { ServicesSectionPresenter } from './ServicesSectionPresenter.js';
import { showActiveHamletNameIn } from '../hamletLabel.js';

/** @param {{ accounting: object, construction: object }} deps */
export function initServicesSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-services');
  if (!section) return;

  const presenter = new ServicesSectionPresenter(deps);
  const open = async () => {
    await showActiveHamletNameIn(section);
    await presenter.refresh();
  };

  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
