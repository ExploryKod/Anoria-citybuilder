import { TimeManager } from '../../../shared/time/TimeManager.js';
import { toSupplySeason, toSupplyMonth, matchesSchedule } from '../../../composition/supplyTimeLabels.js';
import { ASSET_CATALOG } from './resolveBuildingMesh.js';
import {
  createEmptyStocks,
  getSuppliedCategories,
  getResourceRoles,
  getResourceStockShape,
} from '../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Activity sprites (what a building is doing) — decided by the ROLE a building holds in the
 * catalog, never by its type: a hub collects, a quantity distributor buys and sells out, a
 * producer shows the point of its cycle it is at (mesh catalog `cycleGraphics`). A new building of an existing role needs a
 * catalog entry and nothing here. Road, worker and resource statuses are NOT here: they are
 * the exclusive layers refreshEmploymentPresentation (scene.js) applies first; these sprites
 * only show once the building is road-connected AND staffed ("unknown staffing counts as
 * unstaffed", as before).
 */

/**
 * Which texture and sprite name a mesh catalog `cycleGraphics[].status` stands for. A status is the key
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
  // Goods and aggregate come from the catalog (what the citizens eat that a hub stores / its totalKey).
  const hasStock =
    (stocks[getResourceStockShape().totalKey] || 0) > 0 ||
    getSuppliedCategories().some((good) => (stocks[good] || 0) > 0);
  setSprite(ctx, mesh, 'no-food', { visible: ctx.productionSpriteVisible(!hasStock) });
}

/** The game's time in the vocabulary schedules use (see ResourceSchedulePolicy.js). */
function timeContextOf(time) {
  const info = TimeManager.getTimeInfo(time);
  return {
    season: toSupplySeason(info.season),
    month: toSupplyMonth(info.month),
    monthIndex: info.monthIndex,
    year: info.year,
    dayInMonth: info.dayInMonth,
  };
}

/**
 * Producer graphics, both declared in the mesh catalog (`cycleGraphics`, `saleStatus`) and driven by the
 * producer's cycle — no season, crop or building is named here:
 *  - the icon of the point of the cycle it is at (the graphic whose `when` matches the time, or whose
 *    `step` is the step its cycle is on), shown only while staffed; the mesh's own `applyPhase` hook hears
 *    the same id;
 *  - the "collected" icon, on any producer that has a sale window, while a hub holds what it sold.
 * Its own sprites are all cleared first, so one point of the cycle never lingers into the next.
 */
async function applyProducerCycleSprites(ctx, mesh, instanceId, saleEntry, asset) {
  const graphics = asset?.cycleGraphics ?? [];
  const saleStatus = asset?.saleStatus ?? 'sold-to-hub';
  const names = graphics.map((graphic) => spriteOf(graphic.status).name);
  [...names, 'no-food', saleStatus].forEach((name) => {
    ctx.assetManager.removeStatusSprite(mesh, name);
    ctx.assetManager.removeStatusSprite(mesh, `${name}-bg`);
  });

  const timeContext = timeContextOf(ctx.time);
  const needsView = graphics.some((graphic) => graphic.step) || saleEntry;
  const view = needsView ? await ctx.supply.getBuildingSupplyView(instanceId) : null;

  const current = graphics.find((graphic) =>
    graphic.step ? graphic.step === view?.cycleStep : graphic.when && matchesSchedule(graphic.when, timeContext)
  );
  if (current) mesh.userData?.applyPhase?.(current.id);

  // A building with no road or no worker shows only its no-road / no-work icon. Unknown staffing counts as unstaffed.
  if (!isStaffedAndConnected(mesh)) return;

  if (current) {
    const { texture, name } = spriteOf(current.status);
    const meta = ctx.statusIcons[current.status];
    setSprite(ctx, mesh, current.status, {
      texture,
      name,
      visible: ctx.productionSpriteVisible(true),
      color: meta.spriteColor,
      backgroundColor: meta.backgroundColor,
    });
  }

  if (saleEntry) {
    const meta = ctx.statusIcons[saleStatus];
    const collected = view?.soldToHub === true;
    setSprite(ctx, mesh, saleStatus, {
      texture: 'isCollecting',
      name: saleStatus,
      visible: collected ? ctx.productionSpriteVisible(true) : false,
      color: collected ? meta.spriteColor : null,
      backgroundColor: collected ? meta.backgroundColor : null,
    });
  }
}

/**
 * Apply the activity sprites of every role a building holds.
 * @param {RoleSpriteContext} ctx
 * @param {{ mesh: import('three').Object3D, type: string, instanceId: string }} building
 */
export async function applyRoleStatusSprites(ctx, { mesh, type, instanceId }) {
  const roles = getResourceRoles(type);

  // A mesh that follows the calendar (a planted field) is told the season through the hook its adapter put on it.
  mesh.userData?.applySeason?.(TimeManager.getTimeInfo(ctx.time).season);

  if (roles.some((entry) => entry.role === 'hub')) {
    await applyHubSprites(ctx, mesh, instanceId);
  }
  if (roles.some(isQuantityDistributorEntry)) {
    await applyDistributorSprites(ctx, mesh, instanceId);
  }
  const asset = ASSET_CATALOG[type];
  const saleEntry = roles.find((entry) => entry.role === 'producer' && entry.sale);
  if (asset?.cycleGraphics || saleEntry) {
    await applyProducerCycleSprites(ctx, mesh, instanceId, saleEntry, asset);
  }
}

/** True for a building that buys and sells a stock (a market): the catalog says so, not its name. */
export function isQuantityDistributor(type) {
  return getResourceRoles(type).some(isQuantityDistributorEntry);
}
