/**
 * Tests pour config.js
 * 
 * Valide la structure et les valeurs de la configuration du jeu.
 * Ces tests servent aussi de documentation pour les paramètres disponibles.
 */

import { composeLegacyConfigMirror } from '../src/composition/facades/gameConfig.js';
import { assetsConfig, renderingConfig } from '../src/presentation/three/presentationConfig.js';

const config = {
  ...composeLegacyConfigMirror(),
  rendering: renderingConfig,
  assets: assetsConfig,
};

// ============================================================================
// Structure générale de la configuration
// ============================================================================
describe('config - Structure', () => {
    
    test('contient toutes les sections principales', () => {
        expect(config).toHaveProperty('simulation');
        expect(config).toHaveProperty('budget');
        expect(config).toHaveProperty('building');
        expect(config).toHaveProperty('citizens');
        expect(config).toHaveProperty('objectives');
        expect(config).toHaveProperty('employment');
        expect(config).toHaveProperty('ui');
        expect(config).toHaveProperty('rendering');
        expect(config).toHaveProperty('assets');
    });
});

// ============================================================================
// config.simulation - Paramètres de la simulation
// ============================================================================
describe('config.simulation', () => {
    
    test('définit les limites de vitesse du jeu', () => {
        expect(config.simulation.tickMsMin).toBeDefined();
        expect(config.simulation.tickMsMax).toBeDefined();
        expect(config.simulation.defaultTickMs).toBeDefined();
        
        // tickMsMin doit être inférieur à tickMsMax
        expect(config.simulation.tickMsMin).toBeLessThan(config.simulation.tickMsMax);
    });

    test('définit la taille de la ville', () => {
        expect(config.simulation.citySize).toBe(16);
    });

    test('définit la distance de distribution de nourriture', () => {
        // Distance en tuiles (Manhattan) pour la distribution marché → maisons
        expect(config.simulation.foodDistributionDistance).toBeDefined();
        expect(config.simulation.foodDistributionDistance).toBeGreaterThan(0);
    });
});

// ============================================================================
// config.budget - Paramètres financiers
// ============================================================================
describe('config.budget', () => {
    
    test('définit les fonds initiaux', () => {
        expect(config.budget.initialFunds).toBeDefined();
        expect(typeof config.budget.initialFunds).toBe('number');
        expect(config.budget.initialFunds).toBeGreaterThan(0);
    });
});

