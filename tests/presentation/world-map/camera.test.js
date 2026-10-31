/**
 * The world map's camera: the geometry the player feels (zoom under the finger, the whole map fitting a small screen, a marker a finger can hit).
 */
import { describe, test, expect } from '@jest/globals';
import {
  fitZoom,
  keepCenterOver,
  panBy,
  rectHit,
  screenToWorld,
  worldToScreen,
  zoomAround,
} from '../../../src/presentation/world-map/canvas/camera.js';

const viewport = { width: 800, height: 600 };

describe('world map camera', () => {
  test('zooming around a point keeps the world point under that screen point', () => {
    const camera = { x: 120, y: -40, zoom: 0.85 };
    const before = screenToWorld(camera, viewport, 610, 140);
    const zoomed = zoomAround(camera, viewport, 1.4, 610, 140);
    const after = worldToScreen(zoomed, viewport, before.x, before.y);
    expect(zoomed.zoom).toBe(1.4);
    expect(after.x).toBeCloseTo(610, 6);
    expect(after.y).toBeCloseTo(140, 6);
  });

  test('the zoom that fits a map shows all of it in a small view, and a drag moves the map with the finger', () => {
    const phone = { width: 360, height: 640 };
    const zoom = fitZoom(phone, { width: 1300, height: 1100 });
    expect(1300 * zoom).toBeLessThanOrEqual(phone.width);
    expect(1100 * zoom).toBeLessThanOrEqual(phone.height);

    const camera = { x: 0, y: 0, zoom: 0.5 };
    const moved = panBy(camera, 30, -20);
    // The map follows the finger: the point that was under (100, 100) is under (130, 80).
    const point = screenToWorld(camera, viewport, 100, 100);
    const now = worldToScreen(moved, viewport, point.x, point.y);
    expect(now.x).toBeCloseTo(130, 6);
    expect(now.y).toBeCloseTo(80, 6);
  });

  test('the camera keeps its centre over the map, and a small marker is a finger wide', () => {
    const bounds = { minX: -600, minY: -500, maxX: 600, maxY: 500 };
    const lost = keepCenterOver({ x: 9000, y: -9000, zoom: 1 }, bounds, 150);
    expect(lost).toEqual({ x: 750, y: -650, zoom: 1 });

    const marker = { left: 100, top: 100, width: 20, height: 20 };
    expect(rectHit(marker, 125, 110, 44)).toBe(true);
    expect(rectHit(marker, 160, 110, 44)).toBe(false);
  });
});
