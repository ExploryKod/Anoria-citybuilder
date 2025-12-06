/**
 * Tests pour utils.js
 * 
 * Ce module contient des fonctions utilitaires pures :
 * - Génération d'identifiants pour la base de données
 * - Récupération des prix des bâtiments
 * - Vérification de disponibilité des zones de construction
 */

import { 
    makeDbItemId,
    getAssetPrice,
    isAreaAvailableForBuilding
} from '../src/js/utils/utils.js';

// ============================================================================
// makeDbItemId - Génère un identifiant unique pour IndexedDB
// Format: "buildingType-x-y" (ex: "Farm-Wheat-5-3")
// ============================================================================
describe('makeDbItemId', () => {
    
    describe('Génération d\'ID valide', () => {
        test('crée un ID au format "type-x-y"', () => {
            const id = makeDbItemId('Farm-Wheat', 5, 3);
            
            expect(id).toBe('Farm-Wheat-5-3');
        });

        test('fonctionne avec des coordonnées à 0', () => {
            const id = makeDbItemId('House-Blue', 0, 0);
            
            expect(id).toBe('House-Blue-0-0');
        });

        test('fonctionne avec de grandes coordonnées', () => {
            const id = makeDbItemId('roads', 15, 15);
            
            expect(id).toBe('roads-15-15');
        });
    });

    describe('Validation du buildingId', () => {
        test('retourne false si buildingId est undefined', () => {
            expect(makeDbItemId(undefined, 5, 3)).toBe(false);
        });

        test('retourne false si buildingId est null', () => {
            expect(makeDbItemId(null, 5, 3)).toBe(false);
        });

        test('retourne false si buildingId est vide', () => {
            expect(makeDbItemId('', 5, 3)).toBe(false);
        });

        test('retourne false si buildingId n\'est pas une chaîne', () => {
            expect(makeDbItemId(123, 5, 3)).toBe(false);
        });
    });

    describe('Validation des coordonnées x et y', () => {
        test('retourne false si x est undefined', () => {
            expect(makeDbItemId('Farm-Wheat', undefined, 3)).toBe(false);
        });

        test('retourne false si y est undefined', () => {
            expect(makeDbItemId('Farm-Wheat', 5, undefined)).toBe(false);
        });

        test('retourne false si x est null', () => {
            expect(makeDbItemId('Farm-Wheat', null, 3)).toBe(false);
        });

        test('retourne false si y est null', () => {
            expect(makeDbItemId('Farm-Wheat', 5, null)).toBe(false);
        });

        test('retourne false si x est NaN', () => {
            expect(makeDbItemId('Farm-Wheat', NaN, 3)).toBe(false);
        });

        test('retourne false si y est NaN', () => {
            expect(makeDbItemId('Farm-Wheat', 5, NaN)).toBe(false);
        });
    });
});

// ============================================================================
// getAssetPrice - Récupère le prix d'un bâtiment depuis le catalogue
// ============================================================================
describe('getAssetPrice', () => {
    
    // Catalogue de prix pour les tests
    const testPrices = {
        'House-Blue': { price: 10 },
        'House-Red': { price: 20 },
        'Farm-Wheat': { price: 10 },
        'Farm-Carrot': { price: 20 },
        'Market-Stall': { price: 25 },
        'roads': { price: 5 }
    };

    describe('Récupération de prix valides', () => {
        test('retourne le prix d\'une maison bleue', () => {
            expect(getAssetPrice('House-Blue', testPrices)).toBe(10);
        });

        test('retourne le prix d\'une route', () => {
            expect(getAssetPrice('roads', testPrices)).toBe(5);
        });

        test('retourne le prix d\'un marché', () => {
            expect(getAssetPrice('Market-Stall', testPrices)).toBe(25);
        });
    });

    describe('Bâtiments non trouvés', () => {
        test('retourne undefined pour un bâtiment inconnu', () => {
            expect(getAssetPrice('Unknown-Building', testPrices)).toBeUndefined();
        });
    });

    describe('Validation des paramètres', () => {
        test('retourne null si assetsPrices est null', () => {
            expect(getAssetPrice('House-Blue', null)).toBe(null);
        });

        test('retourne null si assetsPrices est undefined', () => {
            expect(getAssetPrice('House-Blue', undefined)).toBe(null);
        });
    });
});

// ============================================================================
// isAreaAvailableForBuilding - Vérifie si une zone est libre pour construire
// ============================================================================
describe('isAreaAvailableForBuilding', () => {
    
    /**
     * Crée une ville de test avec une grille vide
     * @param {number} size - Taille de la ville (ex: 16x16)
     * @returns {Object} Objet ville avec tiles vides
     */
    function createEmptyCity(size) {
        const tiles = [];
        for (let x = 0; x < size; x++) {
            tiles[x] = [];
            for (let y = 0; y < size; y++) {
                tiles[x][y] = {}; // Tuile vide (pas de buildingId)
            }
        }
        return { size, tiles };
    }

    /**
     * Place un bâtiment dans la ville
     * @param {Object} city - La ville
     * @param {number} x - Coordonnée X
     * @param {number} y - Coordonnée Y
     * @param {string} buildingId - ID du bâtiment
     */
    function placeBuilding(city, x, y, buildingId) {
        if (city.tiles[x] && city.tiles[x][y]) {
            city.tiles[x][y].buildingId = buildingId;
        }
    }

    describe('Zone libre pour construction 1x1', () => {
        test('retourne true si la tuile est vide', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, 1)).toBe(true);
        });

        test('retourne false si la tuile est occupée', () => {
            const city = createEmptyCity(16);
            placeBuilding(city, 5, 5, 'House-Blue');
            
            expect(isAreaAvailableForBuilding(city, 5, 5, 1)).toBe(false);
        });
    });

    describe('Zone libre pour construction 2x2', () => {
        test('retourne true si toutes les 4 tuiles sont vides', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, 2)).toBe(true);
        });

        test('retourne false si une des 4 tuiles est occupée', () => {
            const city = createEmptyCity(16);
            placeBuilding(city, 6, 5, 'Farm-Wheat'); // Tuile adjacente occupée
            
            expect(isAreaAvailableForBuilding(city, 5, 5, 2)).toBe(false);
        });
    });

    describe('Limites de la carte', () => {
        test('retourne false si la zone dépasse les limites (X)', () => {
            const city = createEmptyCity(16);
            
            // Position 15 avec taille 2 → dépassement (15 + 1 = 16 >= size)
            expect(isAreaAvailableForBuilding(city, 15, 5, 2)).toBe(false);
        });

        test('retourne false si la zone dépasse les limites (Y)', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 15, 2)).toBe(false);
        });

        test('retourne true au coin mais dans les limites', () => {
            const city = createEmptyCity(16);
            
            // Position 14 avec taille 2 → OK (14 + 1 = 15 < 16)
            expect(isAreaAvailableForBuilding(city, 14, 14, 2)).toBe(true);
        });
    });

    describe('Validation de gridSize', () => {
        test('retourne false si gridSize est undefined', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, undefined)).toBe(false);
        });

        test('retourne false si gridSize est null', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, null)).toBe(false);
        });

        test('retourne false si gridSize est 0', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, 0)).toBe(false);
        });

        test('retourne false si gridSize est négatif', () => {
            const city = createEmptyCity(16);
            
            expect(isAreaAvailableForBuilding(city, 5, 5, -1)).toBe(false);
        });
    });
});

