import { TimeManager } from '../../../shared/time/TimeManager.js';
import { toSupplySeason, toSupplyMonth, matchesSchedule } from '../../../composition/supplyTimeLabels.js';
import { ASSET_CATALOG } from './resolveBuildingMesh.js';
import { getResourceRoles } from '../../../shared/building-catalog/resourceRoleQueries.js';

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
  'no-food': { texture: 'nofood', name: 'no-food' },
  'no-food-farm': { texture: 'nofood', name: 'no-food' },
  'sold-to-hub': { texture: 'isCollecting', name: 'sold-to-hub' },
});

/** @param {string} status A key of STATUS_ICON_DEFAULTS. @returns {{ texture: string, name: string }} */
export function spriteOf(status) {
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

/**
 * Set a status sprite; `visible` false keeps it created but hidden, as the other layers do. Its texture and
 * name come from `spriteOf`, and a status with no texture is an error: the asset manager would otherwise
 * draw the "no road" image in its place.
 */
function setSprite(ctx, mesh, iconKey, { visible, color, backgroundColor }) {
  const { texture, name } = spriteOf(iconKey);
  if (!ctx.textures[texture]) {
    throw new Error(`[roleStatusSprites] no texture "${texture}" for the status "${iconKey}"`);
  }
  const base = ctx.statusIcons[iconKey];
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

/** True when a `{ year, monthIndex }` moment recorded on the building is this month. */
function isThisMonth(at, time) {
  if (!at) return false;
  const now = TimeManager.getTimeInfo(time);
  return at.monthIndex === now.monthIndex && at.year === (now.year ?? 0);
}

/** True when goods really changed hands through the building this month (its `lastTransaction`). */
function transactedThisMonth(view, time) {
  return isThisMonth(view?.lastTransaction, time);
}

/** Hub: shows for the month in which goods really came in — not merely while its collection window is open — and while it is full. */
async function applyHubSprites(ctx, mesh, instanceId) {
  ['isCollecting', 'isCollecting-bg', 'hub-full', 'hub-full-bg'].forEach((name) => ctx.assetManager.removeStatusSprite(mesh, name));
  if (!isStaffedAndConnected(mesh)) return;

  const view = await ctx.supply.getBuildingSupplyView(instanceId);

  // Full: what it holds has reached the ceiling the catalog gives it, so nothing more can be sold to it.
  const totalKey = getResourceRoles(view?.type).find((entry) => entry.role === 'hub')?.totalKey;
  const full = Number.isFinite(view?.maxStock) && totalKey != null && (view.stocks?.[totalKey] ?? 0) >= view.maxStock;
  const fullMeta = ctx.statusIcons['hub-full'];
  setSprite(ctx, mesh, 'hub-full', {
    visible: full ? ctx.productionSpriteVisible(true) : false,
    color: full ? fullMeta.spriteColor : null,
    backgroundColor: full ? fullMeta.backgroundColor : null,
  });

  const meta = ctx.statusIcons.isCollecting;
  if (transactedThisMonth(view, ctx.time)) {
    setSprite(ctx, mesh, 'isCollecting', {
      visible: ctx.productionSpriteVisible(true),
      color: meta.spriteColor,
      backgroundColor: meta.backgroundColor,
    });
  } else {
    setSprite(ctx, mesh, 'isCollecting', { visible: false });
  }
}

/** Quantity distributor: shows for the month in which it really bought, and while houses it serves stay unfed. */
async function applyDistributorSprites(ctx, mesh, instanceId) {
  ['isBuying', 'isBuying-bg', 'no-food', 'no-food-bg'].forEach((name) => ctx.assetManager.removeStatusSprite(mesh, name));
  if (!isStaffedAndConnected(mesh)) return;

  const view = await ctx.supply.getBuildingSupplyView(instanceId);
  const meta = ctx.statusIcons.isBuying;
  if (transactedThisMonth(view, ctx.time)) {
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

  // Not "nothing on the stalls" (a stall hands out all it buys, so it is empty after every tick): a house
  // it serves still waiting for food after its pass.
  setSprite(ctx, mesh, 'no-food', { visible: ctx.productionSpriteVisible((view?.unmetDemand ?? 0) > 0) });
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
  const failedStatus = asset?.failedSaleStatus ?? 'failed-sell';
  const names = graphics.map((graphic) => spriteOf(graphic.status).name);
  [...names, 'no-food', saleStatus, failedStatus].forEach((name) => {
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
    const meta = ctx.statusIcons[current.status];
    setSprite(ctx, mesh, current.status, {
      visible: ctx.productionSpriteVisible(true),
      color: meta.spriteColor,
      backgroundColor: meta.backgroundColor,
    });
  }

  if (saleEntry) {
    const meta = ctx.statusIcons[saleStatus];
    const collected = view?.soldToHub === true;
    setSprite(ctx, mesh, saleStatus, {
      visible: collected ? ctx.productionSpriteVisible(true) : false,
      color: collected ? meta.spriteColor : null,
      backgroundColor: collected ? meta.backgroundColor : null,
    });

    // Right after its sale window closes with goods unsold (no room, no hub, no worker there…), it says so for a
    // moment: the problem is on the producer's side of the sale, not in what it made.
    const failed = isThisMonth(view?.lastFailedSale, ctx.time);
    const failedMeta = ctx.statusIcons[failedStatus];
    setSprite(ctx, mesh, failedStatus, {
      visible: failed ? ctx.productionSpriteVisible(true) : false,
      color: failed ? failedMeta.spriteColor : null,
      backgroundColor: failed ? failedMeta.backgroundColor : null,
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
