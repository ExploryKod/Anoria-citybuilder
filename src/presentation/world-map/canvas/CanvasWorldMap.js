import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_MAP_ATLAS_IDS,
  KENNEY_HEX_TILE_HEIGHT,
  KENNEY_HEX_TILE_WIDTH,
  resolveKenneyAtlasFrame,
  WORLD_MAP_HEX_SIZE,
  WORLD_MAP_LAND_TILES,
  isWorldMapLandHex,
} from '../../../composition/geographyCatalog.js';
import { WORLD_CITY_CATEGORIES } from '../../../composition/worldCityCatalog.js';
import { HAMLET_ACCESS } from '../../../core/persistence/hamlet/hamletAccess.js';
import { axialToPixel, hexCornerPoints, hexKey, pixelToAxial } from '../../../shared/geography/hexCoordinates.js';
import { clampZoom, fitZoom, keepCenterOver, panBy, rectHit, screenToWorld, worldToScreen, zoomAround } from './camera.js';
import { loadKenneyAtlas } from './kenneyAtlas.js';
import { WORLD_MAP_THEME as THEME } from './worldMapTheme.js';

/**
 * The world map drawn on a Canvas 2D: the Kenney hexagons, the hamlets and the cities, with a camera that pans and zooms by mouse, wheel and fingers.
 * It is an adapter of the map's renderer (contexts/geography/docs/world-map.md): it draws what it is given, reports what was picked, and decides no rule.
 * The names of the places are DOM, laid over the canvas (`.world-map-labels`), so that they stay sharp and readable at every zoom.
 *
 * @typedef {{
 *   view: object,
 *   selectedCityId?: string | null,
 *   selectedHamletId?: string | null,
 *   onCitySelected?: (cityId: string) => void,
 *   onHamletSelected?: (hamletId: string) => void,
 * }} WorldMapOptions `view` is what `getWorldMapView()` answers: the hamlets and the cities, each with its hex and its sprite key
 *
 * @typedef {{ atlasId: string, frame: string }} FrameRef
 */

/** A finger that moves less than this between touching and lifting taps; further, it drags. */
const TAP_SLOP_PX = 8;
/** The camera's centre may leave the map by this much (world units): the map is never lost off screen. */
const CAMERA_MARGIN = 150;

/**
 * @param {HTMLElement} host an element that is positioned and has a size (the map fills it)
 * @param {WorldMapOptions} options
 * @returns {{ refresh: (view: object, selection?: { cityId?: string | null, hamletId?: string | null }) => void, destroy: () => void }}
 */
export function mountWorldMap(host, options) {
  const map = new CanvasWorldMap(host, options);
  return {
    refresh: (view, selection) => map.refresh(view, selection),
    destroy: () => map.destroy(),
  };
}

