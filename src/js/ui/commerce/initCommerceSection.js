import { setCommercePartnerContractFinishedHandler } from '../../acl/commerce.js';
import { CommerceSectionManager } from './CommerceSectionManager.js';

export async function initCommerceSection() {
  const commerceSection = document.getElementById('admin-section-commerce');
  if (!commerceSection) return;

  const manager = new CommerceSectionManager();

  setCommercePartnerContractFinishedHandler(({ partnerName, finishedProducts }) => {
    const productsText = finishedProducts.length > 0 ? finishedProducts.join(', ') : 'toutes les denrées';
    manager.showPartnerMessage(
      `Contrat terminé avec ${partnerName} (${productsText}). Le partenaire a été désactivé automatiquement.`,
      'info'
    );
    manager.loadPartnersData();
    manager.renderPartners().catch((error) => {
      console.error('[CommerceSectionManager] Error rendering partners after contract finish:', error);
    });
  });

  await manager.loadGoodsData();

  const observer = new MutationObserver(async () => {
    if (commerceSection.classList.contains('active')) {
      await manager.loadGoodsData();
    }
  });

  observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

  if (commerceSection.classList.contains('active')) {
    await manager.init();
  } else {
    manager.setupEventListeners();
    manager.setupTabs();
    manager.loadPartnersData();
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
