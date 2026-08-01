import { getOrCreateCommerceContext } from '../../composition/createCommerceContext.js';

/** Shared commerce persistence (localStorage). */
const commerceStore = {
  saveConfig(goodsData) {
    return getOrCreateCommerceContext().commerceRepository.saveConfig(goodsData);
  },
  loadConfig() {
    return getOrCreateCommerceContext().commerceRepository.loadConfig();
  },
  getProductConfig(productId) {
    return getOrCreateCommerceContext().commerceRepository.getProductConfig(productId);
  },
  saveStats(stats) {
    return getOrCreateCommerceContext().commerceRepository.saveStats(stats);
  },
  loadStats() {
    return getOrCreateCommerceContext().commerceRepository.loadStats();
  },
  updateProductStats(productId, productStats) {
    return getOrCreateCommerceContext().commerceRepository.updateProductStats(
      productId,
      productStats
    );
  },
  resetYearlyStats() {
    return getOrCreateCommerceContext().commerceRepository.resetYearlyStats();
  },
  loadPartners() {
    return getOrCreateCommerceContext().commerceRepository.loadPartners();
  },
  savePartners(partnersData) {
    return getOrCreateCommerceContext().commerceRepository.savePartners(partnersData);
  },
  clear() {
    return getOrCreateCommerceContext().clear();
  },
};

export default commerceStore;
