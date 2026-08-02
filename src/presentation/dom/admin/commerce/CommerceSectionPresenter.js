import { buildTradePartnersView } from '../../../../contexts/commerce/application/queries/GetTradePartnersView.js';
import { renderTradePartnersList } from './renderTradePartners.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';

export class CommerceSectionPresenter {
  /**
   * @param {{
   *   accounting: object,
   *   commerce: object,
   *   employment: object,
   *   housing: object,
   *   supply: object,
   *   updateDisplayedFunds?: (funds: number) => void,
   * }} deps
   */
  constructor(deps = {}) {
    this.accounting = deps.accounting;
    this.commerce = deps.commerce;
    this.employment = deps.employment;
    this.housing = deps.housing;
    this.supply = deps.supply;
    this.updateDisplayedFunds = deps.updateDisplayedFunds ?? (() => {});
    this.partnersData = null;
    this.clickHandler = null;
  }

  async init() {
    this.setupEventListeners();
    this.loadPartnersData();
    await this.renderPartners();
  }

  loadPartnersData() {
    this.partnersData = this.commerce.loadOrSeedCommercePartners();
  }

  savePartnersData() {
    this.commerce.saveCommercePartners(this.partnersData);
  }

  async checkWindmillStocks(partner) {
    try {
      const allWindmills = await this.supply.listWindmillSupplyViews();
      const commercializableWindmills = await this.supply.listCommercializableWindmills();

      if (allWindmills.length === 0) {
        return {
          hasStocks: false,
          missingProducts: ['Aucun moulin construit'],
          noCommercializableWindmills: false,
        };
      }

      if (commercializableWindmills.length === 0) {
        return {
          hasStocks: false,
          missingProducts: ['Commerce impossible : aucun moulin'],
          noCommercializableWindmills: true,
        };
      }

      const requiredProducts = partner.imports.map((imp) => imp.productId);
      const missingProducts = [];

      for (const productId of requiredProducts) {
        const stockKey = this.commerce.getProductStockKey(productId);
        if (!stockKey) continue;

        let totalStock = 0;
        for (const windmill of commercializableWindmills) {
          const stocks = windmill.stocks || {};
          totalStock += stocks[stockKey] || 0;
        }

        if (totalStock < 1) {
          const productName = this.commerce.getProductDisplayName(productId);
          missingProducts.push(`${productName} (stock: ${totalStock})`);
        }
      }

      return {
        hasStocks: missingProducts.length === 0,
        missingProducts,
        noCommercializableWindmills: false,
      };
    } catch (error) {
      console.error('[CommerceSectionPresenter] Error checking windmill stocks:', error);
      return {
        hasStocks: false,
        missingProducts: ['Erreur lors de la vérification'],
        noCommercializableWindmills: false,
      };
    }
  }

  async checkPartnerActivationConditions(partner) {
    const [population, unemployment, stocksCheck] = await Promise.all([
      this.housing.getCityTotalPopulation(),
      this.employment.getCityEmploymentSummary().then((summary) => summary.unemploymentPercentage),
      this.checkWindmillStocks(partner),
    ]);

    return this.commerce.evaluatePartnerActivationConditions({
      partner,
      activationConditions: partner.activationConditions,
      metrics: { population, unemployment, stocksCheck },
    });
  }

  async activatePartner(partnerId) {
    const partner = this.partnersData.find((item) => item.id === partnerId);
    if (!partner) {
      return { success: false, newStatus: null, message: 'Partenaire non trouvé' };
    }

    if (partner.isActive) {
      return { success: false, newStatus: true, message: 'La route est déjà ouverte' };
    }

    const conditionCheck = await this.checkPartnerActivationConditions(partner);
    if (!conditionCheck.canActivate) {
      return {
        success: false,
        newStatus: false,
        message: `Conditions non remplies : ${conditionCheck.unmetConditions.join(', ')}`,
      };
    }

    const commercialRouteFee = this.accounting.getCommercialRouteFee();
    try {
      const currentBudget = await this.accounting.getTreasurySnapshot();
      const timeInfo = currentBudget?.turn !== undefined
        ? TimeManager.getTimeInfo(currentBudget.turn)
        : null;
      const yearDisplay = timeInfo && timeInfo.year === 0 ? '0 JC' : timeInfo ? `${timeInfo.year} ap JC` : '';
      const monthName = timeInfo ? timeInfo.month || 'Mois' : 'Mois';
      const dateDisplay = `${monthName} ${yearDisplay}`;

      const breakdown = [{
        label: partner.name,
        quantity: 1,
        unitCost: commercialRouteFee,
        total: commercialRouteFee,
      }];
      const description = `Route commerciale - ${dateDisplay} |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;

      const feeResult = await this.accounting.recordCommercialRouteFee(
        commercialRouteFee,
        description,
        partnerId
      );

      if (feeResult.skipped && feeResult.reason === 'duplicate_business_key') {
        partner.isActive = true;
        this.savePartnersData();
        return {
          success: true,
          newStatus: true,
          message: 'Route commerciale déjà payée — route réactivée.',
        };
      }

      this.updateDisplayedFunds(feeResult.budget.funds);
    } catch (error) {
      console.error('[CommerceSectionPresenter] Error paying commercial route fee:', error);
      return {
        success: false,
        newStatus: false,
        message: 'Erreur lors du paiement de la route commerciale',
      };
    }

    partner.isActive = true;
    this.savePartnersData();
    return {
      success: true,
      newStatus: true,
      message: `Route ouverte avec ${partner.name} (${commercialRouteFee} €). Les échanges sont automatiques selon les saisons.`,
    };
  }

  showPartnerMessage(message, type = 'info') {
    let messageContainer = document.getElementById('commerce-partner-message');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'commerce-partner-message';
      messageContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
      `;
      document.body.appendChild(messageContainer);
    }

    messageContainer.textContent = message;
    if (type === 'success') {
      messageContainer.style.background = '#d4edda';
      messageContainer.style.color = '#155724';
      messageContainer.style.borderLeft = '4px solid #28a745';
    } else if (type === 'error') {
      messageContainer.style.background = '#f8d7da';
      messageContainer.style.color = '#721c24';
      messageContainer.style.borderLeft = '4px solid #dc3545';
    } else {
      messageContainer.style.background = '#d1ecf1';
      messageContainer.style.color = '#0c5460';
      messageContainer.style.borderLeft = '4px solid #17a2b8';
    }

    messageContainer.style.display = 'block';
    setTimeout(() => {
      if (messageContainer) {
        messageContainer.style.display = 'none';
      }
    }, 5000);
  }

