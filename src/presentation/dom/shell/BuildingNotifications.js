/**
 * Construction / WebGL toast notifications (via js-toast-notifier).
 */

import { getBuildingDefinition } from '../../../shared/building-catalog/buildingCatalog.js';
import {
  showErrorToast,
  showInfoToast,
  showWarningToast,
} from './ToastNotifier.js';
import {
  getResourceRoles,
  getResourceStockShape,
} from '../../../shared/building-catalog/resourceRoleQueries.js';
import {
  UNRESOLVED_TERM,
  buildingName,
  goodLabel,
  namesOfBuildings,
  namesOfDependents,
  namesOfNaturalResource,
  typesHoldingRole,
  unresolvedTerm,
} from './CatalogVocabulary.js';

/**
 * Legacy aliases that aren't a real building type id in `buildingCatalog`
 * (e.g. capitalized "Road" used by some older call sites) — kept local
 * since they don't correspond to an actual placeable building.
 */
const EXTRA_TRANSLATIONS = {
  Road: 'Route',
};

/**
 * A building's name is the one the catalog gives it (`displayName`); the few legacy ids that are not in the
 * catalog are named above. Anything else is shown as "…" and warned about, never guessed from its id.
 */
export function getBuildingDisplayName(buildingId) {
  if (!buildingId) return buildingId;
  return EXTRA_TRANSLATIONS[buildingId] ?? buildingName(buildingId);
}

const FIXED_PLACEMENT_REASONS = {
  area_not_available: 'Espace non disponible',
  insufficient_funds: 'Fonds insuffisants',
  building_already_exists: 'Un bâtiment existe déjà à cet emplacement',
  database_error: "Erreur lors de l'enregistrement du bâtiment",
  persistence_conflict: 'Conflit de sauvegarde — réessaie dans un instant',
  natural_resource_missing: 'Aucune ressource naturelle à proximité',
};

/**
 * Why a placement is refused. A reason about a neighbouring building (`<role>_missing`, `_too_far`, `_full`)
 * is put in words from the placed building's own catalog requirement: which buildings, how far, how many.
 * @param {string} reason
 * @param {string} buildingType
 */
function translateErrorReason(reason, buildingType) {
  if (FIXED_PLACEMENT_REASONS[reason]) return FIXED_PLACEMENT_REASONS[reason];

  const neighbour = /^([a-z]+)_(missing|too_far|full)$/.exec(reason);
  const requirement = neighbour && (getBuildingDefinition(buildingType)?.placementRequires ?? []).find((candidate) => candidate.role === neighbour[1]);
  if (!requirement) return unresolvedTerm('wording for the placement refusal', reason);

  const names = namesOfBuildings(requirement.role, requirement.categories).join(', ');
  switch (neighbour[2]) {
    case 'missing':
      return `Construisez d'abord : ${names}.`;
    case 'too_far':
      return Number.isFinite(requirement.range) ? `${names} trop loin (portée : ${requirement.range} cases).` : `${names} introuvable.`;
    default: {
      const [hubType] = typesHoldingRole(requirement.role, requirement.categories);
      const capacity = getResourceRoles(hubType).find((entry) => entry.role === requirement.role)?.linkCapacity;
      return `${names} à portée : plus de place (${capacity ?? UNRESOLVED_TERM} ${getBuildingDisplayName(buildingType)} au plus).`;
    }
  }
}

export function showInsufficientFundsNotification(buildingType, price) {
  const displayName = getBuildingDisplayName(buildingType);
  showWarningToast(
    `Fonds insuffisants — impossible de construire ${displayName} (${price}€).`
  );
}

export function showGenericErrorNotification(buildingType, reason) {
  const displayName = getBuildingDisplayName(buildingType);
  const translatedReason = translateErrorReason(reason, buildingType);
  showErrorToast(`Impossible de construire ${displayName}. ${translatedReason}`);
}

