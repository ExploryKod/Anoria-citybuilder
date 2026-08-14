import {
  close as closeMobileBuildBar,
  isOpenState as isMobileBuildBarOpen,
  open as openMobileBuildBar,
  toggle as toggleMobileBuildBar,
} from '../tools/MobileCompactToolbar.js';
import { isCameraDpadEnabled } from '../../../config/cameraDpad.js';

/** Blocks toolbar auto-close while dragging or right after release. */
let toolbarDragLockUntil = 0;

export function initMobileToolbar() {
  const toolbarMobileToggle = document.getElementById('toolbar-mobile-toggle');
  const mobileControlsToggle = document.getElementById('mobile-controls-toggle');
  const toolbarElement = document.getElementById('toolbar');
  const mobileControlsElement = document.getElementById('mobile-camera-controls');
  const cameraDpadFab = document.getElementById('camera-dpad-fab');

  const setMobileControlsInert = (inert) => {
    if (!mobileControlsElement) return;
    if (inert) {
      mobileControlsElement.setAttribute('inert', '');
      mobileControlsElement.setAttribute('aria-hidden', 'true');
    } else {
      mobileControlsElement.removeAttribute('inert');
      mobileControlsElement.setAttribute('aria-hidden', 'false');
    }
  };

  const closeMobileControls = () => {
    if (!mobileControlsElement) return;
    mobileControlsElement.classList.remove('mobile-visible');
    mobileControlsElement.classList.add('mobile-hidden');
    setMobileControlsInert(true);
    resetFloatingPanelDragStyles(mobileControlsElement);
    if (mobileControlsToggle) {
      mobileControlsToggle.classList.remove('active');
      mobileControlsToggle.setAttribute('aria-pressed', 'false');
    }
  };

  /** Keep left toolbar stubs permanently hidden (construction uses build bar). */
  const applyToolbarResponsiveState = () => {
    if (!toolbarElement) return;
    resetToolbarDragStyles(toolbarElement);
    toolbarElement.classList.remove('toolbar-landscape-docked', 'mobile-visible', 'toolbar--enter');
    toolbarElement.classList.add('mobile-hidden');
    toolbarElement.setAttribute('hidden', '');
    toolbarElement.setAttribute('aria-hidden', 'true');
    delete toolbarElement.dataset.enterPlayed;
  };

  const applyCameraDpadVisibility = () => {
    const enabled = isCameraDpadEnabled();
    if (cameraDpadFab) {
      cameraDpadFab.classList.toggle('camera-dpad-fab--visible', enabled);
      cameraDpadFab.hidden = !enabled;
      cameraDpadFab.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    }
    if (!enabled) {
      closeMobileControls();
    }
  };

  const applyMobileControlsResponsiveState = () => {
    if (!mobileControlsElement) return;
    if (!isCameraDpadEnabled()) {
      mobileControlsElement.classList.remove('mobile-visible');
      mobileControlsElement.classList.add('mobile-hidden');
      setMobileControlsInert(true);
      resetFloatingPanelDragStyles(mobileControlsElement);
      if (mobileControlsToggle) {
        mobileControlsToggle.classList.remove('active');
        mobileControlsToggle.setAttribute('aria-pressed', 'false');
      }
      return;
    }
    if (!mobileControlsElement.classList.contains('mobile-visible')) {
      mobileControlsElement.classList.add('mobile-hidden');
      setMobileControlsInert(true);
    } else {
      setMobileControlsInert(false);
      resetFloatingPanelDragStyles(mobileControlsElement);
    }
  };

  if (toolbarMobileToggle) {
    toolbarMobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Always open compact construction bar (left toolbar is retired).
      if (!isMobileBuildBarOpen()) {
        openMobileBuildBar();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (Date.now() < toolbarDragLockUntil) return;
    if (!isMobileBuildBarOpen()) return;
    // Keep FABs usable; only dismiss when clicking outside bar + construction FABs.
    if (
      !e.target.closest('#mobile-build-bar')
      && !e.target.closest('.legend-btns-container--mobile')
    ) {
      closeMobileBuildBar();
    }
  });

  const cameraDragHeader = document.getElementById('mobile-camera-drag-handle');
  if (cameraDragHeader && mobileControlsElement) {
    dragElement(mobileControlsElement, cameraDragHeader, {
      handleOnly: true,
      applyScrollBounds: false,
      draggedClass: 'mobile-camera-controls--dragged',
    });
  }

  const popRailElement = document.getElementById('hud-pop-rail');
  const popRailDragHandle = document.getElementById('hud-pop-rail-drag');
  if (popRailElement && popRailDragHandle) {
    dragElement(popRailElement, popRailDragHandle, {
      handleOnly: true,
      applyScrollBounds: false,
      draggedClass: 'hud-pop-rail--dragged',
    });
  }

  if (mobileControlsToggle && mobileControlsElement) {
    mobileControlsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isCameraDpadEnabled()) return;
      const isVisible = mobileControlsElement.classList.contains('mobile-visible');
      if (isVisible) {
        closeMobileControls();
      } else {
        resetFloatingPanelDragStyles(mobileControlsElement);
        mobileControlsElement.classList.remove('mobile-hidden');
        mobileControlsElement.classList.add('mobile-visible');
        setMobileControlsInert(false);
        mobileControlsToggle.classList.add('active');
        mobileControlsToggle.setAttribute('aria-pressed', 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!mobileControlsElement?.classList.contains('mobile-visible')) return;
    if (!isCameraDpadEnabled()) return;
    if (!e.target.closest('#mobile-camera-controls') && !e.target.closest('#mobile-controls-toggle')) {
      closeMobileControls();
    }
  });

  window.addEventListener('anoria:camera-dpad-change', () => {
    applyCameraDpadVisibility();
    applyMobileControlsResponsiveState();
  });

  const handleResponsiveChange = () => {
    applyToolbarResponsiveState();
    applyCameraDpadVisibility();
    applyMobileControlsResponsiveState();
    resetPopRailDefaultPosition();
  };

  handleResponsiveChange();
}

