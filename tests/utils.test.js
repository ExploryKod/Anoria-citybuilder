/**
 * Tests pour utils.js
 *
 * Ce module contient des fonctions utilitaires :
 * - Récupération des prix des bâtiments
 * - Vérification de disponibilité des zones de construction
 * - Filtrage et manipulation d'assets
 *
 * Identifiants bâtiment : tests/contexts/urban/buildingId.behavior.test.js
 */

import {
    getAssetPrice,
    isAreaAvailableForBuilding,
    getAssetsByCategory,
    updateAssetsPrices,
    getBuildingNeighbors
} from '../src/js/utils/utils.js';

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

// ============================================================================
// getAssetsByCategory - Filtre les assets par catégorie
// ============================================================================
describe('getAssetsByCategory', () => {
    
    const testAssets = {
        'House-Blue': { category: 'residential', price: 10 },
        'House-Red': { category: 'residential', price: 20 },
        'Farm-Wheat': { category: 'production', price: 15 },
        'Farm-Carrot': { category: 'production', price: 20 },
        'Market-Stall': { category: 'commercial', price: 25 },
        'roads': { category: 'infrastructure', price: 5 }
    };

    describe('Filtrage par catégorie', () => {
        test('retourne tous les assets de la catégorie "residential"', () => {
            const result = getAssetsByCategory('residential', testAssets);
            
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('House-Blue');
            expect(result[1].id).toBe('House-Red');
            expect(result[0].category).toBe('residential');
        });

        test('retourne tous les assets de la catégorie "production"', () => {
            const result = getAssetsByCategory('production', testAssets);
            
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('Farm-Wheat');
            expect(result[1].id).toBe('Farm-Carrot');
        });

        test('retourne un tableau vide si aucune catégorie correspondante', () => {
            const result = getAssetsByCategory('nonexistent', testAssets);
            
            expect(result).toEqual([]);
        });
    });

    describe('Structure des résultats', () => {
        test('chaque résultat contient l\'id et toutes les propriétés de l\'asset', () => {
            const result = getAssetsByCategory('residential', testAssets);
            
            expect(result[0]).toHaveProperty('id', 'House-Blue');
            expect(result[0]).toHaveProperty('category', 'residential');
            expect(result[0]).toHaveProperty('price', 10);
        });
    });

    describe('Cas limites', () => {
        test('retourne un tableau vide si assets est vide', () => {
            const result = getAssetsByCategory('residential', {});
            
            expect(result).toEqual([]);
        });

        test('gère les assets sans catégorie', () => {
            const assetsWithoutCategory = {
                'House-Blue': { price: 10 }
            };
            
            const result = getAssetsByCategory('residential', assetsWithoutCategory);
            
            expect(result).toEqual([]);
        });
    });
});

// ============================================================================
// updateAssetsPrices - Met à jour les prix des assets
// ============================================================================
describe('updateAssetsPrices', () => {
    
    const initialAssets = {
        'House-Blue': { category: 'residential', price: 10 },
        'House-Red': { category: 'residential', price: 20 },
        'Farm-Wheat': { category: 'production', price: 15 }
    };

    describe('Mise à jour avec nombre', () => {
        test('met à jour un prix unique', () => {
            const updates = { 'House-Blue': 15 };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result['House-Blue'].price).toBe(15);
            expect(result['House-Red'].price).toBe(20); // Inchangé
        });

        test('met à jour plusieurs prix en une fois', () => {
            const updates = {
                'House-Blue': 12,
                'House-Red': 25
            };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result['House-Blue'].price).toBe(12);
            expect(result['House-Red'].price).toBe(25);
            expect(result['Farm-Wheat'].price).toBe(15); // Inchangé
        });
    });

    describe('Mise à jour avec objet', () => {
        test('met à jour avec un objet contenant price', () => {
            const updates = {
                'House-Blue': { price: 18 }
            };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result['House-Blue'].price).toBe(18);
        });
    });

    describe('Préservation des autres propriétés', () => {
        test('préserve les propriétés autres que price', () => {
            const updates = { 'House-Blue': 15 };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result['House-Blue'].category).toBe('residential');
            expect(result['House-Red'].category).toBe('residential');
        });
    });

    describe('Immutabilité', () => {
        test('retourne un nouvel objet (ne modifie pas l\'original)', () => {
            const updates = { 'House-Blue': 15 };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result).not.toBe(initialAssets);
            expect(initialAssets['House-Blue'].price).toBe(10); // Original inchangé
        });

        test('retourne un objet frozen (immutable)', () => {
            const updates = { 'House-Blue': 15 };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(Object.isFrozen(result)).toBe(true);
        });
    });

    describe('Assets non existants', () => {
        test('crée un nouvel asset si l\'id n\'existe pas', () => {
            const updates = { 'New-Building': 30 };
            const result = updateAssetsPrices(updates, initialAssets);
            
            expect(result['New-Building']).toBeDefined();
            expect(result['New-Building'].price).toBe(30);
        });
    });
});

// ============================================================================
// getBuildingNeighbors - Trouve un voisin dans la liste des voisins
// ============================================================================
describe('getBuildingNeighbors', () => {
    
    describe('Trouve un voisin existant', () => {
        test('retourne le nom du voisin trouvé', () => {
            const building = {
                userData: {
                    neighborsNames: ['House-Blue', 'Farm-Wheat', 'roads']
                }
            };
            const neighbors = ['Farm-Wheat', 'Market-Stall'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe('Farm-Wheat');
        });

        test('retourne le premier voisin trouvé si plusieurs correspondances', () => {
            const building = {
                userData: {
                    neighborsNames: ['House-Blue', 'Farm-Wheat', 'roads']
                }
            };
            const neighbors = ['Farm-Wheat', 'House-Blue'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            // Devrait retourner le premier trouvé dans neighborsNames
            expect(['Farm-Wheat', 'House-Blue']).toContain(result);
        });
    });

    describe('Aucun voisin trouvé', () => {
        test('retourne false si aucun voisin ne correspond', () => {
            const building = {
                userData: {
                    neighborsNames: ['House-Blue', 'Farm-Wheat']
                }
            };
            const neighbors = ['Market-Stall', 'roads'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe(false);
        });
    });

    describe('Cas limites', () => {
        test('retourne false si building n\'a pas de userData', () => {
            const building = {};
            const neighbors = ['House-Blue'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe(false);
        });

        test('retourne false si userData n\'a pas de neighborsNames', () => {
            const building = {
                userData: {}
            };
            const neighbors = ['House-Blue'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe(false);
        });

        test('retourne false si neighbors est vide', () => {
            const building = {
                userData: {
                    neighborsNames: ['House-Blue']
                }
            };
            const neighbors = [];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe(false);
        });

        test('retourne false si neighborsNames est vide', () => {
            const building = {
                userData: {
                    neighborsNames: []
                }
            };
            const neighbors = ['House-Blue'];
            
            const result = getBuildingNeighbors(building, neighbors);
            
            expect(result).toBe(false);
        });
    });
});

