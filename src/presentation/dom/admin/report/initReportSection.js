import { ReportSectionPresenter } from './ReportSectionPresenter.js';

/**
 * @param {{ registerAppService?: (name: string, instance: *) => void }} deps
 */
export function initReportSection(deps = {}) {
  if (typeof document === 'undefined') return;

  const reportSection = document.getElementById('admin-section-report');
  if (!reportSection) return;

  const presenter = new ReportSectionPresenter();

  const observer = new MutationObserver(() => {
    if (reportSection.classList.contains('active')) {
      presenter.init();
      observer.disconnect();
    }
  });

  observer.observe(reportSection, { attributes: true, attributeFilter: ['class'] });

  if (reportSection.classList.contains('active')) {
    presenter.init();
    observer.disconnect();
  }

  deps.registerAppService?.('reportSectionPresenter', presenter);
}
