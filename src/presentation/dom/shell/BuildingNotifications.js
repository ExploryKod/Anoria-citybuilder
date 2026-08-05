/**
 * Construction / WebGL toast notifications (DOM).
 */

import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';
import {
  showErrorToast,
  showWarningToast,
} from './ToastNotifier.js';

/**
 * Legacy aliases that aren't a real building type id in `buildingCatalog`
 * (e.g. capitalized "Road" used by some older call sites) — kept local
 * since they don't correspond to an actual placeable building.
 */
const EXTRA_TRANSLATIONS = {
  Road: 'Route',
};

/** Derived from `buildingCatalog` (single source of truth for display names). */
const BUILDING_TRANSLATIONS = {
  ...Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.displayName)
      .map(([id, def]) => [id, def.displayName])
  ),
  ...EXTRA_TRANSLATIONS,
};

const PLACEMENT_REASON_TRANSLATIONS = {
  area_not_available: 'Espace non disponible',
  insufficient_funds: 'Fonds insuffisants',
  building_already_exists: 'Un bâtiment existe déjà à cet emplacement',
  database_error: "Erreur lors de l'enregistrement du bâtiment",
  persistence_conflict: 'Conflit de sauvegarde — réessaie dans un instant',
  no_windmill: "Construisez d'abord un moulin",
  windmill_too_far: 'Aucun moulin à proximité',
  windmill_full: 'Les moulins proches ont déjà 2 marchés',
};

export function getBuildingDisplayName(buildingId) {
  if (!buildingId) return buildingId;
  if (BUILDING_TRANSLATIONS[buildingId]) {
    return BUILDING_TRANSLATIONS[buildingId];
  }
  for (const [key, value] of Object.entries(BUILDING_TRANSLATIONS)) {
    if (buildingId.startsWith(key)) {
      return value;
    }
  }
  return String(buildingId)
    .replace(/-\d+$/g, '')
    .replace(/-/g, ' ');
}

function translateErrorReason(reason) {
  return PLACEMENT_REASON_TRANSLATIONS[reason] || reason;
}

export function showInsufficientFundsNotification(buildingType, price) {
  const displayName = getBuildingDisplayName(buildingType);
  showWarningToast(
    `Fonds insuffisants — impossible de construire ${displayName} (${price}€).`
  );
}

export function showGenericErrorNotification(buildingType, reason) {
  const displayName = getBuildingDisplayName(buildingType);
  const translatedReason = translateErrorReason(reason);
  showErrorToast(`Impossible de construire ${displayName}. ${translatedReason}`);
}

/**
 * @param {Array<{ x: number, y: number }>} destroyedMarkets
 */
export function showWindmillCascadeNotification(destroyedMarkets = []) {
  if (!destroyedMarkets.length) return;

  const labels = destroyedMarkets
    .map((market) => `(${market.x}, ${market.y})`)
    .join(', ');

  showWarningToast(
    `Moulin démoli — ${destroyedMarkets.length} marché(s) détruit(s) : ${labels}`,
    { timeout: 6000 }
  );
}

function ensureBuildingNotificationStyles() {
  if (document.querySelector('#building-notification-styles')) return;
  const style = document.createElement('style');
  style.id = 'building-notification-styles';
  style.textContent = `
    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideUp {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
  `;
  document.head.appendChild(style);
}

function dismissNotification(notification, delayMs) {
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, delayMs);
}

/**
 * @param {object} _capabilities
 * @param {number} requestedSize
 * @param {number} maxSafeSize
 */
export function showWebGLResourceWarning(_capabilities, requestedSize, maxSafeSize) {
  ensureBuildingNotificationStyles();
  const warningKey = `webgl-warning-dismissed-${maxSafeSize}`;
  if (localStorage.getItem(warningKey) === 'true') {
    return;
  }

  const notification = document.createElement('div');
  notification.className = 'building-notification webgl-resource-warning';

  const simpleMessage = requestedSize > maxSafeSize
    ? `Taille réduite à ${maxSafeSize}×${maxSafeSize} (limite système)`
    : `Taille maximale recommandée: ${maxSafeSize}×${maxSafeSize}`;

  notification.innerHTML = `
    <div class="notification-content" style="display: flex; align-items: flex-start; gap: 12px; position: relative; padding-right: 30px;">
      <div class="notification-icon" style="font-size: 24px; flex-shrink: 0; margin-top: 2px;">⚠️</div>
      <div class="notification-text" style="flex: 1;">
        <div class="notification-message" style="color: #000; font-size: 14px; line-height: 1.4;">${simpleMessage}</div>
      </div>
      <button type="button" class="notification-close" style="
        position: absolute; top: 4px; right: 4px; background: none; border: none;
        color: #666; font-size: 22px; line-height: 1; cursor: pointer; padding: 0;
        width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
        opacity: 0.6; transition: opacity 0.2s;
      "
      onmouseover="this.style.opacity='1'"
      onmouseout="this.style.opacity='0.6'"
      onclick="this.closest('.webgl-resource-warning').remove(); localStorage.setItem('${warningKey}', 'true');">×</button>
    </div>
  `;
  notification.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #ffffff; color: #000000; padding: 16px 20px; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 10001;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px; max-width: 400px; animation: slideDown 0.3s ease-out;
    border: 2px solid #ff9800;
  `;
  document.body.appendChild(notification);
  dismissNotification(notification, 6000);
}
