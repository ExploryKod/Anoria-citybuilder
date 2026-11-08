/**
 * JournalPanel — popup journal comptable (DOM + événements).
 * Rendu : JournalPresenter.js
 */

import { renderJournalList } from './JournalPresenter.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';
import { listHamlets } from '../../../../core/persistence/hamlet/hamletSession.js';
import { html } from '../../shell/safeHtml.js';
import { matchesSearchWords, normalizeForSearch, searchWordsOf } from './journalSearch.js';

/**
 * @type {{
 *   accounting: object,
 *   popupManager?: object | null,
 * } | null}
 */
let deps = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let journalFocusSession = null;

/**
 * The tab of the journal: 'city' is the city's books (the Hameau), 'private' the flows of the buildings' accounts.
 * @type {'city' | 'private'}
 */
let accountScope = 'city';

/**
 * @param {{
 *   accounting: object,
 *   popupManager?: object | null,
 * }} panelDeps
 */
export function initJournalPopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const journalBtn = document.getElementById('journal-btn');
  const journalPanel = document.getElementById('journal-panel');
  const journalCloseBtn = document.querySelector('.journal-close-btn');
  const journalRefreshBtn = document.getElementById('journal-refresh-btn');
  const filterButtons = document.querySelectorAll('.journal-filter-btn');

  if (!journalBtn || !journalPanel || !journalCloseBtn || !journalRefreshBtn) {
    console.warn('Journal popup elements not found');
    return;
  }

  journalBtn.addEventListener('click', () => {
    openJournal();
  });

  function openJournal() {
    journalPanel.classList.add('active');
    popupManager?.forceOpenPopup('journal-panel');
    populateHamletFilter().then(() => loadJournalEntries('all'));
    journalFocusSession?.release({ restoreFocus: false });
    journalFocusSession = createModalFocusSession({
      panel: journalPanel,
      // Escape first clears a search that is typed, and only then closes the journal.
      onEscape: () => {
        if (!clearSearch()) closeJournal();
      },
      initialFocus: '.journal-close-btn',
    });
  }

  function closeJournal() {
    journalFocusSession?.release();
    journalFocusSession = null;
    journalPanel.classList.remove('active');
    popupManager?.forceClosePopup('journal-panel');
  }

  journalCloseBtn.addEventListener('click', () => {
    closeJournal();
  });

  journalPanel.addEventListener('click', (e) => {
    if (e.target === journalPanel) {
      closeJournal();
    }
  });

  document.getElementById('journal-hamlet-filter').addEventListener('change', () => {
    const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
    const activePill = document.querySelector('.journal-filter-pill.active');
    const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
    loadJournalEntries(activeFilterBtn ? activeFilterBtn.dataset.period : 'all', typeFilter);
  });

  document.querySelectorAll('.journal-scope-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      accountScope = tab.dataset.scope === 'private' ? 'private' : 'city';
      document.querySelectorAll('.journal-scope-tab').forEach((other) => {
        const active = other === tab;
        other.classList.toggle('active', active);
        other.setAttribute('aria-selected', String(active));
      });
      const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
      const activePill = document.querySelector('.journal-filter-pill.active');
      const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
      loadJournalEntries(activeFilterBtn ? activeFilterBtn.dataset.period : 'all', typeFilter);
    });
  });

  journalRefreshBtn.addEventListener('click', () => {
    const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
    loadJournalEntries(currentPeriod);
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const activePill = document.querySelector('.journal-filter-pill.active');
      const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
      loadJournalEntries(btn.dataset.period, typeFilter);
    });
  });

  const filterPills = document.querySelectorAll('.journal-filter-pill');
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod, null);
      } else {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const typeFilter = JSON.parse(pill.dataset.types || '[]');
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod, typeFilter);
      }
    });
  });

  initTypeSelect(filterPills);
  initFilterToggle(filterPills);
  initSearch();

  // The export menu folds away after a choice, and when the player clicks elsewhere.
  const exportMenu = document.querySelector('.journal-export-menu');
  if (exportMenu) {
    exportMenu.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.journal-export-btn')) exportMenu.open = false;
    });
    document.addEventListener('click', (event) => {
      if (exportMenu.open && event.target instanceof Node && !exportMenu.contains(event.target)) exportMenu.open = false;
    });
  }

  const exportJsonBtn = document.getElementById('journal-export-json-btn');
  const exportPdfBtn = document.getElementById('journal-export-pdf-btn');

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', async () => {
      await exportJournalToJSON('city');
    });
  }

  const exportPrivateJsonBtn = document.getElementById('journal-export-private-json-btn');
  if (exportPrivateJsonBtn) {
    exportPrivateJsonBtn.addEventListener('click', async () => {
      await exportJournalToJSON('private');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      await exportJournalToPDF();
    });
  }
}

