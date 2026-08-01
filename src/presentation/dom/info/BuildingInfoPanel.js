/**
 * Building info overlay (select-object tool) — DOM presentation.
 */

import { getSectorPriority, getSectorName } from '../../../composition/facades/employment.js';
import {
  makeInfoBuildingText,
  makeInfoKeyValue,
  makeInfoSection,
} from './buildingInfoDom.js';
import { findBuildingAtTile, getBuildingById, getBuildingField } from '../../../composition/facades/construction.js';
import { getTimeInfo } from '../../../composition/facades/appRuntime.js';
import { getTreasurySnapshot } from '../../../composition/facades/accountingGame.js';
import { buildingsObjects } from '../../../shared/building-catalog/index.js';
import { infoObjectOverlay } from '../shell/nodes.js';

/**
 * Info panel: workplace staffing section (workers in aggregates; elites display-only).
 */
function renderWorkplaceEmployeesInfo(buildingData, messages) {
    if (!buildingData?.employees) return;

    const roadCount = buildingData.roads ?? 0;
    const buildingType = buildingData.type || '';
    const farmExemptFromRoad = buildingType.includes('Farm') || buildingType.includes('farm');
    const employees = buildingData.employees;
    const workerNeed = employees.worker_need || 0;
    const eliteNeed = employees.elite_need || 0;
    const workers = employees.worker || 0;
    const elites = employees.elite || 0;
    const sector = employees.sector || 0;
    const priority = getSectorPriority(sector);

    makeInfoSection('Employés');

    if (roadCount <= 0 && !farmExemptFromRoad) {
        makeInfoBuildingText('🚧 Route nécessaire pour embaucher', false, 'warning-message');
        return;
    }

    const hasEnoughWorkers = workers >= workerNeed;
    const hasNoWorkers = workers === 0 && workerNeed > 0;
    const hasPartialWorkers = workers > 0 && workers < workerNeed;

    makeInfoKeyValue('Secteur', `${sector} : ${getSectorName(sector)}`);
    makeInfoKeyValue('Priorité', `${priority}`);
    makeInfoKeyValue('Ouvriers', `${workers}/${workerNeed}`);
    makeInfoKeyValue('Élites', `${elites}/${eliteNeed}`);

    if (hasEnoughWorkers) {
        makeInfoBuildingText(messages.fullyStaffed, false, 'success-message');
    } else if (hasNoWorkers) {
        makeInfoBuildingText(messages.noWorkers, false, 'error-message');
    } else if (hasPartialWorkers) {
        makeInfoBuildingText(messages.partialWorkers, false, 'warning-message');
    }
}

/**
 * @param {{ userData: object }} selectedObject
 * @param {{
 *   city: object,
 *   parcels: object,
 *   supply: object,
 *   housing: object,
 *   scene: object,
 *   game: { pause: Function, play: Function },
 *   time: number,
 *   runScenePresentationPass: (time: number) => Promise<void>,
 * }} ctx
 */
