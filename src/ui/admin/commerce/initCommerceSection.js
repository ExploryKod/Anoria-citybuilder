import { setCommercePartnerContractFinishedHandler } from '../../../js/acl/commerce.js';
import { registerAppService } from '../../../js/acl/appRuntime.js';
import { CommerceSectionPresenter } from './CommerceSectionPresenter.js';

export async function initCommerceSection() {
  const commerceSection = document.getElementById('admin-section-commerce');
  if (!commerceSection) return;

  const presenter = new CommerceSectionPresenter();
  registerAppService('commerceSectionPresenter', presenter);

  setCommercePartnerContractFinishedHandler(({ partnerName, finishedProducts }) => {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCommerceSection().catch((error) => {
      console.error('[CommerceSection] init failed:', error);
    });
  });
} else {
  initCommerceSection().catch((error) => {
    console.error('[CommerceSection] init failed:', error);
  });
}
