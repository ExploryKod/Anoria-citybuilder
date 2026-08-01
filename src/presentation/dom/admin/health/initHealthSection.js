import { HealthSectionPresenter } from './HealthSectionPresenter.js';

/**
 * @param {{ registerAppService?: (name: string, instance: *) => void }} deps
 */
export function initHealthSection(deps = {}) {
  if (typeof document === 'undefined') return;

  const healthSection = document.getElementById('admin-section-health');
  if (!healthSection) return;

  const presenter = new HealthSectionPresenter();

  const observer = new MutationObserver(() => {
    if (healthSection.classList.contains('active')) {
      presenter.init();
      observer.disconnect();
    }
  });

  observer.observe(healthSection, { attributes: true, attributeFilter: ['class'] });

  if (healthSection.classList.contains('active')) {
    presenter.init();
    observer.disconnect();
  }

  deps.registerAppService?.('healthSectionPresenter', presenter);
}
