import * as eventsConfig from '../../../config/events.js';
import { isTouchModeEnabled, setTouchModeEnabled } from '../../../config/touchMode.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';
import { getLastPwaUpdateAt, installLatestPwaUpdate } from '../../../pwa.js';

bootSiteChrome();

const TILE_GRID_KEY = 'anoria.tileGridVisible';

function readStoredTileGridVisibility() {
  try {
    return localStorage.getItem(TILE_GRID_KEY) === '1';
  } catch {
    return false;
  }
}

const eventsToggle = document.getElementById('settings-events-enabled');
const probabilityInput = document.getElementById('settings-event-probability');
const daysPerMonthInput = document.getElementById('settings-days-per-month');
const tileGridToggle = document.getElementById('settings-tile-grid');
const touchModeToggle = document.getElementById('settings-touch-mode');
const saveBtn = document.getElementById('settings-save-btn');
const pwaUpdateBtn = document.getElementById('settings-pwa-update-btn');
const pwaUpdateStatus = document.getElementById('settings-pwa-update-status');

function refreshPwaUpdateStatus() {
  if (!pwaUpdateStatus) return;
  const iso = getLastPwaUpdateAt();
  if (!iso) {
    pwaUpdateStatus.hidden = true;
    pwaUpdateStatus.textContent = '';
    return;
  }
  try {
    const formatted = new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    pwaUpdateStatus.hidden = false;
    pwaUpdateStatus.textContent = `Dernière installation : ${formatted}`;
  } catch {
    pwaUpdateStatus.hidden = true;
  }
}

function loadValues() {
  if (eventsToggle) {
    eventsToggle.checked = eventsConfig.isEventsEnabled();
  }
  if (probabilityInput) {
    probabilityInput.value = String(eventsConfig.getEventProbability());
  }
  if (daysPerMonthInput) {
    daysPerMonthInput.value = String(eventsConfig.getDaysPerMonth());
  }
  if (tileGridToggle) {
    tileGridToggle.checked = readStoredTileGridVisibility();
  }
  if (touchModeToggle) {
    touchModeToggle.checked = isTouchModeEnabled();
  }
  refreshPwaUpdateStatus();
}

function saveValues() {
  if (eventsToggle) {
    eventsConfig.setEventsEnabled(eventsToggle.checked);
  }
  if (probabilityInput) {
    eventsConfig.setEventProbability(parseInt(probabilityInput.value, 10));
  }
  if (daysPerMonthInput) {
    eventsConfig.setDaysPerMonth(parseInt(daysPerMonthInput.value, 10));
  }
  if (tileGridToggle) {
    try {
      localStorage.setItem(TILE_GRID_KEY, tileGridToggle.checked ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
  if (touchModeToggle) {
    setTouchModeEnabled(touchModeToggle.checked);
  }
}

if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    saveValues();
    saveBtn.textContent = 'Enregistré';
    setTimeout(() => {
      saveBtn.textContent = 'Enregistrer';
    }, 1500);
  });
}

if (pwaUpdateBtn) {
  pwaUpdateBtn.addEventListener('click', async () => {
    const previous = pwaUpdateBtn.textContent;
    pwaUpdateBtn.disabled = true;
    pwaUpdateBtn.textContent = 'Installation…';
    try {
      await installLatestPwaUpdate();
      refreshPwaUpdateStatus();
    } finally {
      pwaUpdateBtn.disabled = false;
      pwaUpdateBtn.textContent = previous || 'Installer';
    }
  });
}

loadValues();
