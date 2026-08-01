import { registerAppService } from '../../../js/acl/appRuntime.js';
import { HealthSectionPresenter } from './HealthSection.js';

export function initHealthSection() {
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

  registerAppService('healthSectionPresenter', presenter);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHealthSection);
} else {
  initHealthSection();
}
