import {
  close as closeMobileBuildBar,
  isOpenState as isMobileBuildBarOpen,
  open as openMobileBuildBar,
} from '../tools/MobileCompactToolbar.js';

/** Blocks toolbar auto-close while dragging or right after release. */
let toolbarDragLockUntil = 0;

export function initMobileToolbar() {
  const toolbarMobileToggle = document.getElementById('toolbar-mobile-toggle');
  const mobileControlsToggle = document.getElementById('mobile-controls-toggle');
  const toolbarElement = document.getElementById('toolbar');
  const mobileControlsElement = document.getElementById('mobile-camera-controls');
  const narrowToolbarQuery = window.matchMedia('(max-width: 768px)');
  const landscapeToolbarQuery = window.matchMedia('(max-width: 1024px) and (orientation: landscape)');
  const portraitToolbarQuery = window.matchMedia('(max-width: 1024px) and (orientation: portrait)');

  const closeMobileToolbar = () => {
    if (!toolbarElement) return;
    toolbarElement.classList.remove('mobile-visible', 'toolbar--enter');
    toolbarElement.classList.add('mobile-hidden');
    delete toolbarElement.dataset.enterPlayed;
    if (toolbarMobileToggle) {
      toolbarMobileToggle.classList.remove('active');
      toolbarMobileToggle.setAttribute('aria-pressed', 'false');
      toolbarMobileToggle.setAttribute('aria-expanded', 'false');
    }
  };

  const closeMobileControls = () => {
    if (!mobileControlsElement) return;
    mobileControlsElement.classList.remove('mobile-visible');
    mobileControlsElement.classList.add('mobile-hidden');
    resetFloatingPanelDragStyles(mobileControlsElement);
    if (mobileControlsToggle) {
      mobileControlsToggle.classList.remove('active');
      mobileControlsToggle.setAttribute('aria-pressed', 'false');
    }
  };

  const isLandscapeMobile = () => landscapeToolbarQuery.matches;
  const isPortraitMobile = () => portraitToolbarQuery.matches;
  const isMobileViewport = () => narrowToolbarQuery.matches || landscapeToolbarQuery.matches || isPortraitMobile();

  const isFloatingToolbarPanel = () => {
    if (!toolbarElement) return false;
    return !toolbarElement.classList.contains('mobile-hidden');
  };

  const playToolbarEnterAnimation = () => {
    if (!toolbarElement || !isFloatingToolbarPanel()) return;
    if (toolbarElement.dataset.enterPlayed === '1') return;
    toolbarElement.dataset.enterPlayed = '1';
    toolbarElement.classList.remove('toolbar--enter');
    requestAnimationFrame(() => {
      toolbarElement.classList.add('toolbar--enter');
    });
  };

  const bindToolbarEnterAnimation = () => {
    if (!toolbarElement) return;
    toolbarElement.addEventListener('animationend', (event) => {
      if (event.animationName === 'toolbar-panel-slide-in') {
        toolbarElement.classList.remove('toolbar--enter');
      }
    });
  };

  const applyToolbarResponsiveState = () => {
    if (!toolbarElement) return;
    if (isLandscapeMobile() || isPortraitMobile()) {
      // Mobile: left toolbar stays hidden; build tools use bottom FABs + compact bar.
      resetToolbarDragStyles(toolbarElement);
      toolbarElement.classList.remove('toolbar-landscape-docked', 'mobile-visible', 'toolbar--enter');
      toolbarElement.classList.add('mobile-hidden');
      delete toolbarElement.dataset.enterPlayed;
      if (toolbarMobileToggle) {
        toolbarMobileToggle.classList.remove('active');
        toolbarMobileToggle.setAttribute('aria-pressed', 'false');
        toolbarMobileToggle.setAttribute('aria-expanded', isMobileBuildBarOpen() ? 'true' : 'false');
      }
      if (!isMobileBuildBarOpen()) {
        closeMobileBuildBar();
      }
    } else if (narrowToolbarQuery.matches) {
      toolbarElement.classList.remove('toolbar-landscape-docked');
      closeMobileBuildBar();
      if (!toolbarElement.classList.contains('mobile-visible')) {
        toolbarElement.classList.add('mobile-hidden');
        delete toolbarElement.dataset.enterPlayed;
      } else {
        playToolbarEnterAnimation();
      }
    } else {
      resetToolbarDragStyles(toolbarElement);
      toolbarElement.classList.remove('mobile-visible', 'toolbar-landscape-docked');
      toolbarElement.classList.remove('mobile-hidden');
      playToolbarEnterAnimation();
      closeMobileBuildBar();
      if (toolbarMobileToggle) {
        toolbarMobileToggle.classList.remove('active');
        toolbarMobileToggle.setAttribute('aria-pressed', 'false');
        toolbarMobileToggle.setAttribute('aria-expanded', 'false');
      }
    }
  };

  const applyMobileControlsResponsiveState = () => {
    if (!mobileControlsElement) return;
    if (isMobileViewport()) {
      if (!mobileControlsElement.classList.contains('mobile-visible')) {
        mobileControlsElement.classList.add('mobile-hidden');
      } else {
        resetFloatingPanelDragStyles(mobileControlsElement);
      }
    } else {
      mobileControlsElement.classList.remove('mobile-hidden', 'mobile-visible');
      resetFloatingPanelDragStyles(mobileControlsElement);
      if (mobileControlsToggle) {
        mobileControlsToggle.classList.remove('active');
        mobileControlsToggle.setAttribute('aria-pressed', 'false');
      }
    }
  };

  if (toolbarMobileToggle && toolbarElement) {
    toolbarMobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isMobileViewport()) return;

      // Portrait + landscape mobile: open compact construction bar (toolbar stays hidden).
      if (isPortraitMobile() || isLandscapeMobile()) {
        if (!isMobileBuildBarOpen()) {
          openMobileBuildBar();
        }
        return;
      }

      const willShow = !toolbarElement.classList.contains('mobile-visible');
      if (willShow) {
        toolbarElement.classList.remove('mobile-hidden');
        toolbarElement.classList.add('mobile-visible');
        delete toolbarElement.dataset.enterPlayed;
        playToolbarEnterAnimation();
      } else {
        closeMobileToolbar();
      }
      toolbarMobileToggle.classList.toggle('active', willShow);
      toolbarMobileToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    if (Date.now() < toolbarDragLockUntil) return;

    if (isPortraitMobile() || isLandscapeMobile()) {
      if (!isMobileBuildBarOpen()) return;
      if (!e.target.closest('#mobile-build-bar')) {
        closeMobileBuildBar();
      }
      return;
    }
    if (!toolbarElement?.classList.contains('mobile-visible') || !isMobileViewport()) return;
    if (!e.target.closest('#toolbar') && !e.target.closest('#toolbar-mobile-toggle')) {
      closeMobileToolbar();
    }
  });

  const toolbarDragHeader = document.getElementById('toolbarheader');
  if (toolbarDragHeader && toolbarElement) {
    dragElement(toolbarElement, toolbarDragHeader, {
      handleOnly: true,
      onDragStart: () => {
        toolbarDragLockUntil = Date.now() + 500;
        toolbarElement.classList.add('toolbar-is-dragging');
        toolbarElement.classList.remove('toolbar--enter');
      },
      onDragEnd: () => {
        toolbarElement.classList.remove('toolbar-is-dragging');
        toolbarDragLockUntil = Date.now() + 400;
      },
    });
  }

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

  const toolbarTabs = document.querySelectorAll('.toolbar-tab');
  const toolbarSections = document.querySelectorAll('.toolbar-section');

  if (toolbarTabs.length > 0 && toolbarSections.length > 0) {
    toolbarTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetSection = tab.getAttribute('data-tab');
        toolbarTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        toolbarSections.forEach((section) => {
          section.classList.toggle('active', section.getAttribute('data-section') === targetSection);
        });
      });
    });
  }

  if (mobileControlsToggle && mobileControlsElement) {
    mobileControlsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isMobileViewport()) return;
      const isVisible = mobileControlsElement.classList.contains('mobile-visible');
      if (isVisible) {
        closeMobileControls();
      } else {
        resetFloatingPanelDragStyles(mobileControlsElement);
        mobileControlsElement.classList.remove('mobile-hidden');
        mobileControlsElement.classList.add('mobile-visible');
        mobileControlsToggle.classList.add('active');
        mobileControlsToggle.setAttribute('aria-pressed', 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!mobileControlsElement?.classList.contains('mobile-visible') || !isMobileViewport()) return;
    if (!e.target.closest('#mobile-camera-controls') && !e.target.closest('#mobile-controls-toggle')) {
      closeMobileControls();
    }
  });

  const handleResponsiveChange = () => {
    applyToolbarResponsiveState();
    applyMobileControlsResponsiveState();
    resetPopRailDefaultPosition();
  };

  bindToolbarEnterAnimation();

  [narrowToolbarQuery, landscapeToolbarQuery, portraitToolbarQuery].forEach((mq) => {
    if (mq.addEventListener) {
      mq.addEventListener('change', handleResponsiveChange);
    } else if (mq.addListener) {
      mq.addListener(handleResponsiveChange);
    }
  });
  handleResponsiveChange();
}

