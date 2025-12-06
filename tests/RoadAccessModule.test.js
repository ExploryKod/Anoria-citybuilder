/**
 * Tests pour RoadAccessModule
 * 
 * RoadAccessModule gère l'accès routier des bâtiments :
 * - Détection de la présence de routes dans les voisins
 * - Comptage du nombre de routes adjacentes
 * - Mise à jour depuis les données de la base
 * 
 * Logique simple avec données mockées - facile à tester.
 */

import { RoadAccessModule } from '../src/js/game/modules/RoadAccessModule.js';

// ============================================================================
// Tests pour RoadAccessModule
// ============================================================================
describe('RoadAccessModule', () => {
    let roadModule;

    beforeEach(() => {
        // Créer une nouvelle instance pour chaque test
        roadModule = new RoadAccessModule({});
    });

    // ========================================================================
    // checkRoadAccess - Détection d'accès routier
    // ========================================================================
    describe('checkRoadAccess', () => {
        
        test('retourne true si une route est présente (propriété isRoad)', () => {
            const neighbors = [
                { name: 'House-Blue', isRoad: false },
                { name: 'roads', isRoad: true },
                { name: 'Farm-Wheat', isRoad: false }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.value).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('retourne true si une route est détectée par userData.isRoad', () => {
            const neighbors = [
                { name: 'House-Blue', userData: { isRoad: false } },
                { name: 'Farm-Wheat', userData: { isRoad: true } }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('retourne true si une route est détectée par name === "roads"', () => {
            const neighbors = [
                { name: 'House-Blue' },
                { name: 'roads' },
                { name: 'Farm-Wheat' }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('retourne true si une route est détectée par name === "Road"', () => {
            const neighbors = [
                { name: 'House-Blue' },
                { name: 'Road' }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('retourne true si une route est détectée par buildingId === "roads"', () => {
            const neighbors = [
                { name: 'House-Blue', buildingId: 'House-Blue' },
                { name: 'Road', buildingId: 'roads' }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('compte plusieurs routes correctement', () => {
            const neighbors = [
                { name: 'roads', isRoad: true },
                { name: 'roads', isRoad: true },
                { name: 'House-Blue' }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(true);
            expect(roadModule.roadCount).toBe(2);
        });

        test('retourne false si aucune route', () => {
            const neighbors = [
                { name: 'House-Blue' },
                { name: 'Farm-Wheat' }
            ];
            
            const result = roadModule.checkRoadAccess(neighbors);
            
            expect(result).toBe(false);
            expect(roadModule.value).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });

        test('retourne false si neighbors est null', () => {
            const result = roadModule.checkRoadAccess(null);
            
            expect(result).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });

        test('retourne false si neighbors est undefined', () => {
            const result = roadModule.checkRoadAccess(undefined);
            
            expect(result).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });

        test('retourne false si neighbors n\'est pas un tableau', () => {
            const result = roadModule.checkRoadAccess({});
            
            expect(result).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });

        test('retourne false si neighbors est un tableau vide', () => {
            const result = roadModule.checkRoadAccess([]);
            
            expect(result).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });

        test('sauvegarde les voisins dans la propriété neighbors', () => {
            const neighbors = [
                { name: 'roads', isRoad: true },
                { name: 'House-Blue' }
            ];
            
            roadModule.checkRoadAccess(neighbors);
            
            expect(roadModule.neighbors).toEqual(neighbors);
        });
    });

    // ========================================================================
    // updateFromNeighbors - Mise à jour depuis la base de données
    // ========================================================================
    describe('updateFromNeighbors', () => {
        
        test('appelle checkRoadAccess avec les voisins fournis', () => {
            const neighbors = [
                { name: 'roads', isRoad: true }
            ];
            
            roadModule.updateFromNeighbors(neighbors);
            
            expect(roadModule.value).toBe(true);
            expect(roadModule.roadCount).toBe(1);
        });

        test('met à jour correctement même si pas de routes', () => {
            const neighbors = [
                { name: 'House-Blue' }
            ];
            
            roadModule.updateFromNeighbors(neighbors);
            
            expect(roadModule.value).toBe(false);
            expect(roadModule.roadCount).toBe(0);
        });
    });

    // ========================================================================
    // getRoadCount - Récupération du nombre de routes
    // ========================================================================
    describe('getRoadCount', () => {
        
        test('retourne 0 par défaut', () => {
            expect(roadModule.getRoadCount()).toBe(0);
        });

        test('retourne le nombre de routes après checkRoadAccess', () => {
            const neighbors = [
                { name: 'roads', isRoad: true },
                { name: 'roads', isRoad: true },
                { name: 'roads', isRoad: true }
            ];
            
            roadModule.checkRoadAccess(neighbors);
            
            expect(roadModule.getRoadCount()).toBe(3);
        });

        test('retourne 0 si aucune route détectée', () => {
            roadModule.checkRoadAccess([{ name: 'House-Blue' }]);
            
            expect(roadModule.getRoadCount()).toBe(0);
        });
    });

    // ========================================================================
    // toHTML - Génération HTML pour les panneaux d'info
    // ========================================================================
    describe('toHTML', () => {
        
        test('affiche "Yes" et le nombre de routes si accès disponible', () => {
            roadModule.checkRoadAccess([
                { name: 'roads', isRoad: true },
                { name: 'roads', isRoad: true }
            ]);
            
            const html = roadModule.toHTML();
            
            expect(html).toContain('Yes');
            expect(html).toContain('2 roads');
        });

        test('affiche "No" si pas d\'accès', () => {
            roadModule.checkRoadAccess([{ name: 'House-Blue' }]);
            
            const html = roadModule.toHTML();
            
            expect(html).toContain('No');
            expect(html).toContain('0 road');
        });

        test('utilise le singulier "road" pour 1 route', () => {
            roadModule.checkRoadAccess([{ name: 'roads', isRoad: true }]);
            
            const html = roadModule.toHTML();
            
            expect(html).toContain('1 road');
            expect(html).not.toContain('1 roads');
        });

        test('utilise le pluriel "roads" pour plusieurs routes', () => {
            roadModule.checkRoadAccess([
                { name: 'roads', isRoad: true },
                { name: 'roads', isRoad: true }
            ]);
            
            const html = roadModule.toHTML();
            
            expect(html).toContain('2 roads');
        });
    });

    // ========================================================================
    // dispose - Nettoyage des ressources
    // ========================================================================
    describe('dispose', () => {
        
        test('vide la liste des voisins', () => {
            roadModule.checkRoadAccess([{ name: 'roads', isRoad: true }]);
            expect(roadModule.neighbors.length).toBeGreaterThan(0);
            
            roadModule.dispose();
            
            expect(roadModule.neighbors).toEqual([]);
        });

        test('appelle dispose du parent (SimModule)', () => {
            roadModule.building = { test: 'object' };
            
            roadModule.dispose();
            
            expect(roadModule.building).toBeNull();
        });
    });
});