/** Clear inline drag offsets and restore floating panel position. */
function resetToolbarDragStyles(elmnt) {
  if (!elmnt) return;
  elmnt.classList.remove('toolbar-is-dragged', 'toolbar-is-dragging');
  elmnt.style.top = '';
  elmnt.style.left = '';
  elmnt.style.right = '';
  elmnt.style.transform = '';
  elmnt.style.bottom = '';
  elmnt.style.maxHeight = '';
  elmnt.style.overflowY = '';
}

/** Restore pop rail default anchor unless user has dragged it. */
function resetPopRailDefaultPosition() {
  const popRail = document.getElementById('hud-pop-rail');
  if (!popRail || popRail.classList.contains('hud-pop-rail--dragged')) return;
  popRail.style.top = '';
  popRail.style.left = '';
  popRail.style.right = '';
  popRail.style.bottom = '';
  popRail.style.transform = '';
}

/** Reset floating panel (camera) to CSS default position (center-left). */
function resetFloatingPanelDragStyles(elmnt) {
  if (!elmnt) return;
  elmnt.style.top = '';
  elmnt.style.left = '';
  elmnt.style.right = '';
  elmnt.style.bottom = '';
  elmnt.style.transform = '';
  elmnt.classList.remove('mobile-camera-controls--dragged', 'toolbar-is-dragged', 'toolbar-is-dragging', 'hud-pop-rail--dragged');
}

/**
 * Make an element draggable (optional handle-only).
 * @param {HTMLElement} elmnt
 * @param {HTMLElement} [header]
 * @param {{
 *   handleOnly?: boolean,
 *   applyScrollBounds?: boolean,
 *   draggedClass?: string,
 *   onDragStart?: () => void,
 *   onDragEnd?: () => void,
 * }} [options]
 */
function dragElement(elmnt, header, options = {}) {
  const {
    handleOnly = false,
    applyScrollBounds = true,
    draggedClass = 'toolbar-is-dragged',
    onDragStart,
    onDragEnd,
  } = options;

  let pos1 = 0;
  let pos2 = 0;
  let pos3 = 0;
  let pos4 = 0;
  let activePointerId = null;

  const dragHandle = header || elmnt;
  if (handleOnly && !header) return;

  dragHandle.onpointerdown = dragMouseDown;

  function dragMouseDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerId = e.pointerId;
    pos3 = e.clientX;
    pos4 = e.clientY;
    toolbarDragLockUntil = Date.now() + 500;
    elmnt.classList.add(draggedClass);
    onDragStart?.();
    try {
      dragHandle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.onpointerup = closeDragElement;
    document.onpointercancel = closeDragElement;
    document.onpointermove = elementDrag;
  }

  function elementDrag(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    const rect = elmnt.getBoundingClientRect();
    let newTop = rect.top - pos2;
    let newLeft = rect.left - pos1;

    if (applyScrollBounds) {
      const margin = 8;
      const maxTop = window.innerHeight - rect.height - margin;
      const maxLeft = window.innerWidth - rect.width - margin;
      newTop = Math.max(margin, Math.min(newTop, maxTop));
      newLeft = Math.max(margin, Math.min(newLeft, maxLeft));
    }

    elmnt.style.top = `${newTop}px`;
    elmnt.style.left = `${newLeft}px`;
    elmnt.style.right = 'auto';
    elmnt.style.bottom = 'auto';
    elmnt.style.transform = 'none';
  }

  function closeDragElement(e) {
    if (activePointerId !== null && e?.pointerId !== undefined && e.pointerId !== activePointerId) {
      return;
    }
    activePointerId = null;
    document.onpointerup = null;
    document.onpointercancel = null;
    document.onpointermove = null;
    toolbarDragLockUntil = Date.now() + 400;
    onDragEnd?.();
  }
}

export { toggleMobileBuildBar };