/** Clear inline drag offsets and restore floating panel position. */
function resetToolbarDragStyles(elmnt) {
  if (!elmnt) return;
  elmnt.classList.remove('toolbar-is-dragged', 'toolbar-is-dragging');

  if (elmnt.id === 'toolbar' && !elmnt.classList.contains('mobile-hidden')) {
    elmnt.style.top = '';
    elmnt.style.left = '';
    elmnt.style.right = 'auto';
    elmnt.style.bottom = 'auto';
    elmnt.style.transform = '';
    elmnt.style.maxHeight = '';
    elmnt.style.overflowY = '';
    return;
  }

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

/** Keep toolbar inside the viewport after drag. */
function clampToolbarToViewport(elmnt) {
  const margin = 8;
  const rect = elmnt.getBoundingClientRect();
  const maxTop = window.innerHeight - rect.height - margin;
  const maxLeft = window.innerWidth - rect.width - margin;
  const top = Math.max(margin, Math.min(rect.top, maxTop));
  const left = Math.max(margin, Math.min(rect.left, maxLeft));
  elmnt.style.top = `${top}px`;
  elmnt.style.left = `${left}px`;
  elmnt.style.right = 'auto';
  elmnt.style.bottom = 'auto';
  elmnt.style.transform = 'none';
}

/** After drag, clamp toolbar inside viewport (no internal scroll). */
function applyDraggedToolbarScrollBounds(elmnt) {
  clampToolbarToViewport(elmnt);
  elmnt.classList.add('toolbar-is-dragged');
}

/**
 * @param {HTMLElement} elmnt
 * @param {HTMLElement} dragHeader
 * @param {{
 *   handleOnly?: boolean,
 *   applyScrollBounds?: boolean,
 *   draggedClass?: string,
 *   onDragStart?: () => void,
 *   onDragEnd?: () => void,
 * }} [options]
 */
function dragElement(elmnt, dragHeader, options = {}) {
  const {
    handleOnly = false,
    applyScrollBounds = true,
    draggedClass = 'toolbar-is-dragged',
    onDragStart = () => {},
    onDragEnd = () => {},
  } = options;

  let pos1 = 0;
  let pos2 = 0;
  let pos3 = 0;
  let pos4 = 0;
  let dragMoved = false;

  function isInteractiveElement(target) {
    if (!target) return false;
    return (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('.toolbar-btn') !== null ||
      target.closest('.toolbar__buttons') !== null ||
      target.closest('.toolbar__container') !== null ||
      target.closest('.mobile-control-btn') !== null
    );
  }

  function applyDragPosition(deltaX, deltaY) {
    dragMoved = true;
    const rect = elmnt.getBoundingClientRect();
    elmnt.style.top = `${rect.top - deltaY}px`;
    elmnt.style.left = `${rect.left - deltaX}px`;
    elmnt.style.right = 'auto';
    elmnt.style.bottom = 'auto';
    elmnt.style.transform = 'none';
    elmnt.classList.add(draggedClass);
    if (elmnt.id === 'toolbar') {
      clampToolbarToViewport(elmnt);
    }
    if (applyScrollBounds) {
      applyDraggedToolbarScrollBounds(elmnt);
    }
  }

  dragHeader.onmousedown = dragMouseDown;
  dragHeader.ontouchstart = dragTouchStart;

  if (!handleOnly) {
    elmnt.addEventListener('mousedown', (e) => {
      if (isInteractiveElement(e.target)) return;
      dragMouseDown(e);
    });

    elmnt.addEventListener('touchstart', (e) => {
      if (isInteractiveElement(e.target)) return;
      dragTouchStart(e);
    }, { passive: false });
  }

  function dragMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    dragMoved = false;
    onDragStart();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function dragTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    dragMoved = false;
    onDragStart();
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.ontouchend = closeDragElement;
    document.ontouchmove = elementDragTouch;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    applyDragPosition(pos1, pos2);
  }

  function elementDragTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    applyDragPosition(pos1, pos2);
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
    if (applyScrollBounds && dragMoved) {
      applyDraggedToolbarScrollBounds(elmnt);
    }
    onDragEnd();
  }
}
