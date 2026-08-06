import * as eventsConfig from '../../../config/events.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';

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
const saveBtn = document.getElementById('settings-save-btn');

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

loadValues();
