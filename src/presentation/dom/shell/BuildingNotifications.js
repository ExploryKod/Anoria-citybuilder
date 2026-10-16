/**
 * Construction / WebGL toast notifications (via js-toast-notifier).
 */

import { getBuildingDefinition } from '../../../shared/building-catalog/buildingCatalog.js';
import { getSkillDisplay } from '../../../shared/population/skillCatalog.js';
import { OWNER_SKILL } from '../../../shared/population/socialCategoryCatalog.js';
import { listClientTypes, producedCategories } from '../../../shared/building-catalog/clientQueries.js';
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
  buildingNameInSentence,
  goodLabel,
  namesOfBuildings,
  namesOfDependents,
  namesOfNaturalResource,
  typesHoldingRole,
  unresolvedTerm,
} from './CatalogVocabulary.js';
import { confirmModal } from './ConfirmModal.js';

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

/**
 * The palette of the refusals of a placement: what stops a building says its own words. Each entry names the reason it answers (`reason`: a code
 * or a pattern for a family of codes) and what it says (`say`), from the refused building's own catalog entry where the words depend on it. A new
 * condition that can stop a construction is one more entry here, and the code that refuses only has to name its reason.
 * @type {ReadonlyArray<{ reason: string | RegExp, say: (building: string, found: RegExpExecArray | null) => string }>}
 */
const PLACEMENT_REFUSALS = Object.freeze([
  // The ground or the purse.
  { reason: 'area_not_available', say: () => 'Espace non disponible' },
  { reason: 'insufficient_funds', say: () => 'Fonds insuffisants' },
  { reason: 'building_already_exists', say: () => 'Un bâtiment existe déjà à cet emplacement' },
  { reason: 'database_error', say: () => "Erreur lors de l'enregistrement du bâtiment" },
  { reason: 'persistence_conflict', say: () => 'Conflit de sauvegarde — réessaie dans un instant' },
  { reason: 'natural_resource_missing', say: () => 'Aucune ressource naturelle à proximité' },
  // What the player lacks, not what the land lacks: the catalog's `requiresPlaced` (a house waits for the owner's house) and `maxPerHamlet`.
  {
    reason: 'building_missing',
    say: (building) => {
      const houses = (getBuildingDefinition(building)?.requiresPlaced ?? []).map((type) => getBuildingDisplayName(type)).join(', ');
      return `Vous n'avez pas encore la compétence pour construire : bâtissez d'abord votre propre maison (${houses}) pour devenir ${getSkillDisplay(OWNER_SKILL).label.toLowerCase()}.`;
    },
  },
  {
    reason: 'building_limit',
    say: (building) => `${getBuildingDefinition(building)?.maxPerHamlet ?? UNRESOLVED_TERM} ${getBuildingDisplayName(building)} au plus par hameau.`,
  },
  // A neighbouring building the placement needs (`<role>_missing`, `_too_far`, `_full`), put in words from the building's own catalog requirement:
  // which buildings, how far, how many.
  {
    reason: /^([a-z]+)_(missing|too_far|full)$/,
    say: (building, found) => {
      const requirement = (getBuildingDefinition(building)?.placementRequires ?? []).find((candidate) => candidate.role === found[1]);
      if (!requirement) return unresolvedTerm('wording for the placement refusal', found[0]);
      const names = namesOfBuildings(requirement.role, requirement.categories).join(', ');
      switch (found[2]) {
        case 'missing':
          return `Construisez d'abord : ${names}.`;
        case 'too_far':
          return Number.isFinite(requirement.range) ? `${names} trop loin (portée : ${requirement.range} cases).` : `${names} introuvable.`;
        default: {
          const [hubType] = typesHoldingRole(requirement.role, requirement.categories);
          const capacity = getResourceRoles(hubType).find((entry) => entry.role === requirement.role)?.linkCapacity;
          return `${names} à portée : plus de place (${capacity ?? UNRESOLVED_TERM} ${getBuildingDisplayName(building)} au plus).`;
        }
      }
    },
  },
]);

