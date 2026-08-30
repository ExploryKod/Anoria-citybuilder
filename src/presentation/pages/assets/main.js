import {
  buildAssetsPageSections,
  countAssetsInSections,
} from './buildAssetsPageCatalog.js';
import { renderVillageThumbnail } from './villageThumbnailRenderer.js';

const PREVIEW_HEIGHT_PX = 104;
const root = document.getElementById('assets-root');
const toastEl = document.getElementById('assets-toast');
const summaryEl = document.getElementById('assets-summary');

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

  if (item.source === 'kenney' && item.previewUrl) {
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
  body.appendChild(fieldRow('Category', item.category));

  if (item.meshAssetId) {
    body.appendChild(fieldRow('GLB mesh ID', item.meshAssetId));
  }

  if (item.proceduralOnly) {
    body.appendChild(fieldRow('Placement', 'Procedural only (no toolbar)'));
  }

  if (item.source === 'kenney') {
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

function renderPage() {
  if (!root) return;

  const sections = buildAssetsPageSections();
  const total = countAssetsInSections(sections);

  if (summaryEl) {
    summaryEl.textContent = `${total} reference assets · previews at 2× in-game toolbar size (${PREVIEW_HEIGHT_PX}px)`;
  }

  const fragment = document.createDocumentFragment();

  for (const section of sections) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'assets-section';
    sectionEl.id = `category-${section.category}`;

    const heading = document.createElement('h2');
    heading.className = 'assets-section__title';
    heading.textContent = section.label;

    const meta = document.createElement('p');
    meta.className = 'assets-section__meta';
    meta.textContent = `category: ${section.category} · ${section.items.length} assets`;

    const grid = document.createElement('div');
    grid.className = 'assets-grid';
    section.items.forEach((item) => {
      grid.appendChild(createAssetCard(item));
    });

    sectionEl.append(heading, meta, grid);
    fragment.appendChild(sectionEl);
  }

  root.appendChild(fragment);
}

renderPage();
