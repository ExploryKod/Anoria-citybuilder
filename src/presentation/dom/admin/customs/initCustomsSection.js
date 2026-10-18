import { CustomsSectionPresenter } from './CustomsSectionPresenter.js';

/** @param {{ accounting: object }} deps */
export function initCustomsSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-customs');
  if (!section) return;

  const presenter = new CustomsSectionPresenter(deps);
  const open = () => presenter.refresh();

  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
