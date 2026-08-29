import { renderWorldMapPanel, renderWorldMapShell, renderWorldMapStats } from './renderWorldMap.js';
import { bootstrapWorldMap } from '../../phaser/world/bootstrapWorldMap.js';

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
    this.selectedHamletId = null;
    this.clickHandler = null;
    this.messageTimeout = null;
    /** @type {ReturnType<typeof bootstrapWorldMap> | null} */
    this.phaserHandle = null;
    /** @type {HTMLElement | null} */
    this.phaserHost = null;
  }

  async init() {
    this.view = await this.mapApi.getWorldMapView();
    const params = new URLSearchParams(window.location.search);
    const hamletFromUrl = params.get('hamlet');
    const validHamlet = hamletFromUrl
      && this.view.hamlets.some((hamlet) => hamlet.id === hamletFromUrl);
    if (validHamlet) {
      this.selectedHamletId = hamletFromUrl;
      this.selectedCityId = null;
    }
    this.mountLayout();
    this.updateStats();
    this.mountPhaser();
    this.bindEvents();
  }

  getSelection() {
    return {
      cityId: this.selectedHamletId ? null : this.selectedCityId,
      hamletId: this.selectedHamletId,
    };
  }

  mountLayout() {
    if (!this.view) return;
    this.root.innerHTML = renderWorldMapShell(this.view, this.getSelection());
    this.phaserHost = this.root.querySelector('#world-phaser-root');
  }

  mountPhaser() {
    if (!this.phaserHost || !this.view) return;

    this.phaserHandle?.destroy();
    this.phaserHandle = bootstrapWorldMap(this.phaserHost, {
      view: this.view,
      selectedCityId: this.selectedCityId,
      selectedHamletId: this.selectedHamletId,
      onCitySelected: (cityId) => this.handleCitySelected(cityId),
      onHamletSelected: (hamletId) => this.handleHamletSelected(hamletId),
    });
  }

  /**
   * @param {string} cityId
   */
  handleCitySelected(cityId) {
    this.selectedCityId = cityId;
    this.selectedHamletId = null;
    this.updatePanel();
    this.phaserHandle?.refresh(this.view, this.getSelection());
  }

  /**
   * @param {string} hamletId
   */
  handleHamletSelected(hamletId) {
    this.selectedHamletId = hamletId;
    this.selectedCityId = null;
    this.updatePanel();
    this.phaserHandle?.refresh(this.view, this.getSelection());
  }

  async refresh() {
    this.view = await this.mapApi.getWorldMapView();
    this.updateStats();
    this.updatePanel();
    this.phaserHandle?.refresh(this.view, this.getSelection());
  }

  updateStats() {
    if (!this.view) return;
    const statsEl = document.getElementById('world-map-stats');
    if (statsEl) {
      statsEl.textContent = renderWorldMapStats(this.view);
    }
  }

  updatePanel() {
    if (!this.view) return;
    const panel = this.root.querySelector('#world-map-panel');
    if (panel) {
      panel.innerHTML = renderWorldMapPanel(this.view, this.getSelection());
    }
  }

  bindEvents() {
    this.unbindEvents();
    this.clickHandler = async (event) => {
      const travelBtn = event.target.closest('.world-map-travel-btn');
      if (travelBtn) {
        event.preventDefault();
        const hamletId = travelBtn.dataset.hamletId;
        if (!hamletId) return;
        const result = await this.mapApi.travelToHamlet(hamletId);
        if (result.success) {
          window.location.href = '/game';
        }
        return;
      }

      const activateBtn = event.target.closest('.trade-map-open-route-btn');
      if (activateBtn) {
        event.preventDefault();
        const partnerId = activateBtn.dataset.partnerId;
        const result = await this.mapApi.activateTradePartner(partnerId);
        this.showMessage(result.message, result.success ? 'success' : 'error');
        if (result.success) {
          await this.refresh();
        }
      }
    };

    this.root.addEventListener('click', this.clickHandler);
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
    this.phaserHandle?.destroy();
    this.phaserHandle = null;
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }
}
