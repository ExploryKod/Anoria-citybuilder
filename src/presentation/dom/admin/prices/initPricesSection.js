import { PricesSectionPresenter } from './PricesSectionPresenter.js';

/** @param {{ trade?: object }} deps */
export function initPricesSection(deps) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('admin-section-prices');
  if (!section) return;

  const presenter = new PricesSectionPresenter(deps);
  const open = () => presenter.refresh();

  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
