import {
  renderTradeMapPanelForCity,
  renderTradeMapStageContent,
} from '../admin/commerce/renderTradeMap.js';
import { renderWorldMapPage } from './renderWorldMap.js';

/**
 * @param {HTMLElement} root
 * @param {{ mapApi: object }} deps
 */
export class WorldMapController {
  /**
   * @param {HTMLElement} root
   * @param {{ mapApi: object }} deps
   */
  constructor(root, { mapApi }) {
    this.root = root;
    this.mapApi = mapApi;
    this.view = null;
    this.selectedCityId = 'anoria';
    this.clickHandler = null;
    this.messageTimeout = null;
  }

  async init() {
    await this.refresh();
    this.bindEvents();
  }

  async refresh() {
    this.view = await this.mapApi.getWorldMapView();
    this.render();
  }

  render() {
    if (!this.view) return;
    this.root.innerHTML = renderWorldMapPage(this.view, this.selectedCityId);
  }

  bindEvents() {
    this.unbindEvents();
    this.clickHandler = async (event) => {
      const activateBtn = event.target.closest('.trade-map-open-route-btn');
      if (activateBtn) {
        event.preventDefault();
        const partnerId = activateBtn.dataset.partnerId;
        const result = await this.mapApi.activateTradePartner(partnerId);
        this.showMessage(result.message, result.success ? 'success' : 'error');
        if (result.success) {
          await this.refresh();
        }
        return;
      }

      const cityBtn = event.target.closest('.trade-map-city[data-city-id]');
      if (cityBtn) {
        this.selectedCityId = cityBtn.dataset.cityId;
        this.updateSelection();
        return;
      }

      const kingdom = event.target.closest('.trade-map-city--player');
      if (kingdom) {
        window.location.href = '/hamlets';
      }
    };

    this.root.addEventListener('click', this.clickHandler);
  }

  updateSelection() {
    if (!this.view) return;

    const stage = this.root.querySelector('#world-map-canvas .trade-map-stage');
    const panel = this.root.querySelector('#world-map-panel');
    if (stage) {
      stage.outerHTML = renderTradeMapStageContent(this.view.partners, this.selectedCityId);
    }
    if (panel) {
      panel.innerHTML = renderTradeMapPanelForCity(this.selectedCityId, this.view.partners);
    }
  }

  showMessage(message, type = 'info') {
    let container = document.getElementById('world-map-message');
    if (!container) {
      container = document.createElement('div');
      container.id = 'world-map-message';
      container.className = 'world-map-message';
      document.body.appendChild(container);
    }

    container.textContent = message;
    container.dataset.type = type;
    container.hidden = false;

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.messageTimeout = setTimeout(() => {
      container.hidden = true;
    }, 5000);
  }

  unbindEvents() {
    if (this.clickHandler) {
      this.root.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  destroy() {
    this.unbindEvents();
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }
}
