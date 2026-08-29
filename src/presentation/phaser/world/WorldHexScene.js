import Phaser from 'phaser';
import { resolveKenneyPhaserFrame } from '../../../contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { TRADE_MAP_CITY_CATEGORIES } from '../../../contexts/commerce/domain/catalogs/TradeMapCityCatalog.js';
import {
  WORLD_MAP_HEX_SIZE,
  WORLD_MAP_LAND_TILES,
  isWorldMapLandHex,
} from '../../../contexts/geography/domain/world/worldMapDefinition.js';
import { axialToPixel, hexCornerPoints, pixelToAxial } from '../../../shared/geography/hexCoordinates.js';
import { loadKenneyHexAtlases } from '../shared/loadKenneyHexAtlases.js';
import { consumePendingWorldBootstrap } from './worldMapBootstrapState.js';

export const WORLD_HEX_SCENE_KEY = 'WorldHexScene';

const OCEAN_COLOR = 0x1a3a5c;
const HOVER_COLOR = 0xfb8122;
const SELECTED_COLOR = 0x3dba7a;

/**
 * @typedef {{
 *   onCitySelected?: (cityId: string) => void,
 *   onKingdomNavigate?: () => void,
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
    /** @type {Phaser.GameObjects.Container | null} */
    this.worldRoot = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.terrainLayer = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.citiesLayer = null;
    /** @type {Phaser.GameObjects.Graphics | null} */
    this.hoverGraphics = null;
    /** @type {Map<string, Phaser.GameObjects.Container>} */
    this.cityMarkers = new Map();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.cameraStart = { x: 0, y: 0 };
  }

  /**
   * @param {{ view?: object, callbacks?: WorldHexCallbacks, selectedCityId?: string }} data
   */
  init(data = {}) {
    const pending = consumePendingWorldBootstrap();
    if (pending) {
      this.view = pending.view;
      this.selectedCityId = pending.selectedCityId ?? 'anoria';
      this.callbacks = {
        onCitySelected: pending.onCitySelected,
        onKingdomNavigate: pending.onKingdomNavigate,
      };
      return;
    }

    if (data.view) this.view = data.view;
    if (data.callbacks) this.callbacks = data.callbacks;
    if (data.selectedCityId) this.selectedCityId = data.selectedCityId;
  }

  preload() {
    loadKenneyHexAtlases(this.load);
  }

  create() {
    this.worldRoot = this.add.container(0, 0);
    this.terrainLayer = this.add.container(0, 0);
    this.citiesLayer = this.add.container(0, 0);
    this.hoverGraphics = this.add.graphics();
    this.worldRoot.add([this.terrainLayer, this.citiesLayer, this.hoverGraphics]);

    this.drawTerrain();
    if (this.view) {
      this.drawCities(this.view);
    }

    this.setupCamera();
    this.setupInput();
    this.scale.on('resize', () => this.fitCamera());
    this.fitCamera();
  }

  drawTerrain() {
    if (!this.terrainLayer) return;
    this.terrainLayer.removeAll(true);

    for (const tile of WORLD_MAP_LAND_TILES) {
      const frame = resolveKenneyPhaserFrame(tile.terrain);
      if (!frame) continue;

      const { x, y } = axialToPixel(tile, WORLD_MAP_HEX_SIZE);
      const image = this.add.image(x, y, frame.textureKey, frame.frame);
      image.setOrigin(0.5, 0.55);
      this.terrainLayer.add(image);
    }
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
        if (city.id === 'anoria') {
          this.callbacks.onKingdomNavigate?.();
        } else {
          this.callbacks.onCitySelected?.(city.id);
        }
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
    const isSelected = cityId === this.selectedCityId;

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
    for (const [id, marker] of this.cityMarkers) {
      this.applyCityMarkerStyle(marker, id);
    }
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
      this.isDragging = pointer.middleButtonDown() || !this.hitCity(pointer);
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
  hitCity(pointer) {
    const cam = this.cameras.main;
    const world = cam.getWorldPoint(pointer.x, pointer.y);
    for (const marker of this.cityMarkers.values()) {
      const building = marker.list[0];
      if (building?.getBounds?.().contains(world.x, world.y)) {
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
   * @param {string} [selectedCityId]
   */
  refresh(view, selectedCityId) {
    this.view = view;
    if (selectedCityId !== undefined) {
      this.selectedCityId = selectedCityId;
    }
    this.drawCities(view);
  }
}
