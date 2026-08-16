/**
 * Vertical APG tabs on the population rail (intercalaires).
 * ArrowUp / ArrowDown / Home / End switch views; Tab lands on the selected tab only.
 */

export const HUD_POP_RAIL_TAB_IDS = Object.freeze({
  details: 'pop-details',
  ressourcesVille: 'pop-ressources-ville',
  ressourcesCommerce: 'pop-ressources-commerce',
  ressourcesNature: 'pop-ressources-nature',
});

const TAB_ORDER = Object.freeze([
  HUD_POP_RAIL_TAB_IDS.details,
  HUD_POP_RAIL_TAB_IDS.ressourcesVille,
  HUD_POP_RAIL_TAB_IDS.ressourcesCommerce,
  HUD_POP_RAIL_TAB_IDS.ressourcesNature,
]);

/**
 * @param {ParentNode | null | undefined} root
 * @returns {HTMLElement[]}
 */
function getTabs(root) {
  if (!root) return [];
  return [...root.querySelectorAll('.hud-pop-rail__tabs [role="tab"]')];
}

/**
 * @param {string} tabId
 * @param {ParentNode | null} [root]
 */
export function activateHudPopRailTab(tabId, root = document.getElementById('hud-pop-rail')) {
  if (!root) return;
  const targetId = TAB_ORDER.includes(tabId) ? tabId : TAB_ORDER[0];
  const tabs = getTabs(root);

  for (const tab of tabs) {
    const id = tab.dataset.tab;
    const isActive = id === targetId;
    const panel = id ? root.querySelector(`#${tab.getAttribute('aria-controls')}`) : null;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
    if (panel instanceof HTMLElement) {
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    }
  }
}

/**
 * @param {HTMLElement | null} [root]
 */
export function initHudPopRailTabs(root = document.getElementById('hud-pop-rail')) {
  if (!root || root.dataset.popRailTabsReady === 'true') return;
  const tablist = root.querySelector('.hud-pop-rail__tabs[role="tablist"]');
  if (!tablist) return;

  root.dataset.popRailTabsReady = 'true';

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    const tabId = tab?.dataset?.tab;
    if (!tabId) return;
    activateHudPopRailTab(tabId, root);
  });

  tablist.addEventListener('keydown', (event) => {
    const tabs = getTabs(root);
    if (tabs.length === 0) return;
    const currentIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'),
    );

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextTab = tabs[nextIndex];
    const tabId = nextTab?.dataset?.tab;
    if (!tabId) return;
    activateHudPopRailTab(tabId, root);
    nextTab.focus();
  });

  const selected = tabsSelectedId(root) ?? TAB_ORDER[0];
  activateHudPopRailTab(selected, root);
}

/**
 * @param {ParentNode} root
 * @returns {string | null}
 */
function tabsSelectedId(root) {
  const selected = root.querySelector('.hud-pop-rail__tabs [role="tab"][aria-selected="true"]');
  return selected?.dataset?.tab ?? null;
}
