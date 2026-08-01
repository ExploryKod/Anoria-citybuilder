import { registerAppService } from '../../../../composition/facades/appRuntime.js';
import { FinancesSectionPresenter } from './FinancesSectionPresenter.js';

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