/** " à moins de N cases", or nothing when the catalog sets no distance. */
const withinRange = (range) => (Number.isFinite(range) ? ` à moins de ${range} cases` : '');

/**
 * What a building depends on to be built or to work, from its own catalog entry: another building within reach
 * (`placementRequires`), a natural resource within reach (a producer's `source`), the buildings it draws its
 * supplies from (a recipe input's `from`). One general rule for every building that declares any of them.
 * @param {string} buildingType
 * @returns {string | null} A sentence, or null when the building depends on nothing.
 */
export function describePlacementNeeds(buildingType) {
  const definition = getBuildingDefinition(buildingType);
  const needs = [];

  for (const requirement of definition?.placementRequires ?? []) {
    const names = namesOfBuildings(requirement.role, requirement.categories).join(' ou ');
    needs.push(`${names}${withinRange(requirement.range)}${requirement.requiresCapacity ? ' (avec de la place libre)' : ''}`);
  }

  for (const entry of definition?.resourceRoles ?? []) {
    if (entry.role !== 'producer') continue;
    if (entry.source) {
      needs.push(`${namesOfNaturalResource(entry.source.resource).join(', ')}${withinRange(entry.source.range)}`);
    }
    for (const input of [...(entry.inputs ?? []), ...(entry.cycle ?? []).flatMap((step) => step.inputs ?? [])]) {
      if (!input.from) continue;
      const suppliers = namesOfBuildings(input.from.role, [input.category]).join(' ou ');
      needs.push(`${suppliers}${withinRange(input.from.range)} pour ${goodLabel(input.category).toLowerCase()}`);
    }
  }

  return needs.length > 0 ? `${buildingName(buildingType)} requiert : ${needs.join(' · ')}.` : null;
}

/**
 * Said as soon as the player picks a building to place, before any ghost turns red.
 * @param {string} buildingType
 */
export function showPlacementNeedsNotification(buildingType) {
  const message = describePlacementNeeds(buildingType);
  if (message) showInfoToast(message, { timeout: 6000 });
}

/**
 * A hub was demolished and took down the buildings that depended on it.
 * @param {string} hubType The demolished hub's catalog id.
 * @param {Array<{ x: number, y: number }>} destroyed
 */
export function showHubCascadeNotification(hubType, destroyed = []) {
  if (!destroyed.length) return;

  const labels = destroyed.map((building) => `(${building.x}, ${building.y})`).join(', ');

  showWarningToast(
    `${buildingName(hubType)} démoli — ${destroyed.length} ${namesOfDependents(hubType).join('/')} détruit(s) : ${labels}`,
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

/** Why a house lost its standing, by the kind of tier requirement that stopped holding. */
const UNMET_REQUIREMENT_LABELS = {
  demandMet: () => `manque de ${goodLabel(getResourceStockShape().totalKey).toLowerCase()}`,
  goodsVariety: () => 'alimentation trop peu variée',
  roadAccess: () => 'plus de route',
  population: () => 'population insuffisante',
  serviceCoverage: (category) => `plus de ${goodLabel(category).toLowerCase()}`,
};

/**
 * "12 habitants nous quittent car le standing a changé (nourriture insuffisante)".
 * @param {{ count: number, unmet?: Array<{ kind: string, category?: string }> }} departure
 * @returns {string}
 */
export function buildPopulationDepartureMessage({ count, unmet = [] }) {
  const reasons = [
    ...new Set(unmet.map(({ kind, category }) => UNMET_REQUIREMENT_LABELS[kind]?.(category)).filter(Boolean)),
  ];
  const who = count > 1 ? `${count} habitants nous quittent` : '1 habitant nous quitte';
  return `${who} car le standing a changé${reasons.length > 0 ? ` (${reasons.join(', ')})` : ''}`;
}

/** @param {{ count: number, unmet?: Array<{ kind: string, category?: string }> }} departure */
export function showPopulationDepartureNotification(departure) {
  showWarningToast(buildPopulationDepartureMessage(departure), { timeout: 6000 });
}