/**
 * The search box. It does not ask the journal again: it hides the entries whose text (the text on screen, what the player reads) does not hold every word typed. The words
 * are only compared with that text (journalSearch.js): nothing typed is written into the page, so there is nothing to inject. While a search is on, the totals of the years and
 * months are hidden (they would still count the entries that are hidden), and a line says how many entries match.
 */
function initSearch() {
  const input = document.getElementById('journal-search-input');
  if (!input) throw new Error('Journal: #journal-search-input is missing from game.html');
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    // A word at a time is plenty: the list is filtered when the player pauses, not at every key.
    timer = setTimeout(applySearch, 150);
  });
}

/** What was normalized for each entry already, so typing does not normalize every entry again at each pause (the entries are new elements after each load). */
const searchableText = new WeakMap();

/** Hides the entries that do not match the search typed, and the months and years left with none. Called after a typing pause and after each load of the list. */
function applySearch() {
  const input = document.getElementById('journal-search-input');
  const list = document.getElementById('journal-list');
  const status = document.getElementById('journal-search-status');
  if (!input || !list || !status) return;

  const words = searchWordsOf(input.value);
  const searching = words.length > 0;
  list.classList.toggle('is-searching', searching);

  let found = 0;
  const entries = list.querySelectorAll('.journal-entry');
  for (const entry of entries) {
    if (!searchableText.has(entry)) searchableText.set(entry, normalizeForSearch(entry.textContent));
    const shown = !searching || matchesSearchWords(searchableText.get(entry), words);
    entry.hidden = !shown;
    if (shown) found += 1;
  }
  for (const group of list.querySelectorAll('.journal-month-group, .journal-year-group')) {
    group.hidden = searching && !group.querySelector('.journal-entry:not([hidden])');
  }

  // The line is text (textContent): the words typed are shown back as text, never as markup.
  status.hidden = !searching || entries.length === 0;
  status.textContent = !searching ? '' : found === 0 ? `Aucune écriture ne contient « ${words.join(' ')} ».` : `${found} écriture${found > 1 ? 's' : ''} sur ${entries.length}.`;
}

/**
 * Empties the search box if it holds something, and shows the whole list again.
 * @returns {boolean} whether there was something to clear
 */
function clearSearch() {
  const input = document.getElementById('journal-search-input');
  if (!input || input.value === '') return false;
  input.value = '';
  applySearch();
  input.focus();
  return true;
}

/**
 * The list of filters (about twenty pills) is folded away behind one button, so the journal opens on its entries and not on a wall of pills. The button says what is
 * filtered while the list is folded ("Filtre : Impôts et taxes"), so a filter in force is never hidden.
 * @param {NodeListOf<Element>} filterPills
 */
function initFilterToggle(filterPills) {
  const toggle = document.getElementById('journal-filter-toggle');
  const panel = document.getElementById('journal-filter-panel');
  const label = toggle?.querySelector('.journal-filter-toggle__label');
  if (!toggle || !panel || !label) throw new Error('Journal: #journal-filter-toggle, its label or #journal-filter-panel is missing from game.html');

  const sync = () => {
    const active = [...filterPills].find((pill) => pill.classList.contains('active'));
    label.textContent = active ? `Filtre : ${active.querySelector('.pill-label')?.textContent.trim() ?? active.dataset.filter}` : 'Filtrer';
    toggle.classList.toggle('is-filtering', Boolean(active));
  };

  toggle.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
  });
  // A click on a pill (or the dropdown, which clicks the pill) has already moved the active mark when this runs: the button follows.
  filterPills.forEach((pill) => pill.addEventListener('click', sync));
  sync();
}

/**
 * On a phone the filter pills (about twenty of them) would fill the screen: the same filters are offered as one dropdown, shown in their place by the stylesheet.
 * It is built from the pills (their labels, their groups "Revenus" / "Dépenses"), so there is one list of filters, and choosing an option clicks the matching
 * pill, so there is one way to filter. A click on a pill (a tablet, a resized window) moves the dropdown to it.
 * @param {NodeListOf<Element>} filterPills
 */
function initTypeSelect(filterPills) {
  const pillsBox = document.querySelector('.journal-filter-pills');
  if (!pillsBox) throw new Error('Journal: .journal-filter-pills is missing from game.html');

  const select = document.createElement('select');
  select.id = 'journal-type-filter';
  select.className = 'journal-type-select';
  select.setAttribute('aria-label', 'Filtrer par type d\'écriture');
  select.append(new Option('Tous les types', ''));

  const pillByFilter = new Map();
  for (const section of pillsBox.querySelectorAll('.journal-filter-pills-section')) {
    const group = document.createElement('optgroup');
    group.label = section.querySelector('.journal-filter-pills-label')?.textContent.replace(/\s*:\s*$/, '').trim() ?? '';
    for (const pill of section.querySelectorAll('.journal-filter-pill')) {
      pillByFilter.set(pill.dataset.filter, pill);
      group.append(new Option(pill.querySelector('.pill-label')?.textContent.trim() ?? pill.dataset.filter, pill.dataset.filter));
    }
    select.append(group);
  }

  const syncFromPills = () => {
    const active = [...filterPills].find((pill) => pill.classList.contains('active'));
    select.value = active ? active.dataset.filter : '';
  };

  select.addEventListener('change', () => {
    const wanted = select.value === '' ? null : pillByFilter.get(select.value);
    const active = [...filterPills].find((pill) => pill.classList.contains('active'));
    if (wanted === null) active?.click(); // "all": a click on the active pill turns the filter off
    else if (wanted !== active) wanted.click();
  });
  filterPills.forEach((pill) => pill.addEventListener('click', syncFromPills));

  pillsBox.after(select);
  syncFromPills();
}

