import * as eventsConfig from '../../../config/events.js';
import { isTouchModeEnabled, setTouchModeEnabled } from '../../../config/touchMode.js';
import { isCameraDpadEnabled, setCameraDpadEnabled } from '../../../config/cameraDpad.js';
import { isCheatCodesAllowed, setCheatCodesAllowed } from '../../../config/cheatCodes.js';
import { isWebGpuEnabled, isWebGpuExposed, setWebGpuEnabled } from '../../../config/renderBackend.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';

bootSiteChrome();

/** The tabs of the page: one panel shown at a time; arrows move between tabs, as a tablist does. */
function initTabs() {
  const tabs = [...document.querySelectorAll('.settings-tab')];
  const select = (tab, { focus = false } = {}) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(other.getAttribute('aria-controls'));
      if (!panel) throw new Error(`[settings] the tab "${other.id}" names a panel that is not on the page`);
      panel.hidden = !selected;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(tabs[(index + step + tabs.length) % tabs.length], { focus: true });
    });
  });
}

initTabs();

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
const webGpuToggle = document.getElementById('settings-webgpu');
const webGpuNote = document.getElementById('settings-webgpu-note');
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
  if (webGpuToggle) {
    // A browser that does not expose WebGPU cannot try it: the switch is locked and says why.
    const exposed = isWebGpuExposed();
    webGpuToggle.checked = exposed && isWebGpuEnabled();
    webGpuToggle.disabled = !exposed;
    if (webGpuNote) {
      webGpuNote.textContent = exposed
        ? 'S’applique à la prochaine partie chargée.'
        : 'Ce navigateur ne propose pas WebGPU : le jeu utilise WebGL2.';
    }
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
  if (webGpuToggle && !webGpuToggle.disabled) {
    setWebGpuEnabled(webGpuToggle.checked);
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
