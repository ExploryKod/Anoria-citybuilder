import {
  canTradeWithPartner as canTradeWithPartnerPolicy,
  getPartnerTradeLimit as getPartnerTradeLimitPolicy,
  getPartnerTradePrice,
} from '../../domain/policies/PartnerTradePolicy.js';
import {
  canImportProduct as canImportProductPolicy,
  canExportProduct as canExportProductPolicy,
} from '../../domain/policies/ProductTradePolicy.js';
import { getPlayerImportCap } from '../../domain/policies/PlayerTradeTogglePolicy.js';
import {
  isStockableProduct,
  getProductStockKey,
  getDefaultTradePrice,
} from '../../domain/catalogs/ProductCatalog.js';
import { CommerceHubStockOperations } from './CommerceHubStockOperations.js';
import { ProcessProductImport } from '../commands/ProcessProductImport.js';
import { ProcessProductExport } from '../commands/ProcessProductExport.js';
import { RunCommerceTurn } from '../commands/RunCommerceTurn.js';

export class CommerceSimulationService {
    /**
     * @param {object} deps
     * @param {import('../../infrastructure/persistence/LocalStorageCommerceRepository.js').LocalStorageCommerceRepository} deps.commerceRepository
     * @param {(params: object) => Promise<unknown>} deps.recordImportExpense
     * @param {(params: object) => Promise<unknown>} deps.recordExportIncome
     * @param {(time: number) => object} deps.getTimeInfo
     */
    constructor(deps) {
        this.commerceRepository = deps.commerceRepository;
        this.recordImportExpense = deps.recordImportExpense;
        this.recordExportIncome = deps.recordExportIncome;
        this.getTimeInfo = deps.getTimeInfo;
        this.yearlyImports = {};
        this.yearlyExports = {};
        this.lastProcessedYear = -1;
        this.lastResetMonth = -1;
        this.partnersData = null;

        this.commerceHubStock = new CommerceHubStockOperations();

        this.processProductImportCommand = new ProcessProductImport(this);
        this.processProductExportCommand = new ProcessProductExport(this);
        this.runCommerceTurnCommand = new RunCommerceTurn(this);
    }

    loadPartners() {
        this.partnersData = this.commerceRepository.loadPartners();
        return this.partnersData;
    }

    getPartner(partnerId) {
        if (!this.partnersData) this.loadPartners();
        if (!this.partnersData) return null;
        return this.partnersData.find(p => p.id === partnerId) || null;
    }

    canTradeWithPartner(partnerId, productId, operation, time) {
        const partner = this.getPartner(partnerId);
        const timeInfo = this.getTimeInfo(time);
        return canTradeWithPartnerPolicy({
            partner,
            productId,
            operation,
            currentMonthIndex: timeInfo.monthIndex,
        });
    }

    updatePartnerTrade(partnerId, productId, operation) {
        const partner = this.getPartner(partnerId);
        if (!partner) return false;

        if (operation === 'export') {
            const trade = partner.buysFromUs?.find((line) => line.productId === productId);
            if (trade) {
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                this.commerceRepository.savePartners(this.partnersData);
                return true;
            }
        } else if (operation === 'import') {
            const trade = partner.sellsToUs?.find((line) => line.productId === productId);
            if (trade) {
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                this.commerceRepository.savePartners(this.partnersData);
                return true;
            }
        }

        return false;
    }

    getPartnerTradeLimit(partnerId, productId, operation) {
        return getPartnerTradeLimitPolicy(this.getPartner(partnerId), productId, operation);
    }

    getPartnerTradePrice(partnerId, productId, operation) {
        return getPartnerTradePrice(this.getPartner(partnerId), productId, operation)
            ?? getDefaultTradePrice(productId, operation);
    }

    getProductConfig(productId) {
        return this.commerceRepository.getProductConfig(productId);
    }

    isStockable(productId) {
        return isStockableProduct(productId);
    }

    getStockKey(productId) {
        return getProductStockKey(productId);
    }

    canImportProduct(productId, quantity, conditions = null) {
        const productConfig = this.getProductConfig(productId);
        const partners = this.partnersData ?? [];
        const effectiveConfig = productConfig
            ? { ...productConfig, buyingMax: getPlayerImportCap(productConfig, partners) }
            : null;
        return canImportProductPolicy({
            productConfig: effectiveConfig,
            quantity,
            currentYearlyTotal: this.yearlyImports[productId] || 0,
            conditions,
        });
    }

    canExportProduct(productId, quantity, availableStock, conditions = null) {
        return canExportProductPolicy({
            productConfig: this.getProductConfig(productId),
            quantity,
            currentYearlyTotal: this.yearlyExports[productId] || 0,
            availableStock,
            productId,
            conditions,
        });
    }

    async getCommerceHubStock(productId) {
        return this.commerceHubStock.getTotalStock(productId);
    }

    async processProductImport(params) {
        return this.processProductImportCommand.execute(params);
    }

    async processProductExport(params) {
        return this.processProductExportCommand.execute(params);
    }

    async simulate(city, time = 0) {
        return this.runCommerceTurnCommand.execute(city, time);
    }
}
