import { createModalFocusSession } from '../shell/modalFocus.js';
import { renderCityCommerceTab } from './renderCityExchangeModal.js';

/**
 * The "Échanges" modal: a city's full commerce history, opened from the world map's city panel.
 * Deliberately its own small overlay, not the building-info-panel system (see
 * renderCityExchangeModal.js for why) — but it copies that system's proven bits: the shared focus
 * trap (modalFocus.js) and a tab-strip shaped the same way, so adding a second tab later
 * (diplomacy…) is exactly as easy as it is for a building panel.
 */
export class CityExchangeModal {
  constructor() {
    this.overlay = document.getElementById('city-exchange-overlay');
    this.titleEl = document.getElementById('city-exchange-title');
    this.closeBtn = document.getElementById('city-exchange-close-btn');
    this.commercePanel = document.getElementById('city-exchange-panel-commerce');
    /** @type {ReturnType<typeof createModalFocusSession> | null} */
    this.focusSession = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.querySelector('.city-exchange-backdrop')?.addEventListener('click', () => this.close());
  }

  /**
   * @param {{ cityName: string, sales: ReadonlyArray<object> }} params
   */
  open({ cityName, sales }) {
    if (!this.overlay) return;

    if (this.titleEl) this.titleEl.textContent = `Échanges — ${cityName}`;
    if (this.commercePanel) this.commercePanel.innerHTML = renderCityCommerceTab(sales);

    this.overlay.classList.add('active');
    this.overlay.removeAttribute('inert');
    this.overlay.setAttribute('aria-hidden', 'false');

    this.focusSession?.release({ restoreFocus: false });
    this.focusSession = createModalFocusSession({
      panel: this.overlay,
      onEscape: () => this.close(),
      initialFocus: '.panel-close-btn',
      ensureDialogAttributes: false,
    });
  }

  close() {
    if (!this.overlay) return;
    this.focusSession?.release();
    this.focusSession = null;
    this.overlay.classList.remove('active');
    this.overlay.setAttribute('inert', '');
    this.overlay.setAttribute('aria-hidden', 'true');
  }
}