/**
 * Why a placement is refused, in the words of the palette; a reason the palette does not know is shown as "…" and warned about, never guessed.
 * @param {string} reason
 * @param {string} buildingType
 */
function translateErrorReason(reason, buildingType) {
  for (const refusal of PLACEMENT_REFUSALS) {
    if (typeof refusal.reason === 'string') {
      if (refusal.reason === reason) return refusal.say(buildingType, null);
      continue;
    }
    const found = refusal.reason.exec(reason);
    if (found) return refusal.say(buildingType, found);
  }
  return unresolvedTerm('wording for the placement refusal', reason);
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
 * Whether a building type wants the on-pick toasts at all (what it needs, who it serves first) — the
 * catalog's own `placementNotice`, off by default. Optional on purpose: a house now has needs of its own
 * (its business draws on a warehouse) and clients of its own (who buys what it makes), but hearing about
 * them every time the player picks a house to place would be noise a house was never meant to raise; an
 * industry that wants the reminder declares it.
 * @param {string} buildingType
 * @returns {boolean}
 */
function hasPlacementNotice(buildingType) {
  return getBuildingDefinition(buildingType)?.placementNotice === true;
}

/**
 * Said as soon as the player picks a building to place, before any ghost turns red — only for a building
 * type that declares `placementNotice` (see hasPlacementNotice above).
 * @param {string} buildingType
 */
export function showPlacementNeedsNotification(buildingType) {
  if (!hasPlacementNotice(buildingType)) return;
  const message = describePlacementNeeds(buildingType);
  if (message) showInfoToast(message, { timeout: 6000 });
}

/**
 * Why a recipe cannot even reach one of its inputs (see DescribeActivitySupplyAccess.js), in the player's
 * words: which building would fix it — a hub to reach, or an industry to supply it — named from the catalog,
 * never hand-picked here.
 * @param {{ inputCategory: string, role: string, status: 'no-hub' | 'no-supplier' | 'no-collector' }} gap
 * @returns {string}
 */
export function describeActivitySupplyGap(gap) {
  const good = goodLabel(gap.inputCategory).toLowerCase();
  // A missing hub, or a missing collector for the output, is fixed by building a hub; a missing supplier by an industry.
  const names = namesOfBuildings(gap.status === 'no-supplier' ? 'producer' : gap.role, [gap.inputCategory]);
  return `${[...new Set(names)].join(' ou ')} nécessaire pour ${good}`;
}

/**
 * Said when the player picks a producer whose goods have clients: where to set who it serves first, once placed.
 * The order itself is a per-instance setting (which specific buildings exist to serve is only known once this
 * one is on the map), so there is nothing to preview here — just where to find it.
 * @param {string} producerType The producer's catalog id.
 */
export function showClientPriorityNotification(producerType) {
  if (!hasPlacementNotice(producerType)) return;
  if (listClientTypes(producedCategories(producerType)).length === 0) return;
  showInfoToast(
    `${buildingName(producerType)} : qui il livre en premier se règle depuis son propre panneau, une fois posé.`,
    { timeout: 7000 }
  );
}

/**
 * Asked before the demolition: which buildings go down with the hub. Names come from the catalog.
 * @param {string} hubType The hub about to be demolished (a catalog id).
 * @param {Array<{ type: string, x: number, y: number }>} dependents What would be destroyed with it.
 * @returns {Promise<boolean>} true when the player confirms.
 */
export function confirmHubCascadeDemolition(hubType, dependents) {
  return confirmModal({
    title: `Démolir ${buildingNameInSentence(hubType)} ?`,
    message: `${buildingName(hubType)} alimente ${dependents.length} bâtiment(s) qui ne peuvent pas fonctionner sans lui : ils seront détruits avec lui.`,
    items: dependents.map((building) => `${buildingName(building.type)} (${building.x}, ${building.y})`),
    confirmLabel: 'Démolir',
    cancelLabel: 'Annuler',
  });
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
