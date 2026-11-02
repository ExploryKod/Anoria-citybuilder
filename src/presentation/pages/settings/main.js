import * as eventsConfig from '../../../config/events.js';
import { isTouchModeEnabled, setTouchModeEnabled } from '../../../config/touchMode.js';
import { isCameraDpadEnabled, setCameraDpadEnabled } from '../../../config/cameraDpad.js';
import { isCheatCodesAllowed, setCheatCodesAllowed } from '../../../config/cheatCodes.js';
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
const daysPerMonthNote = document.getElementById('settings-days-per-month-note');
const tileGridToggle = document.getElementById('settings-tile-grid');
const touchModeToggle = document.getElementById('settings-touch-mode');
const cameraDpadToggle = document.getElementById('settings-camera-dpad');
const cheatCodesToggle = document.getElementById('settings-cheat-codes');
const saveBtn = document.getElementById('settings-save-btn');

/** Days per month: editable only before a game exists; frozen once it does. */
async function loadCalendar() {
  if (!daysPerMonthInput) return;
  const calendar = await eventsConfig.describeCalendar();
  daysPerMonthInput.min = String(eventsConfig.DAYS_PER_MONTH_MIN);
  daysPerMonthInput.max = String(eventsConfig.DAYS_PER_MONTH_MAX);
  daysPerMonthInput.value = String(calendar.daysPerMonth);
  daysPerMonthInput.disabled = calendar.frozen;
  if (daysPerMonthNote) {
    daysPerMonthNote.textContent = calendar.frozen
      ? 'Figé : une partie est en cours. Réinitialisez la partie pour le modifier.'
      : 'Choisissez-le avant de lancer la partie : il sera figé à la création de la partie.';
  }
}

function loadValues() {
  if (eventsToggle) {
    eventsToggle.checked = eventsConfig.isEventsEnabled();
  }
  if (probabilityInput) {
    probabilityInput.value = String(eventsConfig.getEventProbability());
  }
  loadCalendar().catch((error) => {
    console.error('[settings] cannot load the calendar', error);
    if (daysPerMonthNote) daysPerMonthNote.textContent = `Calendrier indisponible : ${error.message}`;
  });
  if (tileGridToggle) {
    tileGridToggle.checked = readStoredTileGridVisibility();
  }
  if (touchModeToggle) {
    touchModeToggle.checked = isTouchModeEnabled();
  }
  if (cameraDpadToggle) {
    cameraDpadToggle.checked = isCameraDpadEnabled();
  }
  if (cheatCodesToggle) {
    cheatCodesToggle.checked = isCheatCodesAllowed();
  }
}

function saveValues() {
  if (eventsToggle) {
    eventsConfig.setEventsEnabled(eventsToggle.checked);
  }
  if (probabilityInput) {
    eventsConfig.setEventProbability(parseInt(probabilityInput.value, 10));
  }
  if (daysPerMonthInput && !daysPerMonthInput.disabled) {
    eventsConfig
      .setPregameDaysPerMonth(Number(daysPerMonthInput.value))
      .catch((error) => {
        console.error('[settings] days per month not saved', error);
        if (daysPerMonthNote) daysPerMonthNote.textContent = `Non enregistré : ${error.message}`;
      });
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
  if (cameraDpadToggle) {
    setCameraDpadEnabled(cameraDpadToggle.checked);
  }
  if (cheatCodesToggle) {
    setCheatCodesAllowed(cheatCodesToggle.checked);
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
