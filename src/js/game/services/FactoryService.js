import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { TimeManager } from '../utils/TimeManager.js';
import config from '../config.js';
import productionJournalManager from '../../stores/ProductionJournalManager.js';

// Recettes utilisant les bûches (logs) au lieu du bois brut
const PRODUCT_RECIPES = {
    furniture: { logs: 4 }, // 4 bûches pour 1 meuble
    weapons: { wood: 1, iron: 1 },
    pottery: { clay: 1, rock: 1 },
    jewelry: { gold: 1, iron: 1, wood: 1 }
};

// Durées de production par produit (en tours)
const PRODUCT_PRODUCTION_TURNS = {
    furniture: 1, // 1 tour pour fabriquer des meubles (le tour suivant la transformation)
    weapons: 1,
    pottery: 1,
    jewelry: 1
};

const PRODUCTION_TIME_DAYS = 7;

/**
 * Helper function to get factory ID in format name-x-y
 * @param {Object} factoryData - Factory data from IndexedDB
 * @returns {string} Factory ID in format name-x-y
 */
function getFactoryId(factoryData) {
    const name = factoryData.name || factoryData.id || '';
    const x = factoryData.x || 0;
    const y = factoryData.y || 0;
    
    // Si le name contient déjà les coordonnées (format name-x-y), ne pas les ajouter en double
    const nameParts = name.split('-');
    if (nameParts.length >= 3) {
        // Vérifier si les deux derniers éléments sont des nombres (coordonnées)
        const lastPart = nameParts[nameParts.length - 1];
        const secondLastPart = nameParts[nameParts.length - 2];
        if (!isNaN(lastPart) && !isNaN(secondLastPart)) {
            // Le name contient déjà les coordonnées, retourner tel quel
            return name;
        }
    }
    
    // Sinon, ajouter les coordonnées
    return `${name}-${x}-${y}`;
}

export class FactoryService extends SimService {
    async simulate(city, housesStore, time = 0) {
        try {
            const houses = await housesStore.listAllHouses();
            const factories = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Winery-001');
            });

