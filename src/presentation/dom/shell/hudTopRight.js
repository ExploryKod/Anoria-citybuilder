/**
 * Touch HUD, top-right corner: three buttons one under the other (date, funds, camera). Each opens, to its left, the panel the desktop HUD
 * shows all the time: the date and season, the exact funds, the rotation and view buttons. The panels are independent: any can be open.
 */

const PANELS = ['date', 'funds', 'camera'];

export function initHudTopRight() {
  const root = document.querySelector('.hud-bar__end');
  const stack = document.querySelector('.hud-top-right');
  const buttons = [...document.querySelectorAll('.hud-top-right [data-panel]')];
  if (!root || !stack || buttons.length !== PANELS.length) {
    throw new Error('hudTopRight: .hud-bar__end, .hud-top-right or its three [data-panel] buttons are missing from game.html');
  }
  if (root.dataset.hudTopRightReady === 'true') return;
  root.dataset.hudTopRightReady = 'true';

  for (const button of buttons) {
    const panel = button.dataset.panel;
    if (!PANELS.includes(panel)) throw new Error(`hudTopRight: unknown panel "${panel}"`);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle(`hud-top-right--${panel}-open`, open);
    });
  }

  // The column of tools below hangs from the bottom of this stack, wherever the HUD puts the stack (safe area, hamlet pill, progress bar).
  const placeToolsUnderStack = () => {
    const bottom = stack.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--hud-side-actions-top-touch', `${Math.ceil(bottom) + 8}px`);
  };
  placeToolsUnderStack();
  new ResizeObserver(placeToolsUnderStack).observe(stack);
  window.addEventListener('resize', placeToolsUnderStack);

  fitSideActionsColumns(stack);
}

const TOOLS_GAP = 6;

/**
 * The column of tools is a grid (hud.css): as many rows as fit between the top-right stack and the bottom chrome, then another column to the
 * left of the first. Sets `--hud-side-actions-rows`, and `--hud-side-actions-width` so that the flyouts the tools open (gestion, map filters)
 * stay clear of every column.
 * @param {HTMLElement} stack
 */
function fitSideActionsColumns(stack) {
  const tools = document.querySelector('.hud-side-actions');
  const toggle = document.getElementById('hud-side-actions-toggle');
  if (!tools || !toggle) throw new Error('hudTopRight: .hud-side-actions or #hud-side-actions-toggle is missing from game.html');

  // The bottom chrome's height is a CSS expression (safe area included): let the browser resolve it.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:var(--hud-pop-rail-bottom-touch)';
  document.body.appendChild(probe);

  const fit = () => {
    const size = toggle.offsetWidth;
    if (!size) return; // not laid out (desktop hides the stack): the desktop column is a single flex column
    const available = window.innerHeight - (stack.getBoundingClientRect().bottom + 8) - probe.offsetHeight;
    const buttons = [...tools.children].filter((el) => !el.hidden && el.style.display !== 'none').length;
    const rows = Math.min(buttons, Math.max(1, Math.floor((available + TOOLS_GAP) / (size + TOOLS_GAP))));
    const columns = Math.ceil(buttons / rows);
    const root = document.documentElement.style;
    root.setProperty('--hud-side-actions-rows', String(rows));
    root.setProperty('--hud-side-actions-width', `${columns * size + (columns - 1) * TOOLS_GAP}px`);
  };

  fit();
  window.addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stack);
  new MutationObserver(fit).observe(tools, { subtree: true, attributes: true, attributeFilter: ['hidden', 'style'] });
}
