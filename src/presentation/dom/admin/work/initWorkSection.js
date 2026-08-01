import { WorkSectionPresenter } from './WorkSectionPresenter.js';

/**
 * @param {{
 *   accounting: object,
 *   employment: object,
 *   housing: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initWorkSection(deps) {
  if (typeof document === 'undefined') return;

  const workSection = document.getElementById('admin-section-work');
  if (!workSection) return;

  const presenter = new WorkSectionPresenter(deps);
  deps.registerAppService?.('workSectionPresenter', presenter);

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
