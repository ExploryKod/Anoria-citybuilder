import { ActivitiesSectionPresenter } from './ActivitiesSectionPresenter.js';

/**
 * @param {{
 *   accounting: object,
 *   construction: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initActivitiesSection(deps) {
  if (typeof document === 'undefined') return;

  const section = document.getElementById('admin-section-activities');
  if (!section) return;

  const presenter = new ActivitiesSectionPresenter(deps);
  presenter.init();

  const observer = new MutationObserver(() => {
    if (section.classList.contains('active')) presenter.refresh();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class'] });

  deps.registerAppService?.('activitiesSectionPresenter', presenter);
}