export async function presentBuildingInfoSelection(selectedObject, ctx) {
    const { city, parcels, supply, housing, scene, game, time, runScenePresentationPass } = ctx;
            // Object selection - ONLY open info modal when using select tool
            // Only open the info modal if we actually have info to show (i.e., on building objects)
            let shouldOpenInfo = false;

            // Reset content first
            makeInfoBuildingText("", true);

            if(buildingsObjects.includes(selectedObject.userData.id)) {
                shouldOpenInfo = true;
            }

            // Open/close modal strictly based on whether we have info
            if (shouldOpenInfo) {
                if (!infoObjectOverlay.classList.contains('active')) {
                    infoObjectOverlay.classList.add('active');
                }
                // Manage pointer events on 3D scene when info overlay is active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                if (scene.controls) {
                    scene.controls.enabled = false;
                }
            } else {
                // Do not open the modal at all for non-building objects (e.g., grass)
                // If it's already open from a previous selection, close it
                if (infoObjectOverlay.classList.contains('active')) {
                    infoObjectOverlay.classList.remove('active');
                    const canvas = document.querySelector('canvas');
                    if (canvas) {
                        canvas.classList.remove('pointer-events-disabled');
                    }
                }
            }


            if(buildingsObjects.includes(selectedObject.userData.id)) {
                const { x: selX, y: selY } = selectedObject.userData;
                const uniqueId =
                    selectedObject.userData.instanceId
                    ?? city.tiles?.[selX]?.[selY]?.instanceId
                    ?? (await findBuildingAtTile({ x: selX, y: selY }))?.instanceId
                    ?? null;
                
                const buildingRow = uniqueId ? await getBuildingById(uniqueId) : null;
                const buildingPop = buildingRow?.pop ?? 0;
                const roadAccess = await parcels.getRoadAccess(uniqueId);
                const neighbors = uniqueId ? await parcels.getNeighbors(uniqueId) : [];
                const supplyView = uniqueId
                    ? await supply.getBuildingSupplyView(uniqueId)
                    : null;
                // Food stocks for Supply buildings come from the BC query (not raw Dexie)
                let houseStocks = supplyView?.stocks ?? null;
                
                // Debug: Log retrieved data
                console.log('[game.js] Retrieved data from DB:', {
                    uniqueId,
                    pop: buildingPop,
                    roads: roadAccess.roadCount,
                    neighborsCount: neighbors.length,
                    hasStocks: !!houseStocks,
                    supplyKind: supplyView?.kind ?? null,
                });
                
                console.log('[game.js] Full house record:', {
                    uniqueId,
                    type: buildingRow?.type,
                    roads: buildingRow?.roads,
                    neighborsCount: buildingRow?.neighbors?.length || 0,
                    hasNeighbors: !!buildingRow?.neighbors
                });

                // Vérifier si c'est un item nature (tree ou boulder)
                const isNatureItem = buildingRow?.category === 'nature';
                
                if (isNatureItem) {
                    // Affichage pour les items nature
                    makeInfoSection('Ressource naturelle');
                    makeInfoKeyValue('Type', `${selectedObject.userData.id}`);
                    makeInfoKeyValue('Adresse', `x: ${selectedObject.userData.x} | y: ${selectedObject.userData.y}`);
                    
                    // Nature stocks are not Supply — read building row for wood/rock/etc.
                    houseStocks = buildingRow?.stocks ?? (await getBuildingField(uniqueId, 'stocks'));
                    const maxStocks = buildingRow?.maxStocks || {};
                    if (houseStocks && Object.keys(houseStocks).length > 0) {
                        makeInfoSection('Stocks disponibles');
                        
                        // Trees: afficher wood
                        if (selectedObject.userData.id.includes('Tree')) {
                            const wood = houseStocks.wood || 0;
                            const maxWood = maxStocks.wood || 0;
                            makeInfoKeyValue('Bois', `${wood} / ${maxWood}`);
                        }
                        
                        // Boulders: afficher rock, gold, iron
                        if (selectedObject.userData.id.includes('Boulder')) {
                            const rock = houseStocks.rock || 0;
                            const maxRock = maxStocks.rock || 0;
                            if (maxRock > 0) {
                                makeInfoKeyValue('Pierre', `${rock} / ${maxRock}`);
                            }
                            
                            const gold = houseStocks.gold || 0;
                            const maxGold = maxStocks.gold || 0;
                            if (maxGold > 0) {
                                makeInfoKeyValue('Or', `${gold} / ${maxGold}`);
                            }
                            
                            const iron = houseStocks.iron || 0;
                            const maxIron = maxStocks.iron || 0;
                            if (maxIron > 0) {
                                makeInfoKeyValue('Fer', `${iron} / ${maxIron}`);
                            }
                        }
                    }
                } else {
                    // Affichage normal pour les autres bâtiments
                    makeInfoSection('Bâtiment');
                    makeInfoKeyValue('Type', `${selectedObject.userData.id}`);
                    makeInfoKeyValue('Adresse', `x: ${selectedObject.userData.x} | y: ${selectedObject.userData.y}`);
                    makeInfoKeyValue(`Habitants`, buildingPop);
                    makeInfoKeyValue('Routes desservies', roadAccess.roadCount);
                }

                if(neighbors.length > 0) {
                    makeInfoSection('Voisins immédiats');
                    neighbors
                        .filter((neigh) => neigh.x != null && neigh.y != null)
                        .forEach((neighbor) => {
                            const label = neighbor.type || neighbor.instanceId;
                            makeInfoKeyValue(label, `x: ${neighbor.x} | y: ${neighbor.y}`);
                        });
                } else {
                    makeInfoKeyValue('Voisinage', 'Maison isolée');
                }

                if(supplyView?.kind === 'house' && Object.hasOwn(houseStocks || {}, 'food')) {
                    makeInfoSection('Stocks nourriture');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers`);
                    
                    // Evolution section - show conditions for next evolution step
                    const buildingType = selectedObject.userData.id;
                    const hasRoadAccess = roadAccess.hasAccess;
                    const { totalFood, meetsFoodGoal } = housing.evaluateHouseFoodAffluence({
                        stocks: houseStocks || {},
                        population: buildingPop || 0,
                    });
                    const evolutionPreview = housing.previewHouseEvolution({
                        stocks: houseStocks || {},
                        population: buildingPop || 0,
                        buildingType,
                        hasRoadAccess,
                    });
                    
                    makeInfoSection('Évolution');
                    
                    // House-Blue: Show conditions to become House-Red
                    if (buildingType === 'House-Blue') {
                        makeInfoKeyValue('→ Maison Rouge', '');
                        const isInhabited = (buildingPop || 0) > 0;
                        const roadStatus = hasRoadAccess ? '✅' : '❌';
                        const popStatus = isInhabited ? '✅' : '❌';
                        makeInfoKeyValue('  • Accès routier', `${roadStatus} ${hasRoadAccess ? 'Oui' : 'Non'}`);
                        makeInfoKeyValue('  • Habitée', `${popStatus} ${isInhabited ? 'Oui' : 'Non'}`);
                        makeInfoKeyValue('  • Nourriture de base', `${totalFood > 0 ? '✅' : '❌'} ${totalFood} panier${totalFood !== 1 ? 's' : ''}`);
                    }
                    
                    // House-Red: Show conditions to become House-Purple (only Purple-specific conditions)
                    else if (buildingType === 'House-Red') {
                        makeInfoKeyValue('→ Maison Violette', '');
                        const purpleCheck = evolutionPreview.toPurple;
                        // Show Purple-specific conditions
                        makeInfoKeyValue('  • Population > 5', `${(buildingPop || 0) > 5 ? '✅' : '❌'} ${buildingPop || 0}`);
                        const foodStatus = totalFood >= (buildingPop || 0) ? '✅' : '❌';
                        makeInfoKeyValue('  • Nourriture ≥ Population', `${foodStatus} ${totalFood}/${buildingPop || 0}`);
                        
                        if (!purpleCheck.canEvolve) {
                            if (purpleCheck.reason === 'hunger_present') {
                                const needed = Math.max(0, (buildingPop || 0) - totalFood);
                                makeInfoKeyValue('  • Manque', `${needed} panier${needed > 1 ? 's' : ''}`);
                            } else if (purpleCheck.reason === 'population_too_low') {
                                const needed = Math.max(0, 6 - (buildingPop || 0));
                                makeInfoKeyValue('  • Manque', `${needed} habitant${needed > 1 ? 's' : ''}`);
                            }
                        }
                    }
                    
                    // House-Purple: Show conditions to become Palace (only Palace-specific conditions)
                    else if (buildingType === 'House-Purple') {
                        makeInfoKeyValue('→ Palais', '');
                        const palaceCheck = evolutionPreview.toPalace;
                        
                        // Palace-specific conditions (food goal, not basic conditions)
                        const foodGoalStatus = meetsFoodGoal ? '✅' : '❌';
                        const foodGoalText = meetsFoodGoal 
                            ? `Oui (${totalFood} > ${(buildingPop || 0) * 2})`
                            : `Non (${totalFood} ≤ ${(buildingPop || 0) * 2})`;
                        
                        // Check food variety (at least 2 types of food)
                        const foodTypes = {
                            wheat: (houseStocks?.wheat || 0) > 0,
                            carrot: (houseStocks?.carrot || 0) > 0,
                            cabbage: (houseStocks?.cabbage || 0) > 0,
                        };
                        const availableFoodTypesCount = evolutionPreview.availableCropTypesCount;
                        const foodVarietyStatus = availableFoodTypesCount >= 2 ? '✅' : '❌';
                        const foodVarietyText = availableFoodTypesCount >= 2 
                            ? `Oui (${availableFoodTypesCount} types: ${Object.entries(foodTypes).filter(([_, available]) => available).map(([type]) => type).join(', ')})`
                            : `Non (${availableFoodTypesCount} type${availableFoodTypesCount !== 1 ? 's' : ''} disponible)`;
                        
                        makeInfoKeyValue('  • Population > 5', `${(buildingPop || 0) > 5 ? '✅' : '❌'} ${buildingPop || 0}`);
                        makeInfoKeyValue('  • Nourriture > Pop × 2', `${foodGoalStatus} ${foodGoalText}`);
                        makeInfoKeyValue('  • 2 types de nourriture', `${foodVarietyStatus} ${foodVarietyText}`);
                    }
                    
                    // Palace: No further evolution
                    else if (buildingType === 'House-2Story') {
                        makeInfoKeyValue('→ Palais', '✅ Niveau maximum atteint');
                    }
                }

                // Display market food stocks (similar to houses)
                if(supplyView?.kind === 'market' && Object.hasOwn(houseStocks || {}, 'food')) {
                    const maxStock = supplyView.maxStock || 500;
                    
                    makeInfoSection('Stock marché');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0}/${maxStock} paniers disponibles`);
                    
                    const noFarmsNearby = supplyView.noFarmsNearby === true;
                    const noHousesNearby = !supplyView.hasHousesNearby;
                    const isBuying = supplyView.isBuying === true;

                    const marketData = buildingRow;
                    const hasNoWorkersForState = (marketData?.roads ?? 0) > 0
                        && (marketData?.employees?.worker || 0) === 0
                        && (marketData?.employees?.worker_need || 0) > 0;
                    
                    const buyingPeriodName = 'Automne';
                    
                    makeInfoSection('État du marché');
                    if (hasNoWorkersForState) {
                        makeInfoKeyValue('État', '🔴 Inactif : pas d\'employés');
                    } else if (isBuying) {
                        makeInfoKeyValue('État', '🟢 Achats en cours : c\'est le mois des affaires !');
                    } else {
                        makeInfoKeyValue('État', `⏸️ En attente : le marché n'achète qu'en ${buyingPeriodName}`);
                    }
                    
                    makeInfoSection('Approvisionnement');
                    if (noFarmsNearby) {
                        makeInfoKeyValue('Fermes', '❌ Aucune ferme à proximité');
                    } else {
                        makeInfoKeyValue('Fermes', '✅ Fermes accessibles');
                    }
                    if (noHousesNearby) {
                        makeInfoKeyValue('Distribution', '❌ Aucune maison à portée');
                    } else {
                        makeInfoKeyValue('Distribution', '✅ Maisons à portée');
                    }
                    
                    renderWorkplaceEmployeesInfo(marketData, {
                        fullyStaffed: '✅ Le marché marche à plein régime',
                        noWorkers: '❌ Le marché manque de bras, il ne peut fonctionner',
                        partialWorkers: '⚠️ Le marché tente de vendre avec peine car trop peu d\'employés',
                    });
                }

                if(supplyView?.kind === 'farm') {
                    if (!houseStocks) {
                        houseStocks = { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    }
                    makeInfoSection('Stocks ferme');
                    if(selectedObject.userData.id.includes('Farm-Wheat')) {
                        makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Carrot')) {
                        makeInfoKeyValue('Carottes', `${houseStocks.carrot || 0} paniers`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Cabbage')) {
                        makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    }
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers`);
                    
                    const salesToMarket = supplyView.salesToMarket || [];
                    const salesToWindmill = supplyView.salesToWindmill || [];
                    
                    let currentYear = 0;
                    const budget = await getTreasurySnapshot();
                    if (budget && budget.turn !== undefined) {
                        const timeInfo = getTimeInfo(budget.turn);
                        currentYear = timeInfo ? timeInfo.year : 0;
                    }
                    
                    const currentYearMarketSales = salesToMarket.filter(sale => sale.year === currentYear);
                    const currentYearWindmillSales = salesToWindmill.filter(sale => sale.year === currentYear);
                    
                    if (currentYearMarketSales.length > 0 || currentYearWindmillSales.length > 0) {
                        makeInfoSection('Ventes de l\'année');
                        
                        if (currentYearMarketSales.length > 0) {
                            makeInfoKeyValue('Ventes au marché', `${currentYearMarketSales.length} vente(s)`);
                            currentYearMarketSales.forEach(sale => {
                                const productName = sale.productType === 'wheat' ? 'Blé' : 
                                                   sale.productType === 'carrot' ? 'Carotte' : 
                                                   sale.productType === 'cabbage' ? 'Chou' : sale.productType;
                                const subtext = `${sale.monthName || `Mois ${sale.month + 1}`} - Tour ${sale.turn}: ${sale.quantity} paniers`;
                                makeInfoKeyValue(`  → ${productName}`, `${sale.quantity} paniers`, subtext);
                            });
                        }
                        
                        if (currentYearWindmillSales.length > 0) {
                            makeInfoKeyValue('Ventes au moulin', `${currentYearWindmillSales.length} type(s) de produit`);
                            currentYearWindmillSales.forEach(sale => {
                                const productName = sale.productType === 'wheat' ? 'Blé' : 
                                                   sale.productType === 'carrot' ? 'Carotte' : 
                                                   sale.productType === 'cabbage' ? 'Chou' : sale.productType;
                                const subtext = `${sale.count || 1} collecte(s) cette année`;
                                makeInfoKeyValue(`  → ${productName}`, `${sale.quantity} paniers`, subtext);
                            });
                        }
                    }
                    
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ La ferme a tout ce qu\'il faut pour fonctionner',
                        noWorkers: '❌ La ferme n\'a aucun employé et ne peut pas fonctionner',
                        partialWorkers: '⚠️ La ferme ne peut fonctionner à sa pleine capacité',
                    });
                }

                // Display windmill food stocks (collected from all farms in December)
                if(supplyView?.kind === 'windmill' && Object.hasOwn(houseStocks || {}, 'food')) {
                    const hasRoadAccess = roadAccess.hasAccess;
                    const isCollecting = supplyView.isCollecting === true;
                    const lastCollection = supplyView.lastCollection;
                    const lastImport = supplyView.lastImport;
                    const lastImportDetails = supplyView.lastImportDetails;
                    const maxStock = supplyView.maxStock || 1000;
                    
                    makeInfoSection('Stock moulin');
                    
                    const wheatCollectionAmount = lastCollection?.wheat || 0;
                    const wheatCollectionText = `+${wheatCollectionAmount} dernière collecte`;
                    const wheatImportAmount = lastImport?.wheat !== undefined ? lastImport.wheat : 0;
                    const wheatImportText = `+${wheatImportAmount} paniers importés`;
                    const wheatSubtext = `${wheatCollectionText}, ${wheatImportText}`;

                    const cabbageCollectionAmount = lastCollection?.cabbage || 0;
                    const cabbageCollectionText = `+${cabbageCollectionAmount} dernière collecte`;
                    const cabbageImportAmount = lastImport?.cabbage !== undefined ? lastImport.cabbage : 0;
                    const cabbageImportText = `+${cabbageImportAmount} paniers importés`;
                    const cabbageSubtext = `${cabbageCollectionText}, ${cabbageImportText}`;

                    const carrotCollectionAmount = lastCollection?.carrot || 0;
                    const carrotCollectionText = `+${carrotCollectionAmount} dernière collecte`;
                    const carrotImportAmount = lastImport?.carrot !== undefined ? lastImport.carrot : 0;
                    const carrotImportText = `+${carrotImportAmount} paniers importés`;
                    const carrotSubtext = `${carrotCollectionText}, ${carrotImportText}`;

                    const dattesCollectionAmount = lastCollection?.dattes || 0;
                    const dattesCollectionText = `+${dattesCollectionAmount} dernière collecte`;
                    const dattesImportAmount = lastImport?.dattes !== undefined ? lastImport.dattes : 0;
                    const dattesImportText = `+${dattesImportAmount} paniers importés`;
                    const dattesSubtext = `${dattesCollectionText}, ${dattesImportText}`;

                    const totalCollectionAmount = lastCollection?.total || 0;
                    const totalCollectionText = `+${totalCollectionAmount} dernière collecte`;
                    const totalImportAmount = lastImport?.total !== undefined ? lastImport.total : 0;
                    const totalImportText = `+${totalImportAmount} paniers importés`;
                    const totalSubtext = `${totalCollectionText}, ${totalImportText}`;

                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0}/${maxStock} paniers`, wheatSubtext);
                    makeInfoKeyValue('Chou', `${houseStocks.cabbage || 0}/${maxStock} paniers`, cabbageSubtext);
                    makeInfoKeyValue('Carotte', `${houseStocks.carrot || 0}/${maxStock} paniers`, carrotSubtext);
                    makeInfoKeyValue('Dattes', `${houseStocks.dattes || 0}/${maxStock} paniers`, dattesSubtext);
                    makeInfoKeyValue('Bois', `${houseStocks.wood || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0}/${maxStock} paniers collectés`, totalSubtext);

                    if (lastImportDetails && Object.keys(lastImportDetails).length > 0) {
                        makeInfoSection('Imports par partenaire');

                        const productNames = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou', dattes: 'Dattes', wood: 'Bois' };

                        for (const [productId, partners] of Object.entries(lastImportDetails)) {
                            if (partners && partners.length > 0) {
                                const productName = productNames[productId] || productId;
                                partners.forEach(partnerInfo => {
                                    makeInfoKeyValue(
                                        `${productName}`,
                                        `${partnerInfo.quantity} paniers`,
                                        `depuis ${partnerInfo.partnerName}`
                                    );
                                });
                            }
                        }
                    }

                    makeInfoSection('Approvisionnement');
                    if (hasRoadAccess) {
                        makeInfoKeyValue('Routes', '✅ Accès routier');
                    } else {
                        makeInfoKeyValue('Routes', '❌ Pas d\'accès routier');
                    }
                    makeInfoKeyValue('Source', 'Toutes les fermes du jeu');
                    if (isCollecting) {
                        makeInfoKeyValue('État', '🟢 En collecte (décembre)');
                    } else {
                        makeInfoKeyValue('État', '⏸️ En attente (collecte en décembre)');
                    }
                    
                    if (!hasRoadAccess) {
                        makeInfoBuildingText('⚠️ Sans route le moulin ne peut stocker', false, 'warning-message');
                    }
                    
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ Le moulin tourne à plein régime',
                        noWorkers: '❌ Le moulin manque de bras, il ne peut fonctionner',
                        partialWorkers: '⚠️ Le moulin tourne avec peine car trop peu d\'employés',
                    });
                }
            }
           
            // Only pause/resume when using select-object tool
            // When placing buildings, we don't want to pause the game
            if(infoObjectOverlay.classList.contains('active')) {
                // Disable pointer events on 3D scene when info overlay is active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                game.pause()
            } else {
                // Re-enable pointer events on 3D scene when info overlay is not active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                game.play()
            }
            await runScenePresentationPass(time);
}
