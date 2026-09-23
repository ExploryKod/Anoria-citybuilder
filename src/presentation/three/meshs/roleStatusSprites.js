import { TimeManager } from '../../../shared/time/TimeManager.js';
import { toSupplySeason } from '../../../composition/supplyTimeLabels.js';
import {
  createEmptyStocks,
  getAllCategoriesForRole,
  getResourceRoles,
  getResourceStockShape,
} from '../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Activity sprites (what a building is doing) — decided by the ROLE a building holds in the
 * catalog, never by its type: a hub collects, a quantity distributor buys and sells out, a
 * producer with `statusPhases` shows its phase. A new building of an existing role needs a
 * catalog entry and nothing here. Road, worker and resource statuses are NOT here: they are
 * the exclusive layers refreshEmploymentPresentation (scene.js) applies first; these sprites
 * only show once the building is road-connected AND staffed ("unknown staffing counts as
 * unstaffed", as before).
 */

/**
 * Which texture and sprite name a catalog `statusPhases[].status` stands for. A status is the key
 * of STATUS_ICON_DEFAULTS; most are their own texture and name, the exceptions are listed.
 */
const STATUS_SPRITE = Object.freeze({
  'no-food-farm': { texture: 'nofood', name: 'no-food' },
});

function spriteOf(status) {
  return STATUS_SPRITE[status] ?? { texture: status, name: status };
}

/** @param {import('three').Object3D} mesh */
function isStaffedAndConnected(mesh) {
  return mesh?.userData?.isUnderstaffed === false && mesh?.userData?.hasRoadAccess !== false;
}

/** A quantity distributor sells a depleting stock (a market); a flag one only covers houses (a chapel). */
function isQuantityDistributorEntry(entry) {
  return entry.role === 'distributor' && (entry.consumption ?? 'quantity') === 'quantity';
}

/**
 * @typedef {Object} RoleSpriteContext
 * @property {object} assetManager
 * @property {Record<string, import('three').Texture>} textures
 * @property {Record<string, { position: object, scale: object, spriteColor: number | null, backgroundColor: number | null }>} statusIcons
 * @property {(mesh: object, key: string, position: object, scale: object) => { position: object, scale: object }} resolveIconAppearance
 * @property {(condition: boolean) => boolean} productionSpriteVisible
 * @property {{ getBuildingSupplyView: (id: string) => Promise<object | null> }} supply
 * @property {number} time
 */

/** Set a status sprite; `visible` false keeps it created but hidden, as the other layers do. */
function setSprite(ctx, mesh, iconKey, { texture = iconKey, name = iconKey, visible, color, backgroundColor, meta }) {
  const base = meta ?? ctx.statusIcons[iconKey];
  const icon = ctx.resolveIconAppearance(mesh, name, base.position, base.scale);
  ctx.assetManager.setStatusSprite(
    mesh,
    ctx.textures[texture],
    name,
    icon.scale,
    icon.position,
    visible,
    color ?? null,
    backgroundColor ?? null
  );
}

/** Hub: shows while it is collecting. */
async function applyHubSprites(ctx, mesh, instanceId) {
  ['isCollecting', 'isCollecting-bg'].forEach((name) => ctx.assetManager.removeStatusSprite(mesh, name));
  if (!isStaffedAndConnected(mesh)) return;

  const view = await ctx.supply.getBuildingSupplyView(instanceId);
  const meta = ctx.statusIcons.isCollecting;
  if (view?.isCollecting === true) {
    setSprite(ctx, mesh, 'isCollecting', {
      visible: ctx.productionSpriteVisible(true),
      color: meta.spriteColor,
      backgroundColor: meta.backgroundColor,
    });
  } else {
    setSprite(ctx, mesh, 'isCollecting', { visible: false });
  }
}

/** Quantity distributor: shows while it is buying, and when its stock is empty. */
async function applyDistributorSprites(ctx, mesh, instanceId) {
  ['isBuying', 'isBuying-bg', 'no-food', 'no-food-bg'].forEach((name) => ctx.assetManager.removeStatusSprite(mesh, name));
  if (!isStaffedAndConnected(mesh)) return;

  const view = await ctx.supply.getBuildingSupplyView(instanceId);
  const meta = ctx.statusIcons.isBuying;
  if (view?.isBuying === true) {
    // Orange when no source is near enough to buy from, green otherwise.
    const noSource = view?.noFarmsNearby === true;
    setSprite(ctx, mesh, 'isBuying', {
      visible: ctx.productionSpriteVisible(true),
      color: noSource ? 0xff6600 : meta.spriteColor,
      backgroundColor: noSource ? 0xffcccc : meta.backgroundColor,
    });
  } else {
    setSprite(ctx, mesh, 'isBuying', { visible: false });
  }

  const stocks = view?.stocks || createEmptyStocks();
  // Goods and aggregate come from the catalog (what a hub stores / its totalKey).
  const hasStock =
    (stocks[getResourceStockShape().totalKey] || 0) > 0 ||
    getAllCategoriesForRole('hub').some((good) => (stocks[good] || 0) > 0);
  setSprite(ctx, mesh, 'no-food', { visible: ctx.productionSpriteVisible(!hasStock) });
}

/**
 * Producer with `statusPhases`: the sprite of the current season. Its own sprites are all cleared
 * first, so a phase never lingers into the next one; a mesh that follows the seasons (a planted
 * field) is told the season through the hook its adapter put on it.
 */
async function applyPhasedProducerSprites(ctx, mesh, instanceId, entry) {
  const phaseSprites = entry.statusPhases.map((phase) => spriteOf(phase.status).name);
  [...phaseSprites, 'no-food', 'sold-to-hub'].forEach((name) => {
    ctx.assetManager.removeStatusSprite(mesh, name);
    ctx.assetManager.removeStatusSprite(mesh, `${name}-bg`);
  });

  const timeInfo = TimeManager.getTimeInfo(ctx.time);
  mesh.userData?.applySeason?.(timeInfo.season);

  // A farm with no worker produces nothing: only its no-work icon shows. Unknown staffing counts as unstaffed.
  if (mesh.userData?.isUnderstaffed !== false) return;

  const phase = entry.statusPhases.find((p) => p.season === toSupplySeason(timeInfo.season));
  if (phase) {
    const { texture, name } = spriteOf(phase.status);
    const meta = ctx.statusIcons[phase.status];
    setSprite(ctx, mesh, phase.status, {
      texture,
      name,
      visible: ctx.productionSpriteVisible(true),
      color: meta.spriteColor,
      backgroundColor: meta.backgroundColor,
    });
  }

  // Also say whether a hub collected this producer's goods. Supply raises that flag for the hub's own
  // collection period (its `collector` schedule in the catalog) and clears it after, so no month is named here.
  const view = await ctx.supply.getBuildingSupplyView(instanceId);
  const meta = ctx.statusIcons['sold-to-hub'];
  const collected = view?.soldToHub === true;
  setSprite(ctx, mesh, 'sold-to-hub', {
    texture: 'isCollecting',
    name: 'sold-to-hub',
    visible: collected ? ctx.productionSpriteVisible(true) : false,
    color: collected ? meta.spriteColor : null,
    backgroundColor: collected ? meta.backgroundColor : null,
  });
}

/**
 * Apply the activity sprites of every role a building holds.
 * @param {RoleSpriteContext} ctx
 * @param {{ mesh: import('three').Object3D, type: string, instanceId: string }} building
 */
export async function applyRoleStatusSprites(ctx, { mesh, type, instanceId }) {
  const roles = getResourceRoles(type);

  if (roles.some((entry) => entry.role === 'hub')) {
    await applyHubSprites(ctx, mesh, instanceId);
  }
  if (roles.some(isQuantityDistributorEntry)) {
    await applyDistributorSprites(ctx, mesh, instanceId);
  }
  const phased = roles.find((entry) => entry.role === 'producer' && entry.statusPhases);
  if (phased) {
    await applyPhasedProducerSprites(ctx, mesh, instanceId, phased);
  }
}

/** True for a building that buys and sells a stock (a market): the catalog says so, not its name. */
export function isQuantityDistributor(type) {
  return getResourceRoles(type).some(isQuantityDistributorEntry);
}
