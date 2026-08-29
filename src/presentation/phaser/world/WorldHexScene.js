import Phaser from 'phaser';
import { HAMLET_ACCESS } from '../../../core/persistence/hamlet/hamletAccess.js';
import { resolveKenneyPhaserFrame } from '../../../contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { TRADE_MAP_CITY_CATEGORIES } from '../../../contexts/commerce/domain/catalogs/TradeMapCityCatalog.js';
import {
  WORLD_MAP_HEX_SIZE,
  WORLD_MAP_LAND_TILES,
  isWorldMapLandHex,
} from '../../../contexts/geography/domain/world/worldMapDefinition.js';
import { axialToPixel, hexCornerPoints, hexKey, pixelToAxial } from '../../../shared/geography/hexCoordinates.js';
import { loadKenneyHexAtlases } from '../shared/loadKenneyHexAtlases.js';
import { consumePendingWorldBootstrap } from './worldMapBootstrapState.js';

export const WORLD_HEX_SCENE_KEY = 'WorldHexScene';

const OCEAN_COLOR = 0x1a3a5c;
const HOVER_COLOR = 0xfb8122;
const HAMLET_ACTIVE_TINT = 0x88ffbb;
const HAMLET_UNLOCKED_TINT = 0xffd4a8;
const LOCKED_TERRAIN_TINT = 0x7a6b8a;
const LOCKED_TERRAIN_ALPHA = 0.82;
const LOCKED_LABEL_COLOR = '#c9bba8';

/**
 * @typedef {{
 *   onCitySelected?: (cityId: string) => void,
 *   onHamletSelected?: (hamletId: string) => void,
 * }} WorldHexCallbacks
 */

export class WorldHexScene extends Phaser.Scene {
  constructor() {
    super({ key: WORLD_HEX_SCENE_KEY });
    /** @type {WorldHexCallbacks} */
    this.callbacks = {};
    /** @type {object | null} */
    this.view = null;
    /** @type {string | null} */
    this.selectedCityId = null;
    /** @type {string | null} */
    this.selectedHamletId = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.worldRoot = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.terrainLayer = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.hamletsLayer = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.citiesLayer = null;
    /** @type {Phaser.GameObjects.Graphics | null} */
    this.hoverGraphics = null;
    /** @type {Map<string, Phaser.GameObjects.Image>} */
    this.terrainTiles = new Map();
    /** @type {Map<string, Phaser.GameObjects.Container>} */
    this.hamletMarkers = new Map();
    /** @type {Map<string, Phaser.GameObjects.Container>} */
    this.cityMarkers = new Map();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.cameraStart = { x: 0, y: 0 };
  }

  /**
   * @param {{ view?: object, callbacks?: WorldHexCallbacks, selectedCityId?: string, selectedHamletId?: string }} data
   */
  init(data = {}) {
    const pending = consumePendingWorldBootstrap();
    if (pending) {
      this.view = pending.view;
      this.selectedCityId = pending.selectedCityId ?? 'anoria';
      this.selectedHamletId = pending.selectedHamletId ?? null;
      this.callbacks = {
        onCitySelected: pending.onCitySelected,
        onHamletSelected: pending.onHamletSelected,
      };
      return;
    }

    if (data.view) this.view = data.view;
    if (data.callbacks) this.callbacks = data.callbacks;
    if (data.selectedCityId) this.selectedCityId = data.selectedCityId;
    if (data.selectedHamletId) this.selectedHamletId = data.selectedHamletId;
  }

  preload() {
    loadKenneyHexAtlases(this.load);
  }

  create() {
    this.worldRoot = this.add.container(0, 0);
    this.terrainLayer = this.add.container(0, 0);
    this.hamletsLayer = this.add.container(0, 0);
    this.citiesLayer = this.add.container(0, 0);
    this.hoverGraphics = this.add.graphics();
    this.worldRoot.add([this.terrainLayer, this.hamletsLayer, this.citiesLayer, this.hoverGraphics]);

    this.drawTerrain(this.view);
    if (this.view) {
      this.drawHamlets(this.view);
      this.drawCities(this.view);
    }

    this.setupCamera();
    this.setupInput();
    this.scale.on('resize', () => this.fitCamera());
    this.fitCamera();
  }

