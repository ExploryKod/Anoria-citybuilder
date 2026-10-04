import { createModalFocusSession } from '../shell/modalFocus.js';
import { renderCityCommerceTab, renderCityCultureTab } from './renderCityExchangeModal.js';

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
    this.culturePanel = document.getElementById('city-exchange-panel-culture');
    /** @type {ReturnType<typeof createModalFocusSession> | null} */
    this.focusSession = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.querySelectorAll('[role="tab"]').forEach((tab) =>
      tab.addEventListener('click', () => this.#selectTab(tab.dataset.tab))
    );
    this.overlay?.querySelector('.city-exchange-backdrop')?.addEventListener('click', () => this.close());
  }

  /**
   * @param {{ cityName: string, sales: ReadonlyArray<object>, entry: object | null }} params
   */
  open({ cityName, sales, entry }) {
    if (!this.overlay) return;

    if (this.titleEl) this.titleEl.textContent = `Échanges — ${cityName}`;
    if (this.commercePanel) this.commercePanel.innerHTML = renderCityCommerceTab(sales);
    if (this.culturePanel) this.culturePanel.innerHTML = renderCityCultureTab(entry);
    this.#selectTab('commerce');

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

  /** @param {string} name 'commerce' | 'culture' — shows that tab and its panel, hides the other. */
  #selectTab(name) {
    this.overlay?.querySelectorAll('[role="tab"]').forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    this.commercePanel?.classList.toggle('is-active', name === 'commerce');
    this.culturePanel?.classList.toggle('is-active', name === 'culture');
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
