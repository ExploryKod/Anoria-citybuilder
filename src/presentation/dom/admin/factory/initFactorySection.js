import { registerAppService } from '../../../../composition/sessionShell.js';
import { FactorySectionPresenter } from './FactorySectionPresenter.js';

export function initFactorySection() {
  const factorySection = document.getElementById('admin-section-factory');
  if (!factorySection) return;

  const presenter = new FactorySectionPresenter();

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

  registerAppService('factorySectionPresenter', presenter);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFactorySection);
} else {
  initFactorySection();
}