  /**
   * @param {object | null} view
   * @returns {Set<string>}
   */
  buildLockedHexKeys(view) {
    const keys = new Set();
    for (const hamlet of view?.hamlets ?? []) {
      if (hamlet.access === HAMLET_ACCESS.locked && hamlet.map?.hex) {
        keys.add(hexKey(hamlet.map.hex));
      }
    }
    return keys;
  }

  /**
   * @param {object | null} view
   */
  drawTerrain(view) {
    if (!this.terrainLayer) return;
    this.terrainLayer.removeAll(true);
    this.terrainTiles.clear();

    const lockedHexKeys = this.buildLockedHexKeys(view);

    for (const tile of WORLD_MAP_LAND_TILES) {
      const frame = resolveKenneyPhaserFrame(tile.terrain);
      if (!frame) continue;

      const key = hexKey(tile);
      const { x, y } = axialToPixel(tile, WORLD_MAP_HEX_SIZE);
      const image = this.add.image(x, y, frame.textureKey, frame.frame);
      image.setOrigin(0.5, 0.55);

      if (lockedHexKeys.has(key)) {
        image.setTint(LOCKED_TERRAIN_TINT);
        image.setAlpha(LOCKED_TERRAIN_ALPHA);
      }

      this.terrainLayer.add(image);
      this.terrainTiles.set(key, image);
    }

    this.applyLockedTerrainHighlights();
  }

  applyLockedTerrainHighlights() {
    const lockedHexKeys = this.buildLockedHexKeys(this.view);

    for (const [key, image] of this.terrainTiles) {
      if (!lockedHexKeys.has(key)) continue;

      image.clearTint();
      image.setTint(LOCKED_TERRAIN_TINT);

      const hamlet = this.view?.hamlets?.find(
        (item) => item.access === HAMLET_ACCESS.locked && hexKey(item.map?.hex ?? {}) === key
      );
      const isSelected = hamlet?.id === this.selectedHamletId;
      image.setAlpha(isSelected ? 0.95 : LOCKED_TERRAIN_ALPHA);
    }
  }

  createLockBadge() {
    const badge = this.add.container(0, -6);
    const plate = this.add.circle(0, 0, 14, 0x1d2228, 0.82);
    plate.setStrokeStyle(1.5, 0xc9bba8, 0.9);

    const shackle = this.add.graphics();
    shackle.lineStyle(2, 0xc9bba8, 1);
    shackle.strokeCircle(0, -2, 4);
    shackle.lineBetween(-4, -2, -4, 2);
    shackle.lineBetween(4, -2, 4, 2);
    shackle.lineBetween(-4, 2, 4, 2);

    const body = this.add.graphics();
    body.fillStyle(0xc9bba8, 1);
    body.fillRoundedRect(-5, 2, 10, 8, 2);

    badge.add([plate, shackle, body]);
    badge.setData('hitTarget', plate);
    return badge;
  }

  /**
   * @param {object} hamlet
   * @param {{ textureKey: string, frame: string }} frame
   * @param {number} x
   * @param {number} y
   */
  createHamletMarker(hamlet, frame, x, y) {
    const isLocked = hamlet.access === HAMLET_ACCESS.locked;
    const marker = this.add.container(x, y);

    const building = this.add.image(0, 0, frame.textureKey, frame.frame);
    building.setOrigin(0.5, 0.55);
    building.setScale(0.88);

    let lockBadge = null;
    if (isLocked) {
      building.setVisible(false);
      lockBadge = this.createLockBadge();
    }

    const label = this.add.text(0, isLocked ? 18 : 38, hamlet.name, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '11px',
      color: isLocked ? LOCKED_LABEL_COLOR : '#e8edf2',
      fontStyle: isLocked ? 'italic' : 'normal',
      stroke: '#1d2228',
      strokeThickness: 3,
    });
    label.setOrigin(0.5, 0);
    if (isLocked) {
      label.setAlpha(0.82);
    }

    marker.add(building);
    if (lockBadge) {
      marker.add(lockBadge);
    }
    marker.add(label);
    marker.setData('hamletId', hamlet.id);
    marker.setData('access', hamlet.access);
    marker.setData('building', building);
    marker.setData('label', label);
    marker.setData('lockBadge', lockBadge);

