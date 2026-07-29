/**
 * Tests de comportement — identifiants de bâtiment (BC Parcels)
 *
 * Couplés au contrat métier Published Language (`"{type}-{x}-{y}"`),
 * pas à la structure interne des value objects.
 */

import { describe, test, expect } from '@jest/globals';
import {
  createBuildingId,
  tryCreateBuildingId,
  toBuildingIdString,
  toPublishedBuildingId,
  parseBuildingId,
  tryParseBuildingId,
  resolvePublishedBuildingIdFromRef,
} from '../../../src/contexts/parcels/domain/value-objects/BuildingId.js';
import { createTileCoord, tryCreateTileCoord } from '../../../src/contexts/parcels/domain/value-objects/TileCoord.js';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';

describe('Identifiant de bâtiment', () => {
  describe('quand on identifie un bâtiment sur la grille', () => {
    test('produit la forme métier type-x-y', () => {
      const id = createBuildingId('House-Blue', 3, 7);

      expect(id.value).toBe('House-Blue-3-7');
      expect(id.type).toBe('House-Blue');
      expect(id.x).toBe(3);
      expect(id.y).toBe(7);
    });

    test('accepte les types composés (plusieurs tirets)', () => {
      expect(createBuildingId('Farm-Wheat', 5, 3).value).toBe('Farm-Wheat-5-3');
      expect(createBuildingId('StonePath-001', 1, 2).value).toBe('StonePath-001-1-2');
    });

    test('accepte les coordonnées 0', () => {
      expect(createBuildingId('roads', 0, 0).value).toBe('roads-0-0');
    });

    test('accepte des coordonnées numériques en string (legacy mesh/userData)', () => {
      expect(toBuildingIdString('House-Blue', '4', '2')).toBe('House-Blue-4-2');
    });
  });

  describe('quand les données sont invalides', () => {
    test('refuse un type vide ou absent', () => {
      expect(tryCreateBuildingId('', 1, 1)).toBeNull();
      expect(tryCreateBuildingId(null, 1, 1)).toBeNull();
      expect(toBuildingIdString(undefined, 1, 1)).toBeNull();
    });

    test('refuse des coordonnées non entières', () => {
      expect(tryCreateBuildingId('House-Blue', 1.5, 2)).toBeNull();
      expect(tryCreateBuildingId('House-Blue', NaN, 2)).toBeNull();
      expect(tryCreateBuildingId('House-Blue', null, 2)).toBeNull();
    });
  });

  describe('quand on relit un identifiant persisté', () => {
    test('retrouve type et tuile depuis la string IndexedDB', () => {
      const id = parseBuildingId('House-Purple-10-12');

      expect(id.type).toBe('House-Purple');
      expect(id.x).toBe(10);
      expect(id.y).toBe(12);
      expect(id.value).toBe('House-Purple-10-12');
    });

    test('parse les types avec plusieurs tirets', () => {
      const id = parseBuildingId('Farm-Wheat-5-3');
      expect(id.type).toBe('Farm-Wheat');
      expect(id.x).toBe(5);
      expect(id.y).toBe(3);
    });

    test('refuse une string mal formée', () => {
      expect(tryParseBuildingId('House-Blue')).toBeNull();
      expect(tryParseBuildingId('')).toBeNull();
      expect(tryParseBuildingId(null)).toBeNull();
    });
  });

  describe('tuile (TileCoord)', () => {
    test('représente une case de la grille', () => {
      expect(createTileCoord(2, 8)).toEqual({ x: 2, y: 8 });
    });

    test('refuse une case hors entiers', () => {
      expect(tryCreateTileCoord(1.2, 3)).toBeNull();
    });
  });

  describe('forme string pour la grille / IndexedDB', () => {
    test('toBuildingIdString produit type-x-y ou null', () => {
      expect(toBuildingIdString('Farm-Wheat', 5, 3)).toBe('Farm-Wheat-5-3');
      expect(toBuildingIdString('', 5, 3)).toBeNull();
      expect(toBuildingIdString('Farm-Wheat', undefined, 3)).toBeNull();
      expect(toBuildingIdString('Farm-Wheat', NaN, 3)).toBeNull();
    });
  });

  describe('quand le BC Parcels lit un bâtiment (snapshot)', () => {
    test('reconstruit BuildingId et TileCoord depuis l\'id IndexedDB', () => {
      const building = createBuildingSnapshot({
        id: 'House-Blue-3-7',
        type: 'House-Blue',
        neighbors: [{ name: 'roads', isRoad: true }],
        roadCount: 1,
      });

      expect(building.id).toBe('House-Blue-3-7');
      expect(building.buildingId).toEqual(
        createBuildingId('House-Blue', 3, 7)
      );
      expect(building.tile).toEqual({ x: 3, y: 7 });
      expect(building.x).toBe(3);
      expect(building.y).toBe(7);
    });

    test('conserve instanceId UUID comme clé Dexie (ne le remplace pas par type-x-y)', () => {
      const instanceId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      const building = createBuildingSnapshot({
        id: instanceId,
        type: 'House-Blue',
        x: 8,
        y: 10,
        neighbors: [],
        roadCount: 0,
      });

      expect(building.id).toBe(instanceId);
      expect(building.buildingId).toEqual(createBuildingId('House-Blue', 8, 10));
      expect(building.tile).toEqual({ x: 8, y: 10 });
    });

    test('Published Language accepte VO ou string', () => {
      const vo = createBuildingId('roads', 1, 2);
      expect(toPublishedBuildingId(vo)).toBe('roads-1-2');
      expect(toPublishedBuildingId('roads-1-2')).toBe('roads-1-2');
    });
  });

  describe('resolvePublishedBuildingIdFromRef (legacy blobs → Published Language)', () => {
    test('prefers id and buildingId', () => {
      expect(
        resolvePublishedBuildingIdFromRef({ id: 'Farm-Wheat-2-3', name: 'Farm-Wheat', x: 2, y: 3 })
      ).toBe('Farm-Wheat-2-3');
      expect(
        resolvePublishedBuildingIdFromRef({ buildingId: 'Market-Stall-4-5', type: 'Market-Stall', x: 4, y: 5 })
      ).toBe('Market-Stall-4-5');
    });

    test('uses published-looking name before reconstructing type-x-y (no ghost ids)', () => {
      expect(
        resolvePublishedBuildingIdFromRef({
          name: 'House-Purple-3-7',
          type: 'House-Purple',
          x: 3,
          y: 7,
        })
      ).toBe('House-Purple-3-7');
    });

    test('reconstructs from type + tile when name is bare type', () => {
      expect(
        resolvePublishedBuildingIdFromRef({ name: 'House-Purple', type: 'House-Purple', x: 3, y: 7 })
      ).toBe('House-Purple-3-7');
    });
  });
});
