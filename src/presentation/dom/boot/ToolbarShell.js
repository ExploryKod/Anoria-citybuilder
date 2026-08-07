import {
  close as closeMobileBuildBar,
  isOpenState as isMobileBuildBarOpen,
  toggle as toggleMobileBuildBar,
} from '../tools/MobileCompactToolbar.js';

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
    toolbarElement.classList.remove('mobile-visible');
    toolbarElement.classList.add('mobile-hidden');
    if (toolbarMobileToggle) {
      toolbarMobileToggle.classList.remove('active');
      toolbarMobileToggle.setAttribute('aria-pressed', 'false');
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

  const applyToolbarResponsiveState = () => {
    if (!toolbarElement) return;
    if (isLandscapeMobile()) {
      resetToolbarDragStyles(toolbarElement);
      toolbarElement.classList.remove('mobile-hidden');
      toolbarElement.classList.add('mobile-visible', 'toolbar-landscape-docked');
      closeMobileBuildBar();
      if (toolbarMobileToggle) {
        toolbarMobileToggle.classList.remove('active');
        toolbarMobileToggle.setAttribute('aria-pressed', 'false');
      }
    } else if (isPortraitMobile()) {
      toolbarElement.classList.remove('toolbar-landscape-docked', 'mobile-visible');
      toolbarElement.classList.add('mobile-hidden');
      if (!isMobileBuildBarOpen()) {
        closeMobileBuildBar();
      }
    } else if (narrowToolbarQuery.matches) {
      toolbarElement.classList.remove('toolbar-landscape-docked');
      closeMobileBuildBar();
      if (!toolbarElement.classList.contains('mobile-visible')) {
        toolbarElement.classList.add('mobile-hidden');
      }
    } else {
      resetToolbarDragStyles(toolbarElement);
      toolbarElement.classList.remove('mobile-hidden', 'mobile-visible', 'toolbar-landscape-docked');
      closeMobileBuildBar();
      if (toolbarMobileToggle) {
        toolbarMobileToggle.classList.remove('active');
        toolbarMobileToggle.setAttribute('aria-pressed', 'false');
      }
    }
  };

  const applyMobileControlsResponsiveState = () => {
    if (!mobileControlsElement) return;
    if (isMobileViewport()) {
      if (!mobileControlsElement.classList.contains('mobile-visible')) {
        mobileControlsElement.classList.add('mobile-hidden');
      } else {
        // Re-anchor to center-left after orientation change
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

      if (isPortraitMobile()) {
        const willShow = toggleMobileBuildBar();
        toolbarMobileToggle.classList.toggle('active', willShow);
        toolbarMobileToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
        return;
      }

      if (isLandscapeMobile()) return;

      const willShow = !toolbarElement.classList.contains('mobile-visible');
      if (willShow) {
        toolbarElement.classList.add('mobile-visible');
        toolbarElement.classList.remove('mobile-hidden');
      } else {
        closeMobileToolbar();
      }
      toolbarMobileToggle.classList.toggle('active', willShow);
      toolbarMobileToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    if (isPortraitMobile()) {
      if (!isMobileBuildBarOpen()) return;
      if (!e.target.closest('#mobile-build-bar') && !e.target.closest('#toolbar-mobile-toggle')) {
        closeMobileBuildBar();
        toolbarMobileToggle?.classList.remove('active');
        toolbarMobileToggle?.setAttribute('aria-pressed', 'false');
      }
      return;
    }
    if (isLandscapeMobile()) return;
    if (!toolbarElement?.classList.contains('mobile-visible') || !isMobileViewport()) return;
    if (!e.target.closest('#toolbar') && !e.target.closest('#toolbar-mobile-toggle')) {
      closeMobileToolbar();
    }
  });

  const toolbarDragHeader = document.getElementById('toolbarheader');
  if (toolbarDragHeader && toolbarElement) {
    dragElement(toolbarElement, toolbarDragHeader);
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
  };

  [narrowToolbarQuery, landscapeToolbarQuery, portraitToolbarQuery].forEach((mq) => {
    if (mq.addEventListener) {
      mq.addEventListener('change', handleResponsiveChange);
    } else if (mq.addListener) {
      mq.addListener(handleResponsiveChange);
    }
  });
  handleResponsiveChange();
}

/** Clear inline drag offsets and restore docked scroll bounds. */
function resetToolbarDragStyles(elmnt) {
  if (!elmnt) return;
  elmnt.style.top = '';
  elmnt.style.left = '';
  elmnt.style.right = '';
  elmnt.style.transform = '';
  elmnt.style.bottom = '';
  elmnt.style.maxHeight = '';
  elmnt.style.overflowY = '';
  elmnt.classList.remove('toolbar-is-dragged');
}

/** Reset floating panel (camera) to CSS default position (center-left). */
function resetFloatingPanelDragStyles(elmnt) {
  if (!elmnt) return;
  elmnt.style.top = '';
  elmnt.style.left = '';
  elmnt.style.right = '';
  elmnt.style.bottom = '';
  elmnt.style.transform = '';
  elmnt.classList.remove('mobile-camera-controls--dragged', 'toolbar-is-dragged', 'hud-pop-rail--dragged');
}

/** After drag, keep a viewport-bounded height so overflow-y scroll still works. */
function applyDraggedToolbarScrollBounds(elmnt) {
  if (!elmnt) return;
  const rect = elmnt.getBoundingClientRect();
  const top = Math.max(0, rect.top);
  const maxHeight = window.innerHeight - top;
  elmnt.style.maxHeight = `${Math.max(160, maxHeight)}px`;
  elmnt.style.overflowY = 'auto';
  elmnt.classList.add('toolbar-is-dragged');
}

/**
 * @param {HTMLElement} elmnt
 * @param {HTMLElement} dragHeader
 * @param {{
 *   handleOnly?: boolean,
 *   applyScrollBounds?: boolean,
 *   draggedClass?: string,
 * }} [options]
 */
function dragElement(elmnt, dragHeader, options = {}) {
  const {
    handleOnly = false,
    applyScrollBounds = true,
    draggedClass = 'toolbar-is-dragged',
  } = options;

  let pos1 = 0;
  let pos2 = 0;
  let pos3 = 0;
  let pos4 = 0;

  const isDockedLandscape = () => elmnt.classList.contains('toolbar-landscape-docked');

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
    const rect = elmnt.getBoundingClientRect();
    elmnt.style.top = `${rect.top - deltaY}px`;
    elmnt.style.left = `${rect.left - deltaX}px`;
    elmnt.style.right = 'auto';
    elmnt.style.bottom = 'auto';
    elmnt.style.transform = 'none';
    elmnt.classList.add(draggedClass);
    if (applyScrollBounds) {
      applyDraggedToolbarScrollBounds(elmnt);
    }
  }

  dragHeader.onmousedown = dragMouseDown;
  dragHeader.ontouchstart = dragTouchStart;

  // Body drag: disabled when handleOnly or docked landscape
  elmnt.addEventListener('mousedown', (e) => {
    if (handleOnly || isDockedLandscape() || isInteractiveElement(e.target)) return;
    dragMouseDown(e);
  });

  elmnt.addEventListener('touchstart', (e) => {
    if (handleOnly || isDockedLandscape() || isInteractiveElement(e.target)) return;
    dragTouchStart(e);
  }, { passive: false });

  function dragMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function dragTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
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
    if (applyScrollBounds) {
      applyDraggedToolbarScrollBounds(elmnt);
    }
  }
}
