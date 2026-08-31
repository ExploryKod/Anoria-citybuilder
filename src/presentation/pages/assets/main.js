import {
  buildAssetsPageSections,
  countAssetsInSections,
} from './buildAssetsPageCatalog.js';
import {
  ASSETS_PAGE_FILTERS,
  countAssetsByFilter,
  sectionMatchesFilter,
} from './assetsPageFilters.js';
import { renderVillageThumbnail } from './villageThumbnailRenderer.js';

const PREVIEW_HEIGHT_PX = 104;
const root = document.getElementById('assets-root');
const toastEl = document.getElementById('assets-toast');
const summaryEl = document.getElementById('assets-summary');
const filtersEl = document.getElementById('assets-filters');

/** @type {import('./assetsPageFilters.js').AssetsPageFilterId} */
let activeFilter = 'all';

/** @type {number | null} */
let toastTimer = null;

/**
 * @param {string} message
 */
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, 1600);
}

/**
 * @param {string} text
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied: ${text}`);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (ok) showToast(`Copied: ${text}`);
    return ok;
  }
}

/**
 * @param {string} label
 * @param {string} value
 */
function fieldRow(label, value) {
  const row = document.createElement('p');
  row.className = 'asset-card__field';

  const labelEl = document.createElement('span');
  labelEl.className = 'asset-card__label';
  labelEl.textContent = label;

  const valueEl = document.createElement('code');
  valueEl.className = 'asset-card__value';
  valueEl.textContent = value;
  valueEl.title = 'Click to copy';
  valueEl.tabIndex = 0;
  valueEl.addEventListener('click', () => {
    copyText(value).then((ok) => {
      if (ok) {
        valueEl.classList.add('asset-card__value--copied');
        window.setTimeout(() => valueEl.classList.remove('asset-card__value--copied'), 900);
      }
    });
  });
  valueEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      valueEl.click();
    }
  });

  row.append(labelEl, valueEl);
  return row;
}

/**
 * @param {ReturnType<typeof buildAssetsPageSections>[number]['items'][number]} item
 */
function createAssetCard(item) {
  const card = document.createElement('article');
  card.className = `asset-card asset-card--${item.source}`;

  const previewWrap = document.createElement('div');
  previewWrap.className = 'asset-card__preview-wrap';

  if (item.previewUrl) {
    const img = document.createElement('img');
    img.className = 'asset-card__preview';
    img.src = item.previewUrl;
    img.alt = item.displayName || item.id;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = true;
    previewWrap.appendChild(img);
  } else {
    const canvas = document.createElement('canvas');
    canvas.className = 'asset-card__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', item.displayName || item.id);
    previewWrap.appendChild(canvas);
    renderVillageThumbnail(item.id, canvas, PREVIEW_HEIGHT_PX).catch(() => {});
  }

  const body = document.createElement('div');
  body.className = 'asset-card__body';

  if (item.displayName && item.displayName !== item.id) {
    const title = document.createElement('p');
    title.className = 'asset-card__display-name';
    title.textContent = item.displayName;
    body.appendChild(title);
  }

  body.appendChild(fieldRow('Game ID', item.id));

  if (item.glbName) {
    body.appendChild(fieldRow('GLB name', item.glbName));
  }

  if (item.categoryId) {
    body.appendChild(fieldRow('Section', item.categoryId));
  } else if (item.category) {
    body.appendChild(fieldRow('Category', item.category));
  }

  if (item.meshAssetId) {
    body.appendChild(fieldRow('GLB mesh ID', item.meshAssetId));
  }

  if (item.proceduralOnly) {
    body.appendChild(fieldRow('Placement', 'Procedural only (no toolbar)'));
  }

  if (item.source === 'kenney-city' || item.source === 'kenney-nature') {
    if (item.kenneyPrefabKey) {
      body.appendChild(fieldRow('Kenney prefab', item.kenneyPrefabKey));
    }
    if (item.kenneyGlbFile) {
      body.appendChild(fieldRow('Kenney GLB file', item.kenneyGlbFile));
    }
    if (item.kenneyGlbPath) {
      body.appendChild(fieldRow('GLB path', item.kenneyGlbPath));
    }
    if (item.kitId) {
      body.appendChild(fieldRow('Kit', item.kitId));
    }
  }

  card.append(previewWrap, body);
  return card;
}