class CanvasWorldMap {
  /**
   * @param {HTMLElement} host
   * @param {WorldMapOptions} options
   */
  constructor(host, { view, selectedCityId = null, selectedHamletId = null, onCitySelected, onHamletSelected }) {
    this.host = host;
    this.view = view;
    this.selectedCityId = selectedCityId;
    this.selectedHamletId = selectedHamletId;
    this.callbacks = { onCitySelected, onHamletSelected };

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world-map-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', host.getAttribute('aria-label') ?? '');
    this.labelsEl = document.createElement('div');
    this.labelsEl.className = 'world-map-labels';
    this.labelsEl.hidden = true;
    host.replaceChildren(this.canvas, this.labelsEl);
    this.ctx = this.canvas.getContext('2d');

    /** @type {Map<string, import('./kenneyAtlas.js').LoadedAtlas> | null} null until the spritesheets are in */
    this.atlases = null;
    /** @type {Map<string, HTMLCanvasElement>} a frame in a tint, drawn once */
    this.tintCache = new Map();

    this.viewport = { width: 0, height: 0 };
    this.dpr = 1;
    this.sized = false;
    this.camera = { x: 0, y: 0, zoom: THEME.zoom.initial };
    this.limits = { min: THEME.zoom.min, max: THEME.zoom.max };
    /** The pointers on the canvas, by id: one drags, two pinch. */
    this.pointers = new Map();
    this.pinch = null;
    this.hoverHex = null;
    this.rafId = 0;
    this.destroyed = false;

    this.#measureLand();
    this.#rebuild();

    this.abort = new AbortController();
    const { signal } = this.abort;
    this.canvas.addEventListener('pointerdown', (event) => this.#onPointerDown(event), { signal });
    this.canvas.addEventListener('pointermove', (event) => this.#onPointerMove(event), { signal });
    this.canvas.addEventListener('pointerup', (event) => this.#onPointerUp(event), { signal });
    this.canvas.addEventListener('pointercancel', (event) => this.#onPointerCancel(event), { signal });
    this.canvas.addEventListener('pointerleave', () => this.#clearHover(), { signal });
    this.canvas.addEventListener('wheel', (event) => this.#onWheel(event), { passive: false, signal });

    this.resizeObserver = new ResizeObserver(() => this.#resize());
    this.resizeObserver.observe(host);
    this.#resize();

    this.canvas.setAttribute('aria-busy', 'true');
    this.#loadAtlases().catch((error) => console.error('[world-map] the map cannot be drawn:', error));
  }

  /**
   * @param {object} view
   * @param {{ cityId?: string | null, hamletId?: string | null }} [selection]
   */
  refresh(view, selection = {}) {
    if (this.destroyed) return;
    this.view = view;
    if (selection.cityId !== undefined) this.selectedCityId = selection.cityId;
    if (selection.hamletId !== undefined) this.selectedHamletId = selection.hamletId;
    this.#rebuild();
    if (this.atlases) this.#assertFrames();
    this.#requestDraw();
  }

  destroy() {
    this.destroyed = true;
    this.abort.abort();
    this.resizeObserver.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.host.replaceChildren();
  }

  // ─── What is on the map ───────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The extent of the land, in world units, to fit the view and to keep the camera over the map. */
  #measureLand() {
    const halfWidth = KENNEY_HEX_TILE_WIDTH / 2;
    const halfHeight = KENNEY_HEX_TILE_HEIGHT / 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const tile of WORLD_MAP_LAND_TILES) {
      const { x, y } = axialToPixel(tile, WORLD_MAP_HEX_SIZE);
      minX = Math.min(minX, x - halfWidth);
      maxX = Math.max(maxX, x + halfWidth);
      minY = Math.min(minY, y - halfHeight);
      maxY = Math.max(maxY, y + halfHeight);
    }
    this.land = { minX, minY, maxX, maxY };
    // The map is centred on the origin when it opens: what must fit is the larger half on each side of it.
    this.landHalfExtent = { width: Math.max(-minX, maxX), height: Math.max(-minY, maxY) };
  }

  /** @param {string} key @returns {FrameRef} */
  #frameOf(key) {
    const ref = resolveKenneyAtlasFrame(key);
    if (!ref) throw new Error(`[world-map] "${key}" is drawn by no Kenney frame`);
    return ref;
  }

  /** The tiles, the hamlets, the cities and their names, from the view and the selection. */
  #rebuild() {
    const lockedHamletByHex = new Map();
    for (const hamlet of this.view?.hamlets ?? []) {
      if (hamlet.access === HAMLET_ACCESS.locked && hamlet.map?.hex) lockedHamletByHex.set(hexKey(hamlet.map.hex), hamlet.id);
    }

    this.terrain = WORLD_MAP_LAND_TILES.map((tile) => {
      const key = hexKey(tile);
      const { x, y } = axialToPixel(tile, WORLD_MAP_HEX_SIZE);
      return { x, y, frame: this.#frameOf(tile.terrain), lockedHamletId: lockedHamletByHex.get(key) ?? null };
    });

    this.hamlets = (this.view?.hamlets ?? [])
      .filter((hamlet) => hamlet.map?.hex)
      .map((hamlet) => {
        const { x, y } = axialToPixel(hamlet.map.hex, WORLD_MAP_HEX_SIZE);
        return {
          kind: 'hamlet',
          id: hamlet.id,
          name: hamlet.name,
          access: hamlet.access,
          x,
          y,
          frame: this.#frameOf(hamlet.map.sprite ?? 'hamlet'),
        };
      });

    this.cities = (this.view?.cities ?? [])
      .filter((city) => city.map?.hex)
      .map((city) => {
        const { x, y } = axialToPixel(city.map.hex, WORLD_MAP_HEX_SIZE);
        return {
          kind: 'city',
          id: city.id,
          name: city.name,
          category: city.category,
          x,
          y,
          frame: this.#frameOf(city.map.sprite ?? 'village'),
        };
      });

    const labels = [];
    for (const place of [...this.hamlets, ...this.cities]) {
      const element = document.createElement('span');
      element.className = `world-map-label world-map-label--${place.kind}`;
      if (place.kind === 'hamlet' && place.access === HAMLET_ACCESS.locked) element.classList.add('world-map-label--locked');
      element.textContent = place.name;
      place.labelEl = element;
      labels.push(element);
    }
    this.labelsEl.replaceChildren(...labels);
  }

  async #loadAtlases() {
    const loaded = new Map();
    await Promise.all(KENNEY_HEX_MAP_ATLAS_IDS.map(async (atlasId) => {
      const atlas = KENNEY_HEX_ATLASES[atlasId];
      if (!atlas) throw new Error(`[world-map] "${atlasId}" is not an atlas of the Kenney hexagon pack`);
      loaded.set(atlasId, await loadKenneyAtlas(atlas));
    }));
    if (this.destroyed) return;
    this.atlases = loaded;
    this.#assertFrames();
    this.canvas.removeAttribute('aria-busy');
    this.labelsEl.hidden = false;
    this.#requestDraw();
  }

  /** Every frame the map asks for is in the spritesheets: a missing one is an error naming it, never a tile left out. */
  #assertFrames() {
    const seen = new Set();
    const check = (ref) => {
      const id = `${ref.atlasId}|${ref.frame}`;
      if (seen.has(id)) return;
      seen.add(id);
      if (!this.atlases.get(ref.atlasId)?.frames.has(ref.frame)) {
        throw new Error(`[world-map] the frame ${ref.frame} is not in the atlas "${ref.atlasId}" (loaded: ${[...this.atlases.keys()].join(', ')})`);
      }
    };
    for (const tile of this.terrain) check(tile.frame);
    for (const place of [...this.hamlets, ...this.cities]) check(place.frame);
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  #requestDraw() {
    if (this.rafId || this.destroyed) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.#draw();
    });
  }

