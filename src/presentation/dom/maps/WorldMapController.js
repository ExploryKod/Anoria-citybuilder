import { renderWorldMapPanel, renderWorldMapShell, renderWorldMapStats } from './renderWorldMap.js';
import { bootstrapWorldMap } from '../../phaser/world/bootstrapWorldMap.js';
import { CityExchangeModal } from './CityExchangeModal.js';

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
    this.messageTimeout = null;
    /** @type {ReturnType<typeof bootstrapWorldMap> | null} */
    this.phaserHandle = null;
    /** @type {HTMLElement | null} */
    this.phaserHost = null;
    /** The last tradeInfo fetched for the selected city — the "Échanges" button reuses it rather
     * than re-fetching (updatePanel already has it fresh every time the selection changes). */
    this.currentTradeInfo = null;
    this.exchangeModal = new CityExchangeModal();
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
    await this.updatePanel();
    this.mountPhaser();
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
  async handleCitySelected(cityId) {
    this.selectedCityId = cityId;
    this.selectedHamletId = null;
    await this.updatePanel();
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
    await this.updatePanel();
    this.phaserHandle?.refresh(this.view, this.getSelection());
  }

  updateStats() {
    if (!this.view) return;
    const statsEl = document.getElementById('world-map-stats');
    if (statsEl) {
      statsEl.textContent = renderWorldMapStats(this.view);
    }
  }

  async updatePanel() {
    if (!this.view) return;
    const panel = this.root.querySelector('#world-map-panel');
    if (!panel) return;

    const selection = this.getSelection();
    let tradeInfo = null;
    if (selection.cityId && selection.cityId !== 'anoria') {
      tradeInfo = await this.mapApi.getCityTradeInfo(selection.cityId).catch(() => null);
    }
    this.currentTradeInfo = tradeInfo;
    panel.innerHTML = renderWorldMapPanel(this.view, selection, tradeInfo);
    this.#bindPanelEvents(panel);
  }

  /** Bind the "Échanges" button inside the city panel after each render. */
  #bindPanelEvents(panel) {
    const exchangesBtn = panel.querySelector('[data-action="open-city-exchange"]');
    if (!exchangesBtn) return;
    exchangesBtn.addEventListener('click', () => {
      const cityName = panel.querySelector('.trade-map-panel-city')?.textContent ?? '';
      this.exchangeModal.open({ cityName, sales: this.currentTradeInfo?.sales ?? [] });
    });
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


  destroy() {
    this.exchangeModal.close();
    this.phaserHandle?.destroy();
    this.phaserHandle = null;
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }
}