/**
 * @param {ReturnType<typeof buildAssetsPageSections>} sections
 */
function renderFilters(sections) {
  if (!filtersEl) return;

  const counts = countAssetsByFilter(sections);
  filtersEl.innerHTML = '';

  for (const filter of ASSETS_PAGE_FILTERS) {
    if (filter.id !== 'all' && counts[filter.id] === 0) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'assets-filter-pill';
    button.dataset.filter = filter.id;
    button.setAttribute('aria-pressed', filter.id === activeFilter ? 'true' : 'false');
    if (filter.id === activeFilter) {
      button.classList.add('is-active');
    }

    const label = document.createElement('span');
    label.className = 'assets-filter-pill__label';
    label.textContent = filter.label;

    const count = document.createElement('span');
    count.className = 'assets-filter-pill__count';
    count.textContent = String(counts[filter.id]);

    button.append(label, count);
    button.addEventListener('click', () => {
      activeFilter = filter.id;
      renderPage();
    });

    filtersEl.appendChild(button);
  }
}

/**
 * @param {ReturnType<typeof buildAssetsPageSections>} sections
 */
function renderPageContent(sections) {
  if (!root) return;

  root.innerHTML = '';
  const visibleSections = sections.filter((section) => sectionMatchesFilter(activeFilter, section));

  if (visibleSections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'assets-empty';
    empty.textContent = 'Aucun asset dans cette catégorie.';
    root.appendChild(empty);
    return;
  }

  let currentPackId = null;

  for (const section of visibleSections) {
    if (section.packId !== currentPackId) {
      currentPackId = section.packId;

      const packHeader = document.createElement('header');
      packHeader.className = 'assets-pack';

      const packTitle = document.createElement('h2');
      packTitle.className = 'assets-pack__title';
      packTitle.textContent = section.packLabel;

      const packSections = visibleSections.filter((entry) => entry.packId === section.packId);
      const packCount = packSections.reduce((sum, entry) => sum + entry.items.length, 0);

      const packMeta = document.createElement('p');
      packMeta.className = 'assets-pack__meta';
      packMeta.textContent = `${packCount} assets · ${packSections.length} sections`;

      packHeader.append(packTitle, packMeta);
      root.appendChild(packHeader);
    }

    const sectionEl = document.createElement('section');
    sectionEl.className = 'assets-section';
    sectionEl.id = `${section.packId}-${section.sectionId}`;

    const heading = document.createElement('h3');
    heading.className = 'assets-section__title';
    heading.textContent = section.sectionLabel;

    const meta = document.createElement('p');
    meta.className = 'assets-section__meta';
    meta.textContent = `${section.sectionId} · ${section.items.length} assets · ${section.filterGroup}`;

    const grid = document.createElement('div');
    grid.className = 'assets-grid';
    section.items.forEach((item) => {
      grid.appendChild(createAssetCard(item));
    });

    sectionEl.append(heading, meta, grid);
    root.appendChild(sectionEl);
  }
}

function renderPage() {
  const sections = buildAssetsPageSections();
  const total = countAssetsInSections(sections);
  const visibleCount = activeFilter === 'all'
    ? total
    : countAssetsByFilter(sections)[activeFilter];

  if (summaryEl) {
    summaryEl.textContent = `${visibleCount} assets affichés${activeFilter !== 'all' ? ` (${total} au total)` : ''} · previews Isometric NE à ${PREVIEW_HEIGHT_PX}px (2× barre d’outils)`;
  }

  renderFilters(sections);
  renderPageContent(sections);
}

renderPage();
