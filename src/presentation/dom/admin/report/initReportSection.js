import { registerAppService } from '../../../../composition/sessionShell.js';
import { ReportSectionPresenter } from './ReportSectionPresenter.js';

export function initReportSection() {
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

  registerAppService('reportSectionPresenter', presenter);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReportSection);
} else {
  initReportSection();
}
