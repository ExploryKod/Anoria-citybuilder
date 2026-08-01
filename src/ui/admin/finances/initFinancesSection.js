import { registerAppService } from '../../../js/acl/appRuntime.js';
import { FinancesSectionPresenter } from './FinancesSection.js';

export function initFinancesSection() {
  const financesSection = document.getElementById('admin-section-finances');
  if (!financesSection) return;

  const presenter = new FinancesSectionPresenter();

  const observer = new MutationObserver(() => {
    if (financesSection.classList.contains('active')) {
      presenter.loadFinancialData();
    }
  });

  observer.observe(financesSection, { attributes: true, attributeFilter: ['class'] });

  if (financesSection.classList.contains('active')) {
    presenter.init();
  }

  registerAppService('financesSectionPresenter', presenter);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFinancesSection);
} else {
  initFinancesSection();
}
