import { KENNEY_CITY_KIT_TOOL_META } from '../../three/adapters/kenney-city-kit/kenneyCityKitConfig.js';
import { EDITOR_TOOL_PREVIEW_URLS } from '../../../shared/editor-catalog/editorKenneyCatalog.js';

/** @type {HTMLElement | null} */
let overlayEl = null;

/** @type {HTMLImageElement | null} */
let imageEl = null;

/** @type {string | null} */
let visibleToolId = null;

const EXTRA_PREVIEW_URLS = Object.freeze({
  'Windmill-001': '/icons/windmill.png',
});

/**
 * Kenney city-kit carousel PNGs are 64×64 — show them larger with smooth HTML scaling.
 * Nature / editor isometric PNGs are 512×512 — keep the preview modest.
 *
 * @param {string} toolId
 * @returns {'city-kit' | 'high-res'}
 */
export function resolveToolPreviewProfile(toolId) {
  if (KENNEY_CITY_KIT_TOOL_META[toolId]?.previewUrl) {
    return 'city-kit';
  }
  return 'high-res';
}

const PREVIEW_PROFILE_CLASSNAMES = Object.freeze([
  'build-tool-hover-preview--city-kit',
  'build-tool-hover-preview--high-res',
]);

/**
 * @param {string} toolId
 */
function applyPreviewProfile(toolId) {
  if (!overlayEl) return;
  const profile = resolveToolPreviewProfile(toolId);
  for (const className of PREVIEW_PROFILE_CLASSNAMES) {
    overlayEl.classList.remove(className);
  }
  overlayEl.classList.add(`build-tool-hover-preview--${profile}`);
}

/**
 * @param {string} toolId
 * @returns {string | null}
 */
export function resolveToolPreviewUrl(toolId) {
  return (
    EDITOR_TOOL_PREVIEW_URLS[toolId]
    ?? KENNEY_CITY_KIT_TOOL_META[toolId]?.previewUrl
    ?? EXTRA_PREVIEW_URLS[toolId]
    ?? null
  );
}

export function initBuildToolHoverPreview() {
  if (overlayEl) return;

  overlayEl = document.getElementById('build-tool-hover-preview');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'build-tool-hover-preview';
    overlayEl.className = 'build-tool-hover-preview';
    overlayEl.hidden = true;
    overlayEl.setAttribute('aria-hidden', 'true');

    const frame = document.createElement('div');
    frame.className = 'build-tool-hover-preview__frame';

    imageEl = document.createElement('img');
    imageEl.className = 'build-tool-hover-preview__img';
    imageEl.alt = '';
    imageEl.decoding = 'async';
    frame.appendChild(imageEl);
    overlayEl.appendChild(frame);
    document.body.appendChild(overlayEl);
  } else {
    imageEl = overlayEl.querySelector('.build-tool-hover-preview__img');
  }

  window.addEventListener('anoria:mobile-build-bar-change', (event) => {
    if (!event.detail?.open) {
      hideBuildToolHoverPreview();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hideBuildToolHoverPreview();
    }
  });
}

/**
 * @param {string} toolId
 * @param {string} previewUrl
 */
function showBuildToolHoverPreview(toolId, previewUrl) {
  if (!overlayEl || !imageEl) return;

  applyPreviewProfile(toolId);

  if (visibleToolId === toolId && imageEl.getAttribute('src') === previewUrl) {
    overlayEl.hidden = false;
    overlayEl.classList.add('build-tool-hover-preview--visible');
    overlayEl.setAttribute('aria-hidden', 'false');
    return;
  }

  visibleToolId = toolId;
  imageEl.src = previewUrl;
  overlayEl.hidden = false;
  overlayEl.classList.add('build-tool-hover-preview--visible');
  overlayEl.setAttribute('aria-hidden', 'false');
}

export function hideBuildToolHoverPreview() {
  if (!overlayEl) return;
  visibleToolId = null;
  overlayEl.hidden = true;
  overlayEl.classList.remove('build-tool-hover-preview--visible');
  for (const className of PREVIEW_PROFILE_CLASSNAMES) {
    overlayEl.classList.remove(className);
  }
  overlayEl.setAttribute('aria-hidden', 'true');
}

/**
 * Large isometric preview while hovering a build-carousel tool (hidden on select).
 * Desktop: hover/focus shows preview; mouse click hides it.
 * Touch: press-and-hold on the carousel icon shows preview until the finger lifts.
 *
 * @param {HTMLButtonElement} button
 * @param {string} toolId
 */
export function attachBuildToolHoverPreview(button, toolId) {
  const previewUrl = resolveToolPreviewUrl(toolId);
  if (!previewUrl) return;

  const show = () => {
    showBuildToolHoverPreview(toolId, previewUrl);
  };

  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    show();
  });

  button.addEventListener('pointerleave', () => {
    hideBuildToolHoverPreview();
  });

  button.addEventListener('focus', show);

  button.addEventListener('blur', () => {
    hideBuildToolHoverPreview();
  });

  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      show();
      return;
    }
    hideBuildToolHoverPreview();
  });

  button.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') {
      hideBuildToolHoverPreview();
    }
  });

  button.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'touch') {
      hideBuildToolHoverPreview();
    }
  });
}