            for (const factory of factories) {
                await this.processFactory(factory, housesStore, time, city);
            }
        } catch (error) {
        }
    }

    async processFactory(factory, housesStore, time, city) {
        const factoryId = factory.id || factory.name;
        const factoryData = await housesStore.getHouse(factoryId);
        if (!factoryData) return;

        const neighbors = factoryData.neighbors || [];
        const { hasAccess } = checkRoadAccess(neighbors);
        if (!hasAccess) return;

        const isActive = factoryData.isActive !== false;
        if (!isActive) return;

        // Récupérer les données fraîches
        let factoryDataFresh = await housesStore.getHouse(factoryId);
        const rawMaterials = factoryDataFresh.rawMaterials || {};
        const products = factoryDataFresh.products || {};
        
        // Récupérer les tours de dernière exécution de chaque étape
        const lastCollectTurn = factoryData.lastCollectTurn || -1;
        const lastTransformTurn = factoryData.lastTransformTurn || -1;
        const lastProductionTurn = factoryData.lastProductionTurn || -1;
        
        // Déterminer quelle étape doit être exécutée ce tour
        // Ordre : Collecte → Transformation → Production
        // Une seule étape par tour
        
        const updates = {};
        let stepExecuted = false;
        
        // Étape 1: Collecte (si pas faite ce tour)
        // Conditions : pas de collecte ce tour ET (première fois OU après production OU cycle cassé)
        if (lastCollectTurn < time) {
            const shouldCollect = 
                lastCollectTurn === -1 ||  // Première fois
                lastProductionTurn === time - 1 ||  // Après production
                (lastCollectTurn < time - 2 && lastTransformTurn < time - 1);  // Cycle cassé
            
            if (shouldCollect) {
                await this.collectResources(factoryId, rawMaterials, housesStore, city, time);
                
                // Récupérer le stock de bois APRÈS collecte pour le stocker comme previousWoodStock
                // Ce stock sera utilisé pour la transformation au tour suivant
                factoryDataFresh = await housesStore.getHouse(factoryId);
                const woodStockAfterCollect = factoryDataFresh.rawMaterials?.wood || 0;
                updates.previousWoodStock = woodStockAfterCollect;
                updates.lastCollectTurn = time;
                stepExecuted = true;
            }
        }
        
        // Étape 2: Transformation (si collecte faite au tour précédent et pas de transformation ce tour)
        if (!stepExecuted && lastCollectTurn === time - 1 && lastTransformTurn < time) {
            await this.transformWoodToLogs(factoryId, housesStore, time);
            updates.lastTransformTurn = time;
            stepExecuted = true;
        }
        
        // Étape 3: Production (si transformation faite il y a assez de tours et pas de production ce tour)
        // Pour les meubles, le meuble est produit 1 tour après la transformation
        // Tour N : transformation bois → bûches
        // Tour N+1 : le meuble est produit (4 bûches consommées, 1 meuble ajouté)
        if (!stepExecuted && lastTransformTurn > 0 && lastProductionTurn < time) {
            const turnsSinceTransform = time - lastTransformTurn;
            // Pour les meubles, on produit 1 tour après la transformation
            const requiredTurnsAfterTransform = 1; // 1 tour après la transformation
            if (turnsSinceTransform >= requiredTurnsAfterTransform) {
                factoryDataFresh = await housesStore.getHouse(factoryId);
                const rawMaterialsAfterTransform = factoryDataFresh.rawMaterials || {};
                const productsAfterTransform = factoryDataFresh.products || {};
                // On passe lastTransformTurn pour que produceProducts puisse calculer correctement
                // Le meuble sera produit si turnsSinceTransform >= 1
                await this.produceProducts(factoryId, rawMaterialsAfterTransform, productsAfterTransform, housesStore, time, lastTransformTurn);
                // On met à jour lastProductionTurn seulement si la production a réellement eu lieu
                // Si turnsSinceTransform >= 1, la production s'est faite, donc on met à jour lastProductionTurn
                if (turnsSinceTransform >= 1) {
                    updates.lastProductionTurn = time;
                }
                stepExecuted = true;
            }
        }
        
        // Mettre à jour les tours de dernière exécution
        updates.lastProcessTurn = time;
        if (Object.keys(updates).length > 0) {
            await housesStore.updateHouseFields(factoryId, updates);
        }
    }

    getMaxStorage(resourceType) {
        // Les bûches (logs) ont le même stock max que le bois
        if (resourceType === 'logs') {
            return config.factoryMaxStorage?.wood || 200;
        }
        return config.factoryMaxStorage?.[resourceType] || 200;
    }

    /**
     * Transforme le bois collecté en bûches (logs)
     * Basé sur le stock de bois du tour précédent
     * Limitation: ne peut pas transformer plus de 50% du stock si effectif de 1/2
     */
    async transformWoodToLogs(factoryId, housesStore, time) {
        const factoryData = await housesStore.getHouse(factoryId);
        if (!factoryData) return;

        const productWorkerDistribution = factoryData.productWorkerDistribution || {};
        const allocatedWorkers = productWorkerDistribution['wood'] || 0;
        
        // Si aucun bûcheron n'est recruté, pas de transformation
        if (allocatedWorkers === 0) {
            return;
        }

        // Récupérer le stock de bois du tour précédent
        const previousWoodStock = factoryData.previousWoodStock || 0;
        
        // Si pas de bois au tour précédent, pas de transformation
        if (previousWoodStock <= 0) {
            return;
        }

        // Calculer le pourcentage de transformation selon l'effectif
        // Si effectif 1/2 (1 worker sur 2), limitation à 50%
        const maxWorkersPerProduct = 2;
        const transformationPercentage = allocatedWorkers / maxWorkersPerProduct;
        
        // Calculer combien de bois peut être transformé (basé sur le stock du tour précédent)
        const maxTransformable = Math.floor(previousWoodStock * transformationPercentage);
        
        // Récupérer le stock actuel de bûches et de bois
        const currentLogs = factoryData.logs || 0;
        const maxLogsStorage = this.getMaxStorage('logs');
        const remainingLogsCapacity = Math.max(0, maxLogsStorage - currentLogs);
        
        const rawMaterials = factoryData.rawMaterials || {};
        const currentWoodStock = rawMaterials.wood || 0;
        
        // Transformer le minimum entre ce qui peut être transformé, la capacité restante, et le stock actuel
        // On ne peut pas transformer plus que ce qui est disponible actuellement
        const woodToTransform = Math.min(maxTransformable, remainingLogsCapacity, currentWoodStock, previousWoodStock);
        
        if (woodToTransform > 0) {
            const newLogs = (currentLogs || 0) + woodToTransform;
            const newRawMaterials = { ...rawMaterials };
            
            // Consommer le bois transformé du stock actuel
            newRawMaterials.wood = Math.max(0, (newRawMaterials.wood || 0) - woodToTransform);
            
            // Stocker le message de transformation pour l'affichage
            const transformationMessage = `Les bûcherons ont transformé ${woodToTransform} bois en bûches`;
            
            await housesStore.updateHouseFields(factoryId, {
                logs: newLogs,
                rawMaterials: newRawMaterials,
                lastTransformationMessage: transformationMessage,
                lastTransformationTurn: time,
                lastTransformationAmount: woodToTransform
            });
            
            // Récupérer les stocks restants APRÈS la mise à jour dans IndexedDB
            const factoryDataAfterUpdate = await housesStore.getHouse(factoryId);
            const remainingStocks = {
                wood: factoryDataAfterUpdate.rawMaterials?.wood || 0,
                logs: factoryDataAfterUpdate.logs || 0,
                furniture: factoryDataAfterUpdate.products?.furniture || 0
            };
            
            // Enregistrer dans le journal de production
            const factoryIdFormatted = getFactoryId(factoryData);
            try {
                await productionJournalManager.addProductionEntry(
                    time,
                    factoryIdFormatted,
                    'transform_wood_to_logs',
                    'logs',
                    woodToTransform,
                    remainingStocks
                );
            } catch (error) {
                console.error('[FactoryService] Error adding production entry (transform_wood_to_logs):', error);
            }
        }
    }

    async produceProducts(factoryId, rawMaterials, products, housesStore, time, lastTransformTurn = null) {
        // Récupérer la répartition des workers depuis IndexedDB
        const factoryData = await housesStore.getHouse(factoryId);
        if (!factoryData) return;
        
        const productWorkerDistribution = factoryData.productWorkerDistribution || {};
        const productProductionPercentages = factoryData.productProductionPercentages || {};
        
        // Récupérer les bûches (logs) depuis la factory
        const logs = factoryData.logs || 0;
        
        // Utiliser les produits depuis IndexedDB (source of truth) plutôt que le paramètre
        const currentProducts = factoryData.products || {};
        
        // Créer un objet combinant rawMaterials et logs pour les recettes
        const availableMaterials = { ...rawMaterials, logs: logs };
        
        for (const [productType, recipe] of Object.entries(PRODUCT_RECIPES)) {
            // Vérifier qu'il y a des workers alloués à ce produit
            const allocatedWorkers = productWorkerDistribution[productType] || 0;
            if (allocatedWorkers === 0) {
                // Pas de workers alloués = pas de production, s'assurer que le stock est à 0
                if (currentProducts[productType] && currentProducts[productType] > 0) {
                    const newProducts = { ...currentProducts };
                    newProducts[productType] = 0;
                    await housesStore.updateHouseFields(factoryId, { products: newProducts });
                }
                continue;
            }
            
            // Vérifier la durée de production pour ce produit
            const productionTurns = PRODUCT_PRODUCTION_TURNS[productType] || 1;
            
            // Si lastTransformTurn est fourni, utiliser la transformation comme référence
            // Sinon, utiliser lastProductionTurn_${productType}
            let turnsSinceProduction;
            if (lastTransformTurn !== null && productType === 'furniture') {
                // Pour les meubles, compter depuis la transformation
                // Le meuble est produit 1 tour après la transformation (tour N+1)
                // Tour N : transformation bois → bûches
                // Tour N+1 : le meuble est produit (4 bûches consommées, 1 meuble ajouté)
                turnsSinceProduction = time - lastTransformTurn;
            } else {
                const lastProductionTurn = factoryData[`lastProductionTurn_${productType}`] || 0;
                turnsSinceProduction = time - lastProductionTurn;
            }
            
            // Si pas assez de tours écoulés, continuer au produit suivant
            // Pour les meubles, on doit attendre 1 tour après la transformation (turnsSinceProduction >= 1)
            if (turnsSinceProduction < productionTurns) {
                continue;
            }
            
            // Calculer le max de stock selon le pourcentage de production
            const maxWorkersPerProduct = 2;
            let productionPercentage = productProductionPercentages[productType];
            if (productionPercentage === undefined) {
                productionPercentage = Math.floor((allocatedWorkers / maxWorkersPerProduct) * 100);
            }
            
            const baseMaxStorage = this.getMaxStorage(productType);
            const effectiveMaxStorage = Math.floor(baseMaxStorage * (productionPercentage / 100));
            
            const currentStock = currentProducts[productType] || 0;
            const remainingCapacity = Math.max(0, effectiveMaxStorage - currentStock);

            if (remainingCapacity <= 0) continue;

            const canProduce = this.canProduceProduct(recipe, availableMaterials);
            if (!canProduce) continue;

            // Pour les meubles: 100 bûches / 4 = 25 meubles
            // Mais on produit progressivement selon la capacité
            let quantityToProduce = 1;
            
            // Si c'est des meubles, calculer combien on peut produire avec les bûches disponibles
            if (productType === 'furniture') {
                const logsNeededPerUnit = recipe.logs || 4;
                const maxFromLogs = Math.floor(logs / logsNeededPerUnit);
                quantityToProduce = Math.min(maxFromLogs, remainingCapacity);
            } else {
                quantityToProduce = Math.min(1, remainingCapacity);
            }

            if (quantityToProduce <= 0) continue;

            const newProducts = { ...currentProducts };
            newProducts[productType] = (newProducts[productType] || 0) + quantityToProduce;

            // Consommer les matières premières
            const newRawMaterials = { ...rawMaterials };
            let newLogs = logs;
            
            let logsConsumed = 0;
            for (const [material, amount] of Object.entries(recipe)) {
                if (material === 'logs') {
                    logsConsumed = amount * quantityToProduce;
                    newLogs = Math.max(0, newLogs - logsConsumed);
                } else {
                    newRawMaterials[material] = Math.max(0, (newRawMaterials[material] || 0) - (amount * quantityToProduce));
                }
            }

            await housesStore.updateHouseFields(factoryId, {
                products: newProducts,
                rawMaterials: newRawMaterials,
                logs: newLogs,
                [`lastProductionTurn_${productType}`]: time
            });
            
            // Enregistrer dans le journal de production pour les meubles
            // Regrouper la livraison et la fabrication en une seule entrée
            if (productType === 'furniture' && quantityToProduce > 0) {
                // Récupérer les stocks restants APRÈS la mise à jour dans IndexedDB
                const factoryDataAfterUpdate = await housesStore.getHouse(factoryId);
                if (factoryDataAfterUpdate) {
                    const factoryIdFormatted = getFactoryId(factoryDataAfterUpdate);
                    const remainingStocks = {
                        wood: factoryDataAfterUpdate.rawMaterials?.wood || 0,
                        logs: factoryDataAfterUpdate.logs || 0,
                        furniture: factoryDataAfterUpdate.products?.furniture || 0
                    };
                    
                    // Enregistrer une seule entrée combinée pour la livraison + fabrication
                    // Le prix total = prix des bûches livrées + prix des meubles fabriqués
                    try {
                        const logsPrice = productionJournalManager.getPrice('logs') * logsConsumed;
                        const furniturePrice = productionJournalManager.getPrice('furniture') * quantityToProduce;
                        const totalPrice = logsPrice + furniturePrice;
                        
                        // Calculer les tours de production
                        // Si lastTransformTurn est fourni, la production a duré 1 tour après la transformation
                        // Exemple: transformation au tour 23, production au tour 24
                        let productionTurns = null;
                        if (lastTransformTurn !== null && lastTransformTurn !== undefined) {
                            const productionTurnsCount = PRODUCT_PRODUCTION_TURNS[productType] || 1;
                            productionTurns = [];
                            for (let i = 1; i <= productionTurnsCount; i++) {
                                productionTurns.push(lastTransformTurn + i);
                            }
                        }
                        
                        // Créer une entrée avec le prix total, logsConsumed et productionTurns
                        await productionJournalManager.addProductionEntry(
                            time,
                            factoryIdFormatted,
                            'produce_furniture',
                            'furniture',
                            quantityToProduce,
                            remainingStocks,
                            logsConsumed,
                            totalPrice,
                            productionTurns
                        );
                    } catch (error) {
                        console.error('[FactoryService] Error adding production entry (produce_furniture):', error);
                    }
                }
            }
        }
    }

    canProduceProduct(recipe, rawMaterials) {
        for (const [material, amount] of Object.entries(recipe)) {
            const available = rawMaterials[material] || 0;
            if (available < amount) return false;
        }
        return true;
    }
    
    /**
     * Récupère les durées de production pour chaque produit
     */
    getProductionTurns(productType) {
        return PRODUCT_PRODUCTION_TURNS[productType] || 1;
    }

    /**
     * Collecte les ressources naturelles depuis les trees et boulders
     * Décrémente les stocks des ressources naturelles et incrémente les rawMaterials de la factory
     */
    async collectResources(factoryId, rawMaterials, housesStore, city, time) {
        // Récupérer les données fraîches de la factory depuis IndexedDB
        const factoryData = await housesStore.getHouse(factoryId);
        if (!factoryData) return;
        
        // Utiliser les rawMaterials actuels depuis IndexedDB (source of truth)
        const currentRawMaterials = factoryData.rawMaterials || {};
        
        const productWorkerDistribution = factoryData.productWorkerDistribution || {};
        const productProductionPercentages = factoryData.productProductionPercentages || {};
        
        const newRawMaterials = { ...currentRawMaterials };
        let collected = false;
        
        // Récupérer tous les items nature (trees et boulders) depuis IndexedDB
        const allHouses = await housesStore.listAllHouses();
        const natureItems = allHouses.filter(house => (house.category || '') === 'nature');

        // Pour chaque type de ressource que la factory peut collecter
        const resourceTypes = ['wood', 'rock', 'clay', 'iron', 'gold'];
        
        for (const resourceType of resourceTypes) {
            // Vérifier qu'il y a des workers alloués à cette ressource
            const allocatedWorkers = productWorkerDistribution[resourceType] || 0;
            if (allocatedWorkers === 0) {
                // Pas de workers alloués = pas de collecte, s'assurer que le stock est à 0
                if (currentRawMaterials[resourceType] && currentRawMaterials[resourceType] > 0) {
                    newRawMaterials[resourceType] = 0;
                    collected = true;
                }
                continue;
            }
            
            // Calculer le max de stock selon le pourcentage de production
            const maxWorkersPerProduct = 2;
            let productionPercentage = productProductionPercentages[resourceType];
            if (productionPercentage === undefined) {
                productionPercentage = Math.floor((allocatedWorkers / maxWorkersPerProduct) * 100);
            }
            
            const baseMaxStorage = this.getMaxStorage(resourceType);
            const effectiveMaxStorage = Math.floor(baseMaxStorage * (productionPercentage / 100));

            const currentStock = currentRawMaterials[resourceType] || 0;
            const remainingCapacity = Math.max(0, effectiveMaxStorage - currentStock);

            if (remainingCapacity <= 0) continue;

            // Gérer clay séparément (vient des tiles, pas des stocks IndexedDB)
            if (resourceType === 'clay') {
                // Pour l'instant, on garde l'ancienne logique pour clay
                // TODO: Implémenter la collecte de clay depuis les tiles si nécessaire
                continue;
            }
            
            // Collecter depuis les stocks naturels disponibles
            let totalCollected = 0;
            
            for (const natureItem of natureItems) {
                if (totalCollected >= remainingCapacity) break;
                
                // Récupérer les données fraîches depuis IndexedDB pour avoir les stocks à jour
                const freshNatureItem = await housesStore.getHouse(natureItem.name);
                if (!freshNatureItem) continue;
                
                const stocks = freshNatureItem.stocks || {};
                const available = stocks[resourceType] || 0;
                
                if (available <= 0) continue;
                
                // Vérifier le type d'item
                const type = freshNatureItem.type || '';
                let canCollectFromThis = false;
                
                if (resourceType === 'wood' && type.includes('Tree')) {
                    canCollectFromThis = true;
                } else if ((resourceType === 'rock' || resourceType === 'iron' || resourceType === 'gold') && type.includes('Boulder')) {
                    canCollectFromThis = true;
                }
                
                if (!canCollectFromThis) continue;
                
                // Calculer combien on peut collecter depuis cet item
                const toCollectFromItem = Math.min(available, remainingCapacity - totalCollected, 1);
                
                if (toCollectFromItem > 0) {
                    // Décrémenter le stock de l'item nature
                    const newStocks = { ...stocks };
                    const newStockValue = Math.max(0, available - toCollectFromItem);
                    newStocks[resourceType] = newStockValue;
                    
                    // Mettre à jour dans IndexedDB
                    await housesStore.updateHouseFields(freshNatureItem.name, {
                        stocks: newStocks
                    });
                    
                    // Mettre à jour aussi dans natureItem pour les prochaines itérations
                    natureItem.stocks = newStocks;
                    
                    totalCollected += toCollectFromItem;
                }
            }
            
            if (totalCollected > 0) {
                newRawMaterials[resourceType] = (newRawMaterials[resourceType] || 0) + totalCollected;
                collected = true;
            }
        }
        
        // Mettre à jour les rawMaterials dans IndexedDB si quelque chose a été collecté
        if (collected) {
            await housesStore.updateHouseFields(factoryId, { rawMaterials: newRawMaterials });
            
            // Enregistrer la collecte de bois dans le journal de production (si du bois a été collecté)
            if (newRawMaterials.wood !== undefined && newRawMaterials.wood > (currentRawMaterials.wood || 0)) {
                const woodCollected = newRawMaterials.wood - (currentRawMaterials.wood || 0);
                if (woodCollected > 0) {
                    // Récupérer les stocks restants APRÈS la mise à jour
                    const factoryDataAfterUpdate = await housesStore.getHouse(factoryId);
                    if (factoryDataAfterUpdate) {
                        const factoryIdFormatted = getFactoryId(factoryDataAfterUpdate);
                        const remainingStocks = {
                            wood: factoryDataAfterUpdate.rawMaterials?.wood || 0,
                            logs: factoryDataAfterUpdate.logs || 0,
                            furniture: factoryDataAfterUpdate.products?.furniture || 0
                        };
                        
                        try {
                            await productionJournalManager.addProductionEntry(
                                time,
                                factoryIdFormatted,
                                'collect_wood',
                                'wood',
                                woodCollected,
                                remainingStocks
                            );
                        } catch (error) {
                            console.error('[FactoryService] Error adding production entry (collect_wood):', error);
                        }
                    }
                }
            }
        }
    }

    /**
     * Récupère les ressources disponibles depuis les stocks des trees et boulders dans IndexedDB
     * @param {Object} city - City object
     * @param {HousesStore} housesStore - Database store
     * @returns {Promise<Object>} Object avec les ressources disponibles (wood, rock, clay, iron, gold)
     */
    async getCityResources(city, housesStore) {
        const resources = {
            wood: 0,
            rock: 0,
            clay: 0,
            iron: 0,
            gold: 0
        };

        try {
            const houses = await housesStore.listAllHouses();
            
            for (const house of houses) {
                const category = house.category || '';
                
                // Ne prendre que les items nature
                if (category !== 'nature') continue;
                
                const type = house.type || '';
                const stocks = house.stocks || {};
                
                // Trees: collecter le bois disponible
                if (type.includes('Tree')) {
                    resources.wood += stocks.wood || 0;
                } 
                // Boulders: collecter rock, iron, gold
                else if (type.includes('Boulder')) {
                    resources.rock += stocks.rock || 0;
                    resources.iron += stocks.iron || 0;
                    resources.gold += stocks.gold || 0;
                }
            }

            // Clay vient des tiles (pas de stocks dans IndexedDB pour l'instant)
            // On garde l'ancienne logique pour clay
            for (let x = 0; x < city.size; x++) {
                for (let y = 0; y < city.size; y++) {
                    const tile = city.tiles[x]?.[y];
                    if (tile && tile.hasClay) {
                        resources.clay += 1;
                    }
                }
            }
        } catch (error) {
        }

        return resources;
    }
}

