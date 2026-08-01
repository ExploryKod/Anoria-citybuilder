import { registerAppService } from '../../../acl/appRuntime.js';
import { WorkSectionPresenter } from './WorkSection.js';

export function initWorkSection() {
  const workSection = document.getElementById('admin-section-work');
  if (!workSection) return;

  const presenter = new WorkSectionPresenter();
  registerAppService('workSectionPresenter', presenter);

  const observer = new MutationObserver(() => {
    if (workSection.classList.contains('active')) {
      presenter.loadWorkData();
    }
  });

  observer.observe(workSection, { attributes: true, attributeFilter: ['class'] });

  if (workSection.classList.contains('active')) {
    presenter.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkSection);
} else {
  initWorkSection();
}
