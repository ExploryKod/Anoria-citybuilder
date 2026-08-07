/**
 * Construction / WebGL toast notifications (via js-toast-notifier).
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

/**
 * @param {object} _capabilities
 * @param {number} requestedSize
 * @param {number} maxSafeSize
 */
export function showWebGLResourceWarning(_capabilities, requestedSize, maxSafeSize) {
  const warningKey = `webgl-warning-dismissed-${maxSafeSize}`;
  if (localStorage.getItem(warningKey) === 'true') {
    return;
  }

  const simpleMessage =
    requestedSize > maxSafeSize
      ? `Taille réduite à ${maxSafeSize}×${maxSafeSize} (limite système)`
      : `Taille maximale recommandée : ${maxSafeSize}×${maxSafeSize}`;

  showWarningToast(simpleMessage, { timeout: 6000 });
  try {
    localStorage.setItem(warningKey, 'true');
  } catch {
    /* ignore */
  }
}
