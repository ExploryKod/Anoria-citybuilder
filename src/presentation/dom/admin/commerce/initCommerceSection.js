import { CommerceSectionPresenter } from './CommerceSectionPresenter.js';

/**
 * @param {{
 *   trade: object,
 *   accounting: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initCommerceSection(deps) {
  if (typeof document === 'undefined') return;

  const section = document.getElementById('admin-section-commerce');
  if (!section) return;

  const presenter = new CommerceSectionPresenter(deps);
  let initialized = false;

  const observer = new MutationObserver(() => {
    if (section.classList.contains('active')) {
      if (!initialized) {
        initialized = true;
        void presenter.init();
      } else {
        void presenter.refresh();
      }
    }
  });

  observer.observe(section, { attributes: true, attributeFilter: ['class'] });

  if (section.classList.contains('active')) {
    initialized = true;
    void presenter.init();
  }

  deps.registerAppService?.('commerceSectionPresenter', presenter);
}