/** The hamlet selected in the journal filter, or null for every hamlet. */
function selectedHamletId() {
  const value = document.getElementById('journal-hamlet-filter').value;
  return value === '' ? null : value;
}

async function populateHamletFilter() {
  const select = document.getElementById('journal-hamlet-filter');
  const hamlets = await listHamlets();
  const previous = select.value;
  select.replaceChildren(
    new Option('Tous les hameaux', ''),
    ...hamlets.map((hamlet) => new Option(hamlet.name, hamlet.id))
  );
  select.value = hamlets.some((hamlet) => hamlet.id === previous) ? previous : '';
}

/** @param {string} period */
function parsePeriodDays(period) {
  if (period === 'all' || period == null) {
    return null;
  }
  const days = parseInt(period, 10);
  return Number.isNaN(days) ? null : days;
}

/**
 * @param {string} [period='all']
 * @param {string[]|null} [typeFilter=null]
 */
export async function loadJournalEntries(period = 'all', typeFilter = null) {
  if (!deps?.accounting) {
    console.warn('[JournalPanel] deps not initialized');
    return;
  }

  const { accounting } = deps;
  const journalList = document.getElementById('journal-list');
  if (!journalList) return;

  journalList.innerHTML = `
        <div class="journal-loading">
            <div class="loading-spinner"></div>
            <p>Chargement du journal...</p>
        </div>
    `;

  try {
    const hamletId = selectedHamletId();
    const ledger = await accounting.getGeneralLedger({
      periodDays: parsePeriodDays(period),
      types: typeFilter,
      hamletId,
      accountScope,
    });
    const hamletNames = new Map((await listHamlets()).map((hamlet) => [hamlet.id, hamlet.name]));
    const scopeLabel = hamletId === null ? 'Tous les hameaux' : hamletNames.get(hamletId);
    if (scopeLabel === undefined) {
      throw new Error(`[JournalPanel] selected hamlet ${hamletId} is not in the hamlet list`);
    }

    if (ledger.years.length === 0) {
      journalList.innerHTML = `
                <div class="no-journal-entries">
                    <div class="no-journal-entries-icon">📔</div>
                    <div class="no-journal-entries-text">Aucune écriture dans le journal</div>
                </div>
            `;
      applySearch();
      return;
    }

    journalList.innerHTML = html`${renderJournalList(ledger, accounting, hamletNames, scopeLabel)}`;
    // A search that is typed holds across a new load (a period, a hamlet, a filter changed): it is applied to the new list.
    applySearch();
  } catch (error) {
    console.error('Error loading journal entries:', error);
    journalList.innerHTML = html`
            <div class="journal-loading">
                <p>Erreur lors du chargement du journal: ${error.message}</p>
            </div>
        `;
  }
}

/** Day plus time of day (2026-09-20-163045), so several exports never overwrite each other. */
function exportStamp() {
  const now = new Date();
  return `${now.toISOString().split('T')[0]}-${now.toTimeString().slice(0, 8).replace(/:/g, '')}`;
}

/**
 * Downloads the journal as JSON: the hamlet's own account ('city'), or the flux of the companies' and the houses' accounts
 * ('private'), each in its own file so they can be read apart.
 * @param {'city' | 'private'} [accountScope]
 */
export async function exportJournalToJSON(accountScope = 'city') {
  if (!deps?.accounting) return;
  try {
    const jsonString = await deps.accounting.exportJournalJson({ accountScope });
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${accountScope === 'private' ? 'flux-prives' : 'journal'}-${exportStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Journal] Error exporting to JSON:', error);
    alert("Erreur lors de l'export JSON: " + error.message);
  }
}

export async function exportJournalToPDF() {
  if (!deps?.accounting) return;
  try {
    const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.disabled = true;
      exportPdfBtn.innerHTML = '<span>Génération...</span>';
    }

    const pdfBlob = await deps.accounting.exportJournalPdf();
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${exportStamp()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
    }
  } catch (error) {
    console.error('[Journal] Error exporting to PDF:', error);
    alert("Erreur lors de l'export PDF: " + error.message);

    const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
    }
  }
}