// ============================================================================
// config.employment - Système d'emploi
// ============================================================================
describe('config.employment', () => {
    
    describe('Secteurs d\'emploi', () => {
        test('définit 6 secteurs', () => {
            expect(config.employment.maxSectors).toBe(6);
        });

        test('tous les secteurs ont un nom', () => {
            const sectors = config.employment.sectors;
            
            expect(sectors[1]).toBe('Production Alimentaire');
            expect(sectors[2]).toBe('Commerces');
            expect(sectors[3]).toBe('Industries');
            expect(sectors[4]).toBe('Stockage');
            expect(sectors[5]).toBe('Infrastructure');
            expect(sectors[6]).toBe('Services Publics');
        });
    });

    describe('Priorités par défaut', () => {
        test('chaque secteur a une priorité par défaut', () => {
            const priorities = config.employment.defaultPriorities;
            
            // Toutes les priorités de 1 à 6 doivent être assignées
            const values = Object.values(priorities);
            expect(values).toContain(1);
            expect(values).toContain(2);
            expect(values).toContain(3);
            expect(values).toContain(4);
            expect(values).toContain(5);
            expect(values).toContain(6);
        });

        test('les priorités sont uniques (pas de doublons)', () => {
            const priorities = Object.values(config.employment.defaultPriorities);
            const uniquePriorities = [...new Set(priorities)];
            
            expect(priorities.length).toBe(uniquePriorities.length);
        });
    });

    describe('Mapping bâtiment → secteur', () => {
        const sectorMap = config.employment.buildingSectorMap;

        test('les fermes sont dans le secteur 1 (Production Alimentaire)', () => {
            expect(sectorMap['Farm-Wheat']).toBe(1);
            expect(sectorMap['Farm-Carrot']).toBe(1);
            expect(sectorMap['Farm-Cabbage']).toBe(1);
        });

        test('les marchés sont dans le secteur 2 (Commerces)', () => {
            expect(sectorMap['Market-Stall']).toBe(2);
        });

        test('les moulins et granges sont dans le secteur 4 (Stockage)', () => {
            expect(sectorMap['Windmill-001']).toBe(4);
            expect(sectorMap['Barn-001']).toBe(4);
        });

        test('les routes sont dans le secteur 5 (Infrastructure)', () => {
            expect(sectorMap['roads']).toBe(5);
        });
    });

    describe('Besoins en employés par bâtiment', () => {
        const buildingNeeds = config.employment.buildingNeeds;

        test('les fermes nécessitent 3 travailleurs', () => {
            expect(buildingNeeds['Farm-Wheat'].worker_need).toBe(3);
            expect(buildingNeeds['Farm-Carrot'].worker_need).toBe(3);
            expect(buildingNeeds['Farm-Cabbage'].worker_need).toBe(3);
        });

        test('les fermes ne nécessitent pas d\'élites', () => {
            expect(buildingNeeds['Farm-Wheat'].elite_need).toBe(0);
        });

        test('les marchés nécessitent des travailleurs ET des élites', () => {
            expect(buildingNeeds['Market-Stall'].worker_need).toBe(2);
            expect(buildingNeeds['Market-Stall'].elite_need).toBe(1);
        });

        test('les moulins ont les plus gros besoins', () => {
            expect(buildingNeeds['Windmill-001'].worker_need).toBe(4);
            expect(buildingNeeds['Windmill-001'].elite_need).toBe(2);
        });

        test('les routes ne nécessitent pas d\'employés', () => {
            expect(buildingNeeds['roads'].worker_need).toBe(0);
            expect(buildingNeeds['roads'].elite_need).toBe(0);
        });
    });
});

// ============================================================================
// config.citizens - Paramètres des citoyens
// ============================================================================
describe('config.citizens', () => {
    
    test('définit l\'âge minimum de travail', () => {
        expect(config.citizens.minWorkingAge).toBe(16);
    });

    test('définit l\'âge de retraite', () => {
        expect(config.citizens.retirementAge).toBe(65);
    });

    test('définit la taille par défaut d\'un ménage', () => {
        expect(config.citizens.defaultHouseholdSize).toBe(2);
    });

    test('l\'âge de retraite est supérieur à l\'âge minimum', () => {
        expect(config.citizens.retirementAge).toBeGreaterThan(config.citizens.minWorkingAge);
    });
});

// ============================================================================
// config.ui - Paramètres de l'interface
// ============================================================================
describe('config.ui', () => {
    
    test('définit le délai d\'auto-masquage des notifications', () => {
        expect(config.ui.notifications.autoHideMs).toBeDefined();
        expect(config.ui.notifications.autoHideMs).toBeGreaterThan(0);
    });

    test('définit la durée d\'animation des notifications', () => {
        expect(config.ui.notifications.animationMs).toBeDefined();
        expect(config.ui.notifications.animationMs).toBeGreaterThan(0);
    });
});

// ============================================================================
// config.rendering - Paramètres de rendu 3D
// ============================================================================
describe('config.rendering', () => {
    
    test('définit les paramètres d\'ombres', () => {
        expect(config.rendering.shadows.enabled).toBeDefined();
        expect(config.rendering.shadows.type).toBeDefined();
        expect(config.rendering.shadows.mapSize).toBeDefined();
    });

    test('définit les paramètres de lumière', () => {
        expect(config.rendering.lights.sun).toBeDefined();
        expect(config.rendering.lights.ambient).toBeDefined();
    });
});

