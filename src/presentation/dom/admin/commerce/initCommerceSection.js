import { CommerceSectionPresenter } from './CommerceSectionPresenter.js';

/**
 * @param {{
 *   accounting: object,
 *   commerce: object,
 *   employment: object,
 *   housing: object,
 *   supply: object,
 *   updateDisplayedFunds?: (funds: number) => void,
 *   getGameTime?: () => number,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export async function initCommerceSection(deps) {
  if (typeof document === 'undefined') return;

  const commerceSection = document.getElementById('admin-section-commerce');
  if (!commerceSection) return;

  const presenter = new CommerceSectionPresenter(deps);
  deps.registerAppService?.('commerceSectionPresenter', presenter);

  deps.commerce.setCommercePartnerContractFinishedHandler(({ partnerName, finishedProducts }) => {
    const productsText = finishedProducts.length > 0 ? finishedProducts.join(', ') : 'toutes les denrées';
    presenter.showPartnerMessage(
      `Contrat terminé avec ${partnerName} (${productsText}). Le partenaire a été désactivé automatiquement.`,
      'info'
    );
    presenter.loadPartnersData();
    presenter.renderPartners().catch((error) => {
      console.error('[CommerceSectionPresenter] Error rendering partners after contract finish:', error);
    });
  });

  await presenter.loadGoodsData();

  const observer = new MutationObserver(async () => {
    if (commerceSection.classList.contains('active')) {
      await presenter.loadGoodsData();
    }
  });

  observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

  if (commerceSection.classList.contains('active')) {
    await presenter.init();
  } else {
    presenter.setupEventListeners();
    presenter.setupTabs();
    presenter.loadPartnersData();
  }
}
