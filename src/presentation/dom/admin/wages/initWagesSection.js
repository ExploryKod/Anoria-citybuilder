import { WagesSectionPresenter } from './WagesSectionPresenter.js';

/** @param {{ accounting: object, employment?: object }} deps */
export function initWagesSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-wages');
  if (!section) return;

  const presenter = new WagesSectionPresenter(deps);
  const open = () => presenter.refresh();

  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
