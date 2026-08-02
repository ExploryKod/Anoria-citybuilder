import {
  canTradeWithPartner as canTradeWithPartnerPolicy,
  getPartnerTradeLimit as getPartnerTradeLimitPolicy,
  getPartnerTradePrice,
} from '../../domain/policies/PartnerTradePolicy.js';
import {
  canImportProduct as canImportProductPolicy,
  canExportProduct as canExportProductPolicy,
} from '../../domain/policies/ProductTradePolicy.js';
import {
  isStockableProduct,
  getProductStockKey,
  getDefaultTradePrice,
} from '../../domain/catalogs/ProductCatalog.js';
import { WindmillStockOperations } from './WindmillStockOperations.js';
import { ProcessProductImport } from '../commands/ProcessProductImport.js';
import { ProcessProductExport } from '../commands/ProcessProductExport.js';
import { RunCommerceTurn } from '../commands/RunCommerceTurn.js';

export class CommerceSimulationService {
    /**
     * @param {object} deps
     * @param {import('../../infrastructure/persistence/LocalStorageCommerceRepository.js').LocalStorageCommerceRepository} deps.commerceRepository
     * @param {(params: object) => Promise<unknown>} deps.recordImportExpense
     * @param {(params: object) => Promise<unknown>} deps.recordExportIncome
     * @param {() => Promise<Array>} deps.listCommercializableWindmills
     * @param {(id: string) => Promise<object|null>} deps.getSupplyBuildingRow
     * @param {(id: string, fields: object) => Promise<unknown>} deps.updateSupplyBuildingFields
     * @param {() => Promise<Array>} deps.listWindmillSupplyViews
     * @param {(time: number) => object} deps.getTimeInfo
     * @param {(row: object) => string} deps.instanceIdFromHouseRow
     */
    constructor(deps) {
        this.commerceRepository = deps.commerceRepository;
        this.recordImportExpense = deps.recordImportExpense;
        this.recordExportIncome = deps.recordExportIncome;
        this.listCommercializableWindmills = deps.listCommercializableWindmills;
        this.getSupplyBuildingRow = deps.getSupplyBuildingRow;
        this.updateSupplyBuildingFields = deps.updateSupplyBuildingFields;
        this.listWindmillSupplyViews = deps.listWindmillSupplyViews;
        this.getTimeInfo = deps.getTimeInfo;
        this.instanceIdFromHouseRow = deps.instanceIdFromHouseRow;
        this.yearlyImports = {};
        this.yearlyExports = {};
        this.lastProcessedYear = -1;
        this.lastResetMonth = -1;
        this.partnersData = null;

        this.windmillStock = new WindmillStockOperations({
            listCommercializableWindmills: this.listCommercializableWindmills.bind(this),
            instanceIdFromHouseRow: this.instanceIdFromHouseRow,
            getSupplyBuildingRow: this.getSupplyBuildingRow,
            updateSupplyBuildingFields: this.updateSupplyBuildingFields,
            listWindmillSupplyViews: this.listWindmillSupplyViews,
            getPartner: (partnerId) => this.getPartner(partnerId),
        });

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
            const trade = partner.imports.find(imp => imp.productId === productId);
            if (trade) {
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                this.commerceRepository.savePartners(this.partnersData);
                return true;
            }
        } else if (operation === 'import') {
            const trade = partner.exports.find(exp => exp.productId === productId);
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
        return canImportProductPolicy({
            productConfig: this.getProductConfig(productId),
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

    async getTotalWindmillStock(productId) {
        return this.windmillStock.getTotalStock(productId);
    }

    async getCommercializableWindmills() {
        return this.windmillStock.getCommercializableWindmills();
    }

    async addToWindmillStock(productId, quantity, partnerId = null) {
        return this.windmillStock.addToStock(productId, quantity, partnerId);
    }

    async reduceWindmillStock(productId, quantity, partnerId = null) {
        return this.windmillStock.reduceStock(productId, quantity, partnerId);
    }

    async processProductImport(params) {
        return this.processProductImportCommand.execute(params);
    }

    async processProductExport(params) {
        return this.processProductExportCommand.execute(params);
    }

    async resetWindmillImportsDisplay() {
        return this.windmillStock.resetImportsDisplay();
    }

    async simulate(city, time = 0) {
        return this.runCommerceTurnCommand.execute(city, time);
    }
}
