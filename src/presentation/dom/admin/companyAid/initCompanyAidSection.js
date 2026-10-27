import { CompanyAidSectionPresenter } from './CompanyAidSectionPresenter.js';
import { showActiveHamletNameIn } from '../hamletLabel.js';

/** @param {{ accounting: object }} deps */
export function initCompanyAidSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-companyAid');
  if (!section) return;

  const presenter = new CompanyAidSectionPresenter(deps);
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