  #resize() {
    if (this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < 1 || height < 1) return;
    this.dpr = window.devicePixelRatio || 1;
    this.viewport = { width, height };
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    // Resizing a canvas resets its state.
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Whole map in view on a small screen, the usual zoom on a large one; the zoom cannot go further out than the whole map.
    const fit = fitZoom(this.viewport, { width: this.landHalfExtent.width * 2, height: this.landHalfExtent.height * 2 });
    this.limits = { min: Math.min(THEME.zoom.min, fit), max: THEME.zoom.max };
    this.camera = this.sized
      ? { ...this.camera, zoom: clampZoom(this.camera.zoom, this.limits) }
      : { x: 0, y: 0, zoom: clampZoom(Math.min(THEME.zoom.initial, fit), this.limits) };
    this.sized = true;
    this.#requestDraw();
  }

  #draw() {
    const { ctx, camera, viewport, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = THEME.ocean;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    if (!this.atlases) return;

    ctx.save();
    ctx.translate(viewport.width / 2, viewport.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.#drawTerrain();
    for (const hamlet of this.hamlets) this.#drawHamlet(hamlet);
    for (const city of this.cities) this.#drawCity(city);
    this.#drawHover();

    ctx.restore();
    this.#placeLabels();
  }

  #drawTerrain() {
    const { camera, viewport } = this;
    // Only what the view shows: its half size in world units, and a tile's own.
    const reachX = viewport.width / 2 / camera.zoom + KENNEY_HEX_TILE_WIDTH;
    const reachY = viewport.height / 2 / camera.zoom + KENNEY_HEX_TILE_HEIGHT;
    const locked = THEME.terrain.locked;
    for (const tile of this.terrain) {
      if (Math.abs(tile.x - camera.x) > reachX || Math.abs(tile.y - camera.y) > reachY) continue;
      if (tile.lockedHamletId) {
        this.#drawSprite(tile.frame, tile.x, tile.y, 1, {
          tint: locked.tint,
          alpha: tile.lockedHamletId === this.selectedHamletId ? locked.selectedAlpha : locked.alpha,
        });
      } else {
        this.#drawSprite(tile.frame, tile.x, tile.y, 1);
      }
    }
  }

  /** @param {object} hamlet */
  #drawHamlet(hamlet) {
    const markerScale = this.#hamletMarkerScale(hamlet);
    if (hamlet.access === HAMLET_ACCESS.locked) {
      this.#drawLockBadge(hamlet.x, hamlet.y, markerScale);
      return;
    }
    const tint = hamlet.access === HAMLET_ACCESS.active ? THEME.hamlet.tint.active : THEME.hamlet.tint.unlocked;
    this.#drawSprite(hamlet.frame, hamlet.x, hamlet.y, THEME.hamlet.scale * markerScale, { tint });
  }

  /** @param {object} city */
  #drawCity(city) {
    const selected = this.#isCitySelected(city);
    this.#drawSprite(city.frame, city.x, city.y, THEME.city.scale * this.#cityMarkerScale(city), { tint: selected ? null : this.#cityTint(city) });
  }

  /** @returns {string | null} the tint of a city that is not selected */
  #cityTint(city) {
    if (city.category === WORLD_CITY_CATEGORIES.enemy) return THEME.city.tint.enemy;
    if (city.id === 'anoria') return THEME.city.tint.capital;
    return null;
  }

  /**
   * A frame at a world point, its `origin` on that point.
   * @param {FrameRef} ref
   * @param {{ tint?: string | null, alpha?: number }} [style]
   */
  #drawSprite(ref, x, y, scale, { tint = null, alpha = 1 } = {}) {
    const atlas = this.atlases.get(ref.atlasId);
    const frame = atlas.frames.get(ref.frame);
    const width = frame.width * scale;
    const height = frame.height * scale;
    const source = tint ? this.#tinted(ref, tint) : atlas.image;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(
      source,
      tint ? 0 : frame.x,
      tint ? 0 : frame.y,
      frame.width,
      frame.height,
      x - width * THEME.origin.x,
      y - height * THEME.origin.y,
      width,
      height,
    );
    this.ctx.globalAlpha = 1;
  }

  /** A frame multiplied by a colour, as a texture is tinted, drawn once and kept. */
  #tinted(ref, tint) {
    const cacheKey = `${ref.atlasId}|${ref.frame}|${tint}`;
    const cached = this.tintCache.get(cacheKey);
    if (cached) return cached;
    const atlas = this.atlases.get(ref.atlasId);
    const frame = atlas.frames.get(ref.frame);
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    context.drawImage(atlas.image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = tint;
    context.fillRect(0, 0, frame.width, frame.height);
    // The multiply fills the transparent corners too: the picture's own shape is put back.
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(atlas.image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    this.tintCache.set(cacheKey, canvas);
    return canvas;
  }

  /** The padlock on its plate, that stands for a hamlet not yet open. */
  #drawLockBadge(x, y, markerScale) {
    const { ctx } = this;
    const lock = THEME.hamlet.lock;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(markerScale, markerScale);
    ctx.translate(0, lock.offsetY);

    ctx.beginPath();
    ctx.arc(0, 0, lock.plate.radius, 0, Math.PI * 2);
    ctx.fillStyle = lock.plate.fill;
    ctx.fill();
    ctx.lineWidth = lock.plate.strokeWidth;
    ctx.strokeStyle = lock.plate.stroke;
    ctx.stroke();

    ctx.strokeStyle = lock.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.moveTo(-4, -2);
    ctx.lineTo(-4, 2);
    ctx.moveTo(4, -2);
    ctx.lineTo(4, 2);
    ctx.moveTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.stroke();

    ctx.fillStyle = lock.color;
    ctx.beginPath();
    ctx.roundRect(-5, 2, 10, 8, 2);
    ctx.fill();
    ctx.restore();
  }

  #drawHover() {
    if (!this.hoverHex || !isWorldMapLandHex(this.hoverHex)) return;
    const { ctx } = this;
    const center = axialToPixel(this.hoverHex, WORLD_MAP_HEX_SIZE);
    const corners = hexCornerPoints(WORLD_MAP_HEX_SIZE * THEME.hover.radius);
    ctx.beginPath();
    ctx.moveTo(center.x + corners[0].x, center.y + corners[0].y);
    for (let index = 1; index < corners.length; index += 1) ctx.lineTo(center.x + corners[index].x, center.y + corners[index].y);
    ctx.closePath();
    ctx.globalAlpha = THEME.hover.alpha;
    ctx.lineWidth = THEME.hover.width;
    ctx.strokeStyle = THEME.hover.color;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** The names, over the canvas: each follows its place, at a size that does not change with the zoom. */
  #placeLabels() {
    const { camera, viewport } = this;
    for (const place of [...this.hamlets, ...this.cities]) {
      const markerScale = place.kind === 'hamlet' ? this.#hamletMarkerScale(place) : this.#cityMarkerScale(place);
      const offset = place.kind === 'city'
        ? THEME.city.labelOffset
        : (place.access === HAMLET_ACCESS.locked ? THEME.hamlet.labelOffset.locked : THEME.hamlet.labelOffset.open);
      const point = worldToScreen(camera, viewport, place.x, place.y + offset * markerScale);
      const visible = point.x > -120 && point.x < viewport.width + 120 && point.y > -40 && point.y < viewport.height + 40;
      place.labelEl.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) continue;
      const selected = markerScale !== 1;
      place.labelEl.classList.toggle('world-map-label--selected', selected);
      place.labelEl.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) translateX(-50%)`;
    }
  }

  // ─── The selection ────────────────────────────────────────────────────────────────────────────────────────────────────────────

  #isCitySelected(city) {
    return city.id === this.selectedCityId && !this.selectedHamletId;
  }

  #hamletMarkerScale(hamlet) {
    return hamlet.id === this.selectedHamletId ? THEME.hamlet.selectedScale : 1;
  }

  #cityMarkerScale(city) {
    return this.#isCitySelected(city) ? THEME.city.selectedScale : 1;
  }

  /** @param {{ kind: 'city' | 'hamlet', id: string }} place */
  #select(place) {
    if (place.kind === 'city') {
      this.selectedCityId = place.id;
      this.selectedHamletId = null;
      this.callbacks.onCitySelected?.(place.id);
    } else {
      this.selectedHamletId = place.id;
      this.selectedCityId = null;
      this.callbacks.onHamletSelected?.(place.id);
    }
    this.#requestDraw();
  }

  // ─── Picking ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * The place under a screen point: a city, then a hamlet (the cities are drawn over the hamlets). A target is a finger wide at least.
   * @returns {object | null}
   */
  #placeAt(screenX, screenY) {
    for (let index = this.cities.length - 1; index >= 0; index -= 1) {
      const city = this.cities[index];
      if (this.#hitSprite(city, THEME.city.scale * this.#cityMarkerScale(city), screenX, screenY)) return city;
    }
    for (let index = this.hamlets.length - 1; index >= 0; index -= 1) {
      const hamlet = this.hamlets[index];
      const markerScale = this.#hamletMarkerScale(hamlet);
      if (hamlet.access === HAMLET_ACCESS.locked) {
        const centre = worldToScreen(this.camera, this.viewport, hamlet.x, hamlet.y + THEME.hamlet.lock.offsetY * markerScale);
        const radius = Math.max(THEME.hamlet.lock.plate.radius * markerScale * this.camera.zoom, THEME.minTouchTarget / 2);
        if (Math.hypot(screenX - centre.x, screenY - centre.y) <= radius) return hamlet;
      } else if (this.#hitSprite(hamlet, THEME.hamlet.scale * markerScale, screenX, screenY)) {
        return hamlet;
      }
    }
    return null;
  }

  #hitSprite(place, scale, screenX, screenY) {
    const frame = this.atlases?.get(place.frame.atlasId)?.frames.get(place.frame.frame);
    if (!frame) return false;
    const width = frame.width * scale;
    const height = frame.height * scale;
    const topLeft = worldToScreen(this.camera, this.viewport, place.x - width * THEME.origin.x, place.y - height * THEME.origin.y);
    const rect = { left: topLeft.x, top: topLeft.y, width: width * this.camera.zoom, height: height * this.camera.zoom };
    return rectHit(rect, screenX, screenY, THEME.minTouchTarget);
  }

  // ─── The pointer: drag, pinch, wheel, tap ───────────────────────────────────────────────────────────────────────────────────

  /** @returns {{ x: number, y: number }} a pointer event's position in the canvas */
  #local(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  #onPointerDown(event) {
    if (event.button === 2) return;
    this.canvas.setPointerCapture(event.pointerId);
    const { x, y } = this.#local(event);
    this.pointers.set(event.pointerId, { x, y, lastX: x, lastY: y, startX: x, startY: y, moved: false });
    if (this.pointers.size === 2) {
      // A second finger: this is a pinch, and no longer a tap or a drag.
      for (const pointer of this.pointers.values()) pointer.moved = true;
      this.pinch = this.#pinchState();
    }
  }

  #onPointerMove(event) {
    const { x, y } = this.#local(event);
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) {
      if (event.pointerType === 'mouse') this.#updateHover(x, y);
      return;
    }
    pointer.x = x;
    pointer.y = y;

    if (this.pointers.size >= 2 && this.pinch) {
      this.#applyPinch();
      return;
    }

    let deltaX = x - pointer.lastX;
    let deltaY = y - pointer.lastY;
    if (!pointer.moved && Math.hypot(x - pointer.startX, y - pointer.startY) > TAP_SLOP_PX) {
      pointer.moved = true;
      // The drag starts where the finger first touched, not where it crossed the threshold.
      deltaX = x - pointer.startX;
      deltaY = y - pointer.startY;
    }
    pointer.lastX = x;
    pointer.lastY = y;
    if (!pointer.moved) return;

    this.camera = keepCenterOver(panBy(this.camera, deltaX, deltaY), this.land, CAMERA_MARGIN);
    this.canvas.style.cursor = 'grabbing';
    this.#requestDraw();
  }

  #onPointerUp(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const wasAlone = this.pointers.size === 1;
    this.#forget(event.pointerId);
    if (!wasAlone || pointer.moved) return;
    const place = this.#placeAt(pointer.x, pointer.y);
    if (place) this.#select(place);
  }

  #onPointerCancel(event) {
    this.#forget(event.pointerId);
  }

  #forget(pointerId) {
    this.pointers.delete(pointerId);
    this.pinch = null;
    this.canvas.style.cursor = '';
    // The finger that stays does not jump the map: its next move counts from where it is.
    for (const pointer of this.pointers.values()) {
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
    }
  }

  #pinchState() {
    const [first, second] = [...this.pointers.values()];
    return {
      distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
      centerX: (first.x + second.x) / 2,
      centerY: (first.y + second.y) / 2,
    };
  }

  #applyPinch() {
    const next = this.#pinchState();
    const zoom = clampZoom(this.camera.zoom * (next.distance / this.pinch.distance), this.limits);
    let camera = zoomAround(this.camera, this.viewport, zoom, this.pinch.centerX, this.pinch.centerY);
    // The middle of the two fingers also drags the map.
    camera = panBy(camera, next.centerX - this.pinch.centerX, next.centerY - this.pinch.centerY);
    this.camera = keepCenterOver(camera, this.land, CAMERA_MARGIN);
    this.pinch = next;
    this.#requestDraw();
  }

  #onWheel(event) {
    event.preventDefault();
    const { x, y } = this.#local(event);
    const lines = event.deltaMode === 1 ? 16 : 1;
    const zoom = clampZoom(this.camera.zoom * Math.exp(-event.deltaY * lines * THEME.zoom.wheelSpeed), this.limits);
    this.camera = keepCenterOver(zoomAround(this.camera, this.viewport, zoom, x, y), this.land, CAMERA_MARGIN);
    this.#requestDraw();
  }

  #updateHover(screenX, screenY) {
    const world = screenToWorld(this.camera, this.viewport, screenX, screenY);
    const hex = pixelToAxial(world.x, world.y, WORLD_MAP_HEX_SIZE);
    const onLand = isWorldMapLandHex(hex);
    const same = this.hoverHex && onLand && this.hoverHex.q === hex.q && this.hoverHex.r === hex.r;
    this.canvas.style.cursor = this.#placeAt(screenX, screenY) ? 'pointer' : '';
    if (same) return;
    this.hoverHex = onLand ? { q: hex.q, r: hex.r } : null;
    this.#requestDraw();
  }

  #clearHover() {
    if (!this.hoverHex) return;
    this.hoverHex = null;
    this.#requestDraw();
  }
}
