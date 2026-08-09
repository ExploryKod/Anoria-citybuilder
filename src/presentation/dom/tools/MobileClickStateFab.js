/** Portrait FABs for click modes (bulldoze / select) — always visible, not part of construction modal. */

/**
 * @param {string} toolId
 */
export function syncMobileClickStateFab(toolId) {
  document.querySelectorAll('.mobile-click-state-btn').forEach((btn) => {
    const active = btn.dataset.toolid === toolId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const bulldozeBtn = document.getElementById('bulldoze-btn');
  const selectBtn = document.getElementById('select-btn');
  if (bulldozeBtn) {
    bulldozeBtn.classList.toggle('selected', toolId === 'bulldoze');
  }
  if (selectBtn) {
    selectBtn.classList.toggle('selected', toolId === 'select-object');
  }
}

/**
 * @param {{ invokeSetActiveTool?: (e: Event) => void }} deps
 */
export function initMobileClickStateFab(deps = {}) {
  const { invokeSetActiveTool = () => {} } = deps;
  const buttons = document.querySelectorAll('.mobile-click-state-btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      invokeSetActiveTool(e);
    });
  });

  const initialToolId = document.getElementById('select-btn')?.classList.contains('selected')
    ? 'select-object'
    : document.getElementById('bulldoze-btn')?.classList.contains('selected')
      ? 'bulldoze'
      : 'select-object';
  syncMobileClickStateFab(initialToolId);
}
