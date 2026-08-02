import { CommerceSectionPresenter } from './CommerceSectionPresenter.js';

/**
 * @param {{
 *   accounting: object,
 *   commerce: object,
 *   employment: object,
 *   housing: object,
 *   supply: object,
 *   updateDisplayedFunds?: (funds: number) => void,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export async function initCommerceSection(deps) {
  if (typeof document === 'undefined') return;

  const commerceSection = document.getElementById('admin-section-commerce');
  if (!commerceSection) return;

  const presenter = new CommerceSectionPresenter(deps);
  deps.registerAppService?.('commerceSectionPresenter', presenter);

  const observer = new MutationObserver(async () => {
    if (commerceSection.classList.contains('active')) {
      await presenter.renderPartners();
    }
  });

  observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

  presenter.setupEventListeners();

  if (commerceSection.classList.contains('active')) {
    await presenter.init();
  } else {
    presenter.loadPartnersData();
  }
}
