import { FactorySectionPresenter } from './FactorySectionPresenter.js';

/**
 * @param {{
 *   supply: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initFactorySection(deps) {
  if (typeof document === 'undefined') return;

  const factorySection = document.getElementById('admin-section-factory');
  if (!factorySection) return;

  const presenter = new FactorySectionPresenter(deps);

  const observer = new MutationObserver(() => {
    if (factorySection.classList.contains('active')) {
      presenter.setupEventListeners();
      presenter.refresh();
    }
  });

  observer.observe(factorySection, { attributes: true, attributeFilter: ['class'] });

  if (factorySection.classList.contains('active')) {
    presenter.init();
  }

  deps.registerAppService?.('factorySectionPresenter', presenter);
}