    const hitTarget = isLocked ? lockBadge?.getData('hitTarget') : building;
    hitTarget?.setInteractive({ useHandCursor: true, pixelPerfect: false });
    hitTarget?.on('pointerdown', () => {
      this.selectHamlet(hamlet.id);
      this.callbacks.onHamletSelected?.(hamlet.id);
    });

    return marker;
  }

  /**
   * @param {object} view
   */
  drawHamlets(view) {
    if (!this.hamletsLayer) return;
    this.hamletsLayer.removeAll(true);
    this.hamletMarkers.clear();

    for (const hamlet of view.hamlets ?? []) {
      const hex = hamlet.map?.hex;
      const spriteKey = hamlet.map?.sprite ?? 'hamlet';
      if (!hex) continue;

      const frame = resolveKenneyPhaserFrame(spriteKey);
      if (!frame) continue;

      const { x, y } = axialToPixel(hex, WORLD_MAP_HEX_SIZE);
      const marker = this.createHamletMarker(hamlet, frame, x, y);
      this.applyHamletMarkerStyle(marker);
      this.hamletsLayer.add(marker);
      this.hamletMarkers.set(hamlet.id, marker);
    }
  }

  /**
   * @param {Phaser.GameObjects.Container} marker
   */
  applyHamletMarkerStyle(marker) {
    const building = marker.getData('building');
    const label = marker.getData('label');
    const lockBadge = marker.getData('lockBadge');
    const hamletId = marker.getData('hamletId');
    const access = marker.getData('access');
    const isSelected = hamletId === this.selectedHamletId;
    const isLocked = access === HAMLET_ACCESS.locked;

    marker.setScale(isSelected ? 1.1 : 1);

    if (isLocked) {
      lockBadge?.setScale(isSelected ? 1.1 : 1);
      label?.setAlpha(isSelected ? 0.95 : 0.82);
      return;
    }

    if (building?.clearTint) {
      building.clearTint();
    }

    if (access === HAMLET_ACCESS.active) {
      building.setTint(HAMLET_ACTIVE_TINT);
    } else {
      building.setTint(HAMLET_UNLOCKED_TINT);
    }
  }

  /**
   * @param {string} hamletId
   */
  selectHamlet(hamletId) {
    this.selectedHamletId = hamletId;
    this.selectedCityId = null;
    for (const marker of this.hamletMarkers.values()) {
      this.applyHamletMarkerStyle(marker);
    }
    for (const [id, marker] of this.cityMarkers) {
      this.applyCityMarkerStyle(marker, id);
    }
    this.applyLockedTerrainHighlights();
  }

  /**
   * @param {object} view
   */
  drawCities(view) {
    if (!this.citiesLayer) return;
    this.citiesLayer.removeAll(true);
    this.cityMarkers.clear();

    for (const city of view.cities) {
      const hex = city.map?.hex;
      const spriteKey = city.map?.sprite ?? 'village';
      if (!hex) continue;

      const frame = resolveKenneyPhaserFrame(spriteKey);
      if (!frame) continue;

      const { x, y } = axialToPixel(hex, WORLD_MAP_HEX_SIZE);
      const marker = this.add.container(x, y);

      const building = this.add.image(0, 0, frame.textureKey, frame.frame);
      building.setOrigin(0.5, 0.55);
      building.setInteractive({ useHandCursor: true, pixelPerfect: false });

      const label = this.add.text(0, 42, city.name, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        color: '#f4f5f6',
        stroke: '#1d2228',
        strokeThickness: 3,
      });
      label.setOrigin(0.5, 0);

      marker.add([building, label]);
      marker.setData('cityId', city.id);
      marker.setData('category', city.category);

      building.on('pointerdown', () => {
        this.selectCity(city.id);
        this.callbacks.onCitySelected?.(city.id);
      });

      this.applyCityMarkerStyle(marker, city.id);
      this.citiesLayer.add(marker);
      this.cityMarkers.set(city.id, marker);
    }
  }

  /**
   * @param {Phaser.GameObjects.Container} marker
   * @param {string} cityId
   */
  applyCityMarkerStyle(marker, cityId) {
    const building = marker.list[0];
    const category = marker.getData('category');
    const isSelected = cityId === this.selectedCityId && !this.selectedHamletId;

    if (building?.clearTint) {
      building.clearTint();
    }

    marker.setScale(isSelected ? 1.1 : 1);

    if (isSelected) {
      return;
    }

    if (category === TRADE_MAP_CITY_CATEGORIES.enemy) {
      building.setTint(0xcc6666);
    } else if (cityId === 'anoria') {
      building.setTint(0xffd4a8);
    }
  }

  /**
   * @param {string} cityId
   */
  selectCity(cityId) {
    this.selectedCityId = cityId;
    this.selectedHamletId = null;
    for (const [id, marker] of this.cityMarkers) {
      this.applyCityMarkerStyle(marker, id);
    }
    for (const marker of this.hamletMarkers.values()) {
      this.applyHamletMarkerStyle(marker);
    }
    this.applyLockedTerrainHighlights();
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(OCEAN_COLOR);
    cam.setZoom(0.85);
  }

  fitCamera() {
    const cam = this.cameras.main;
    cam.centerOn(0, 0);
  }

  setupInput() {
    const cam = this.cameras.main;

    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nextZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.0015, 0.45, 1.6);
      cam.setZoom(nextZoom);
    });

    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return;
      this.isDragging = pointer.middleButtonDown() || !this.hitMarker(pointer);
      this.dragStart = { x: pointer.x, y: pointer.y };
      this.cameraStart = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointermove', (pointer) => {
      const world = cam.getWorldPoint(pointer.x, pointer.y);
      this.drawHoverHex(world.x, world.y);

      if (!this.isDragging || !pointer.isDown) return;
      const dx = (pointer.x - this.dragStart.x) / cam.zoom;
      const dy = (pointer.y - this.dragStart.y) / cam.zoom;
      cam.scrollX = this.cameraStart.x - dx;
      cam.scrollY = this.cameraStart.y - dy;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  /**
   * @param {Phaser.Input.Pointer} pointer
   */
  hitMarker(pointer) {
    const cam = this.cameras.main;
    const world = cam.getWorldPoint(pointer.x, pointer.y);
    for (const marker of this.cityMarkers.values()) {
      const building = marker.list[0];
      if (building?.getBounds?.().contains(world.x, world.y)) {
        return true;
      }
    }
    for (const marker of this.hamletMarkers.values()) {
      const lockBadge = marker.getData('lockBadge');
      const hitTarget = lockBadge?.getData('hitTarget') ?? marker.getData('building');
      if (hitTarget?.getBounds?.().contains(world.x, world.y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {number} worldX
   * @param {number} worldY
   */
  drawHoverHex(worldX, worldY) {
    if (!this.hoverGraphics) return;
    this.hoverGraphics.clear();

    const hex = pixelToAxial(worldX, worldY, WORLD_MAP_HEX_SIZE);
    if (!isWorldMapLandHex(hex)) return;

    const center = axialToPixel(hex, WORLD_MAP_HEX_SIZE);
    const corners = hexCornerPoints(WORLD_MAP_HEX_SIZE * 0.98);

    this.hoverGraphics.lineStyle(2, HOVER_COLOR, 0.65);
    this.hoverGraphics.beginPath();
    this.hoverGraphics.moveTo(center.x + corners[0].x, center.y + corners[0].y);
    for (let i = 1; i < corners.length; i += 1) {
      this.hoverGraphics.lineTo(center.x + corners[i].x, center.y + corners[i].y);
    }
    this.hoverGraphics.closePath();
    this.hoverGraphics.strokePath();
  }

  /**
   * @param {object} view
   * @param {{ cityId?: string | null, hamletId?: string | null }} [selection]
   */
  refresh(view, selection = {}) {
    this.view = view;
    if (selection.cityId !== undefined) {
      this.selectedCityId = selection.cityId;
    }
    if (selection.hamletId !== undefined) {
      this.selectedHamletId = selection.hamletId;
    }
    this.drawTerrain(view);
    this.drawHamlets(view);
    this.drawCities(view);
  }
}
