export function initToolbarDropdowns() {
  const legendToggle = document.getElementById('legend-toggle');
  const legendDropdown = document.getElementById('legend-dropdown');
  const commandToggle = document.getElementById('command-toggle');
  const commandDropdown = document.getElementById('command-dropdown');
  const financeToggle = document.getElementById('finance-toggle');
  const financeDropdown = document.getElementById('finance-dropdown');

  if (legendToggle && legendDropdown) {
    legendToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyHidden = legendDropdown.classList.contains('hidden');
      commandDropdown?.classList.add('hidden');
      financeDropdown?.classList.add('hidden');
      legendDropdown.classList.toggle('hidden', !isCurrentlyHidden);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.legend-dropdown-container')) {
        legendDropdown.classList.add('hidden');
      }
    });
  }

  if (financeToggle && financeDropdown) {
    financeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyHidden = financeDropdown.classList.contains('hidden');
      legendDropdown?.classList.add('hidden');
      commandDropdown?.classList.add('hidden');
      financeDropdown.classList.toggle('hidden', !isCurrentlyHidden);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.finance-dropdown-container')) {
        financeDropdown.classList.add('hidden');
      }
    });
  }

  if (commandToggle && commandDropdown) {
    commandToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyHidden = commandDropdown.classList.contains('hidden');
      legendDropdown?.classList.add('hidden');
      financeDropdown?.classList.add('hidden');
      commandDropdown.classList.toggle('hidden', !isCurrentlyHidden);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.command-dropdown-container')) {
        commandDropdown.classList.add('hidden');
      }
    });
  }
}

export function initMobileToolbar() {
  const toolbarMobileToggle = document.getElementById('toolbar-mobile-toggle');
  const mobileControlsToggle = document.getElementById('mobile-controls-toggle');
  const toolbarElement = document.getElementById('toolbar');
  const mobileControlsElement = document.getElementById('mobile-camera-controls');
  const narrowToolbarQuery = window.matchMedia('(max-width: 768px)');
  const landscapeToolbarQuery = window.matchMedia('(max-width: 1024px) and (orientation: landscape)');

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
    if (mobileControlsToggle) {
      mobileControlsToggle.classList.remove('active');
      mobileControlsToggle.setAttribute('aria-pressed', 'false');
    }
  };

  const isMobileViewport = () => narrowToolbarQuery.matches || landscapeToolbarQuery.matches;

  const applyToolbarResponsiveState = () => {
    if (!toolbarElement) return;
    if (isMobileViewport()) {
      if (!toolbarElement.classList.contains('mobile-visible')) {
        toolbarElement.classList.add('mobile-hidden');
      }
    } else {
      toolbarElement.classList.remove('mobile-hidden', 'mobile-visible');
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
      }
    } else {
      mobileControlsElement.classList.remove('mobile-hidden', 'mobile-visible');
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
    if (!toolbarElement?.classList.contains('mobile-visible') || !isMobileViewport()) return;
    if (!e.target.closest('#toolbar') && !e.target.closest('#toolbar-mobile-toggle')) {
      closeMobileToolbar();
    }
  });

  const toolbarDragHeader = document.getElementById('toolbarheader');
  if (toolbarDragHeader && toolbarElement) {
    dragElement(toolbarElement, toolbarDragHeader);
  }

  const toolbarTabs = document.querySelectorAll('.toolbar-tab');
  const toolbarSections = document.querySelectorAll('.toolbar-section');
  const legendDropdown = document.getElementById('legend-dropdown');
  const financeDropdown = document.getElementById('finance-dropdown');
  const commandDropdown = document.getElementById('command-dropdown');

  const closeLegendDropdowns = () => {
    legendDropdown?.classList.add('hidden');
    financeDropdown?.classList.add('hidden');
    commandDropdown?.classList.add('hidden');
  };

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
        if (targetSection !== 'legends') {
          closeLegendDropdowns();
        }
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

  [narrowToolbarQuery, landscapeToolbarQuery].forEach((mq) => {
    if (mq.addEventListener) {
      mq.addEventListener('change', handleResponsiveChange);
    } else if (mq.addListener) {
      mq.addListener(handleResponsiveChange);
    }
  });
  handleResponsiveChange();
}

function dragElement(elmnt, toolbarDragHeader) {
  let pos1 = 0;
  let pos2 = 0;
  let pos3 = 0;
  let pos4 = 0;

  function isInteractiveElement(target) {
    if (!target) return false;
    return (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('.toolbar-btn') !== null ||
      target.closest('.toolbar__buttons') !== null ||
      target.closest('.toolbar__container') !== null
    );
  }

  toolbarDragHeader.onmousedown = dragMouseDown;
  toolbarDragHeader.ontouchstart = dragTouchStart;

  elmnt.addEventListener('mousedown', (e) => {
    if (isInteractiveElement(e.target)) return;
    dragMouseDown(e);
  });

  elmnt.addEventListener('touchstart', (e) => {
    if (isInteractiveElement(e.target)) return;
    dragTouchStart(e);
  });

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
    const rect = elmnt.getBoundingClientRect();
    elmnt.style.top = `${rect.top - pos2}px`;
    elmnt.style.left = `${rect.left - pos1}px`;
    elmnt.style.transform = 'none';
    elmnt.style.bottom = 'auto';
  }

  function elementDragTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    const rect = elmnt.getBoundingClientRect();
    elmnt.style.top = `${rect.top - pos2}px`;
    elmnt.style.left = `${rect.left - pos1}px`;
    elmnt.style.transform = 'none';
    elmnt.style.bottom = 'auto';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}