  async buildPartnersViewModel() {
    this.loadPartnersData();
    const stats = this.commerce.loadCommerceStats();
    const productConfig = this.commerce.loadOrSeedCommerceConfig();
    const commercializableWindmills = await this.supply.listCommercializableWindmills();
    const activationByPartnerId = {};

    for (const partner of this.partnersData) {
      const conditionCheck = await this.checkPartnerActivationConditions(partner);
      activationByPartnerId[partner.id] = {
        canActivate: conditionCheck.unmetConditions.length === 0,
        unmetConditions: conditionCheck.unmetConditions,
      };
    }

    return buildTradePartnersView({
      partners: this.partnersData,
      stats,
      productConfig,
      hasCommercializableWindmills: commercializableWindmills.length > 0,
      activationByPartnerId,
    });
  }

  async renderPartners() {
    const partnersList = document.getElementById('commerce-partners-list');
    if (!partnersList) return;

    const viewModel = await this.buildPartnersViewModel();
    partnersList.innerHTML = renderTradePartnersList(viewModel);
  }

  setupRefreshButton() {
    const refreshBtn = document.getElementById('commerce-refresh-btn');
    if (!refreshBtn) return;

    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);

    newRefreshBtn.addEventListener('click', async () => {
      newRefreshBtn.disabled = true;
      const originalHTML = newRefreshBtn.innerHTML;
      newRefreshBtn.innerHTML = 'Actualisation...';

      try {
        await this.renderPartners();
        this.showPartnerMessage('Données actualisées', 'success');
      } catch (error) {
        console.error('[CommerceSectionPresenter] Error refreshing partners:', error);
        this.showPartnerMessage('Erreur lors de l\'actualisation', 'error');
      } finally {
        newRefreshBtn.disabled = false;
        newRefreshBtn.innerHTML = originalHTML;
      }
    });
  }

  setupEventListeners() {
    const commerceBoard = document.getElementById('admin-section-commerce');
    if (!commerceBoard) return;

    if (this.clickHandler) {
      commerceBoard.removeEventListener('click', this.clickHandler);
    }

    this.clickHandler = async (event) => {
      const activationBtn = event.target.closest('.partner-activation-btn');
      if (!activationBtn) return;

      event.preventDefault();
      event.stopPropagation();

      if (activationBtn.disabled) {
        this.showPartnerMessage('Les conditions d\'activation ne sont pas remplies.', 'info');
        return;
      }

      const partnerId = activationBtn.dataset.partnerId;
      activationBtn.disabled = true;
      activationBtn.textContent = 'Ouverture...';

      try {
        const result = await this.activatePartner(partnerId);
        this.showPartnerMessage(result.message, result.success ? 'success' : 'error');
        if (result.success) {
          await this.renderPartners();
        } else {
          activationBtn.disabled = false;
          activationBtn.textContent = 'Ouvrir la route (500 €)';
        }
      } catch (error) {
        console.error('[CommerceSectionPresenter] Error activating partner:', error);
        this.showPartnerMessage('Erreur lors de l\'ouverture de la route', 'error');
        activationBtn.disabled = false;
        activationBtn.textContent = 'Ouvrir la route (500 €)';
      }
    };

    commerceBoard.addEventListener('click', this.clickHandler);
    this.setupRefreshButton();
  }
}
