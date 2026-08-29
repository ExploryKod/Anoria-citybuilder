import {
  renderHamletsMapPage,
  renderHamletsMapPanel,
  renderHamletsMapStage,
} from './renderHamletsMap.js';

/**
 * @param {HTMLElement} root
 * @param {{ mapApi: import('../../../composition/mapSessionApi.js').createMapSessionApi extends (...args: any[]) => infer R ? R : never }} deps
 */
export class HamletsMapController {
  /**
   * @param {HTMLElement} root
   * @param {{ mapApi: object }} deps
   */
  constructor(root, { mapApi }) {
    this.root = root;
    this.mapApi = mapApi;
    this.view = null;
    this.selectedHamletId = null;
    this.clickHandler = null;
  }

  async init() {
    this.view = await this.mapApi.getHamletsMapView();
    this.selectedHamletId = this.view.activeHamletId;
    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.view) return;
    this.root.innerHTML = renderHamletsMapPage(this.view, this.selectedHamletId);
  }

  bindEvents() {
    this.unbindEvents();
    this.clickHandler = async (event) => {
      const marker = event.target.closest('[data-hamlet-id]');
      if (!marker) return;

      const hamletId = marker.dataset.hamletId;
      if (!hamletId) return;

      if (marker.classList.contains('hamlets-map-travel-btn')) {
        event.preventDefault();
        const result = await this.mapApi.travelToHamlet(hamletId);
        if (result.success) {
          window.location.href = '/game';
        }
        return;
      }

      this.selectedHamletId = hamletId;
      this.updateSelection();
    };

    this.root.addEventListener('click', this.clickHandler);
  }

  updateSelection() {
    if (!this.view) return;

    const canvas = this.root.querySelector('#hamlets-map-canvas');
    const panel = this.root.querySelector('#hamlets-map-panel');
    if (canvas) {
      canvas.innerHTML = renderHamletsMapStage(this.view, this.selectedHamletId);
    }
    if (panel) {
      panel.innerHTML = renderHamletsMapPanel(this.view, this.selectedHamletId);
    }
  }

  unbindEvents() {
    if (this.clickHandler) {
      this.root.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  destroy() {
    this.unbindEvents();
  }
}
