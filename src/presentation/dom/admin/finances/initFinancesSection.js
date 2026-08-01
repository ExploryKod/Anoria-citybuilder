import { FinancesSectionPresenter } from './FinancesSectionPresenter.js';

/**
 * @param {{
 *   accounting: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initFinancesSection(deps) {
  if (typeof document === 'undefined') return;

  const financesSection = document.getElementById('admin-section-finances');
  if (!financesSection) return;

  const presenter = new FinancesSectionPresenter(deps);

  const observer = new MutationObserver(() => {
    if (financesSection.classList.contains('active')) {
      presenter.loadFinancialData();
    }
  });

  observer.observe(financesSection, { attributes: true, attributeFilter: ['class'] });

  if (financesSection.classList.contains('active')) {
    presenter.init();
  }

  deps.registerAppService?.('financesSectionPresenter', presenter);
}
