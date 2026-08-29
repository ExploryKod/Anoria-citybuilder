import { buildTradeGoodsView } from '../../../../contexts/commerce/application/queries/GetTradeGoodsView.js';
import { renderCommerceGoodsList, renderCommerceGoodModal } from './renderCommerceGoods.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';

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
    this.openGoodProductId = null;
    this.goodModalHandler = null;
    this.goodModalEscapeHandler = null;
    /** @type {ReturnType<typeof createModalFocusSession> | null} */
    this.goodModalFocusSession = null;
    }

    async init() {
        this.setupEventListeners();
        this.loadPartnersData();
    await this.renderAdminEntry();
    }

    loadPartnersData() {
        this.partnersData = this.commerce.loadOrSeedCommercePartners();
    }

  savePartnersData() {
    this.commerce.saveCommercePartners(this.partnersData);
  }

    async checkPartnerActivationConditions(partner) {
    const [population, unemployment] = await Promise.all([
      this.housing.getCityTotalPopulation(),
      this.employment.getCityEmploymentSummary().then((summary) => summary.unemploymentPercentage),
        ]);

        return this.commerce.evaluatePartnerActivationConditions({
            partner,
            activationConditions: partner.activationConditions,
      metrics: {
        population,
        unemployment,
        stocksCheck: { hasStocks: true, missingProducts: [] },
      },
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
        z-index: 21000;
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

  async getStockByProductId() {
    const productConfig = this.commerce.loadOrSeedCommerceConfig();
    const barnStocks = this.supply.getCommerceHubStocks
      ? await this.supply.getCommerceHubStocks()
      : {};
    return Object.fromEntries(
      productConfig.map((product) => [product.id, barnStocks[product.id] ?? 0])
    );
  }

  async buildGoodsViewModel() {
    const stats = this.commerce.loadCommerceStats();
    const productConfig = this.commerce.loadOrSeedCommerceConfig();
    const stockByProductId = await this.getStockByProductId();
    const partners = this.commerce.loadOrSeedCommercePartners();

    return buildTradeGoodsView({ productConfig, stats, stockByProductId, partners });
  }

  async renderAdminEntry() {
    const goodsList = document.getElementById('commerce-goods-list');
    if (!goodsList) return;

    try {
      const goods = await this.buildGoodsViewModel();
      goodsList.innerHTML = renderCommerceGoodsList(goods);
      if (this.openGoodProductId) {
        const good = goods.find((item) => item.id === this.openGoodProductId);
        if (good) {
          this.renderGoodModal(good);
                    } else {
          this.closeGoodModal();
                    }
                    }
                } catch (error) {
      console.error('[CommerceSectionPresenter] Error rendering goods list:', error);
      goodsList.innerHTML = renderCommerceGoodsList([]);
    }
  }

  updateProductTradeSettings(productId, changes) {
    const config = this.commerce.loadOrSeedCommerceConfig();
    const index = config.findIndex((product) => product.id === productId);
    if (index < 0) return null;

    config[index] = { ...config[index], ...changes };
    this.commerce.saveCommerceConfig(config);
    return config[index];
  }

  renderGoodModal(good) {
    this.closeGoodModal(false);
    this.openGoodProductId = good.id;

    const container = document.createElement('div');
    container.innerHTML = renderCommerceGoodModal(good);
    const modal = container.firstElementChild;
    document.body.appendChild(modal);
    this.setupGoodModalListeners(modal);
    this.goodModalFocusSession?.release({ restoreFocus: false });
    this.goodModalFocusSession = createModalFocusSession({
      panel: modal,
      onEscape: () => this.closeGoodModal(),
      initialFocus: '#commerce-good-modal-close',
      ensureDialogAttributes: false,
    });
  }

  closeGoodModal(clearSelection = true) {
    this.goodModalFocusSession?.release();
    this.goodModalFocusSession = null;
    const modal = document.getElementById('commerce-good-modal');
    if (modal) {
      modal.remove();
    }
    if (this.goodModalHandler) {
      document.removeEventListener('keydown', this.goodModalEscapeHandler);
      this.goodModalHandler = null;
      this.goodModalEscapeHandler = null;
    }
    if (clearSelection) {
      this.openGoodProductId = null;
    }
  }

  setupGoodModalListeners(modal) {
    this.goodModalHandler = async (event) => {
      if (event.target === modal || event.target.closest('#commerce-good-modal-close')) {
        event.preventDefault();
        this.closeGoodModal();
        return;
      }

      const toggle = event.target.closest('.commerce-good-modal-toggle');
      if (toggle && !toggle.disabled) {
        const productId = toggle.dataset.productId;
        const field = toggle.dataset.field;
        this.updateProductTradeSettings(productId, { [field]: toggle.checked });
        await this.renderAdminEntry();
                return;
            }

      const thresholdInput = event.target.closest('.commerce-good-modal-threshold');
      if (thresholdInput && thresholdInput === document.activeElement) {
                return;
            }

      const industryBtn = event.target.closest('.commerce-good-modal-industry-btn');
      if (industryBtn) {
        event.preventDefault();
        const productId = industryBtn.dataset.productId;
        const nextActive = !industryBtn.classList.contains('active');
        this.updateProductTradeSettings(productId, { industryActive: nextActive });
        await this.renderAdminEntry();
      }
    };

    this.goodModalEscapeHandler = (event) => {
      if (event.key === 'Escape') {
        this.closeGoodModal();
      }
    };

    modal.addEventListener('click', this.goodModalHandler);
    modal.addEventListener('change', async (event) => {
      const thresholdInput = event.target.closest('.commerce-good-modal-threshold');
      if (!thresholdInput || thresholdInput.disabled) return;

      const productId = thresholdInput.dataset.productId;
      const field = thresholdInput.dataset.field;
      let value = Math.max(0, Number.parseInt(thresholdInput.value, 10) || 0);

      if (field === 'importUpTo') {
        const max = Number.parseInt(thresholdInput.dataset.max, 10) || 0;
        value = Math.min(max, value);
      }

      thresholdInput.value = String(value);
      this.updateProductTradeSettings(productId, { [field]: value });
      await this.renderAdminEntry();
    });

    // Escape + Tab trap handled by goodModalFocusSession (createModalFocusSession).
  }

  async openGoodModal(productId) {
    const goods = await this.buildGoodsViewModel();
    const good = goods.find((item) => item.id === productId);
    if (!good) return;
    this.renderGoodModal(good);
  }

  setupEventListeners() {
    const commerceBoard = document.getElementById('admin-section-commerce');
    if (!commerceBoard) return;

    if (this.clickHandler) {
      commerceBoard.removeEventListener('click', this.clickHandler);
    }

    this.clickHandler = async (event) => {
      const goodRow = event.target.closest('.commerce-good-row');
      if (goodRow?.dataset.productId) {
        event.preventDefault();
        await this.openGoodModal(goodRow.dataset.productId);
      }
    };

    commerceBoard.addEventListener('click', this.clickHandler);
    }
}
