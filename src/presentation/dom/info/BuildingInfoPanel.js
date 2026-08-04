/**
 * Building info overlay (select-object tool) — DOM presentation.
 */

import { TimeManager } from '../../../shared/time/TimeManager.js';
import { buildingsObjects } from '../../../shared/building-catalog/index.js';
import {
  footprintFromRecord,
  footprintTilesAsPairs,
} from '../../../shared/building-identity/index.js';
import { infoObjectOverlay } from '../shell/nodes.js';
import {
  makeInfoBuildingText,
  makeInfoKeyValue,
  makeInfoSection,
} from './buildingInfoDom.js';
import {
  renderHubStorageInfoPanel,
  clearHubInfoOverlayMode,
} from './hubStorageInfoPanel.js';
import {
  residentialGroupForType,
  getResidentialGroupLabel,
} from '../shell/ResidentialGroupLabels.js';

/**
 * @param {ReadonlyArray<[number, number]> | null | undefined} tiles
 * @returns {string}
 */
function formatTerrainFootprint(tiles) {
  if (!tiles?.length) return '—';
  return tiles.map(([tx, ty]) => `(${tx},${ty})`).join(', ');
}

/**
 * Anchor + footprintTiles for the info overlay (quartier-ready later).
 * @param {object | null | undefined} buildingRow
 * @param {number} clickX
 * @param {number} clickY
 */
function resolveTerrainDisplay(buildingRow, clickX, clickY) {
  const footprint = buildingRow ? footprintFromRecord(buildingRow) : null;
  if (footprint) {
    return {
      anchorX: footprint.anchor.x,
      anchorY: footprint.anchor.y,
      terrainLabel: formatTerrainFootprint(footprintTilesAsPairs(footprint)),
    };
  }
  return {
    anchorX: clickX,
    anchorY: clickY,
    terrainLabel: formatTerrainFootprint([[clickX, clickY]]),
  };
}

/**
 * Info panel: workplace staffing section (workers in aggregates; elites display-only).
 */
function renderWorkplaceEmployeesInfo(buildingData, messages, employment) {
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
    const priority = employment.getSectorPriority(sector);

    makeInfoSection('Employés');

    if (roadCount <= 0 && !farmExemptFromRoad) {
        makeInfoBuildingText('🚧 Route nécessaire pour embaucher', false, 'warning-message');
        return;
    }

    const hasEnoughWorkers = workers >= workerNeed;
    const hasNoWorkers = workers === 0 && workerNeed > 0;
    const hasPartialWorkers = workers > 0 && workers < workerNeed;

    makeInfoKeyValue('Secteur', `${sector} : ${employment.getSectorName(sector)}`);
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
 *   construction: object,
 *   employment: object,
 *   accounting: object,
 * }} ctx
 */
export async function presentBuildingInfoSelection(selectedObject, ctx) {
    const {
      city, parcels, supply, housing, scene, game, time, runScenePresentationPass,
      construction, employment, accounting,
    } = ctx;
            // Object selection - ONLY open info modal when using select tool
            // Only open the info modal if we actually have info to show (i.e., on building objects)
            let shouldOpenInfo = false;

            // Reset content first
            makeInfoBuildingText("", true);
            clearHubInfoOverlayMode();

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
                    ?? (await construction.findBuildingAtTile({ x: selX, y: selY }))?.instanceId
                    ?? null;
                
                const buildingRow = uniqueId ? await construction.getBuildingById(uniqueId) : null;
                const { anchorX, anchorY, terrainLabel } = resolveTerrainDisplay(
                    buildingRow,
                    selX,
                    selY
                );
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
                    makeInfoKeyValue('Adresse', `x: ${anchorX} | y: ${anchorY}`);
                    makeInfoKeyValue('Terrain', terrainLabel);
                    
                    // Nature stocks are not Supply — read building row for wood/rock/etc.
                    houseStocks = buildingRow?.stocks ?? (await construction.getBuildingField(uniqueId, 'stocks'));
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
                    makeInfoKeyValue('Adresse', `x: ${anchorX} | y: ${anchorY}`);
                    makeInfoKeyValue('Terrain', terrainLabel);
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
                    
                    // Evolution section — group + level (see HouseLevelPolicy)
                    const buildingType = selectedObject.userData.id;
                    const hasRoadAccess = roadAccess.hasAccess;

                    makeInfoSection('Évolution');

                    const residentialGroup = residentialGroupForType(buildingType);
                    if (residentialGroup) {
                        const houseLevel = buildingRow?.level === 2 ? 2 : 1;
                        const groupLabel = getResidentialGroupLabel(residentialGroup);
                        makeInfoKeyValue('Groupe social', groupLabel);

                        if (houseLevel === 1) {
                            const isInhabited = (buildingPop || 0) > 0;
                            const roadStatus = hasRoadAccess ? '✅' : '❌';
                            const popStatus = isInhabited ? '✅' : '❌';
                            makeInfoKeyValue('Niveau', '1 — Chasseurs-cueilleurs (autarcie)');
                            makeInfoKeyValue(`→ Niveau 2 (${groupLabel})`, '');
                            makeInfoKeyValue('  • Accès routier', `${roadStatus} ${hasRoadAccess ? 'Oui' : 'Non'}`);
                            makeInfoKeyValue('  • Habitée', `${popStatus} ${isInhabited ? 'Oui' : 'Non'}`);
                        } else {
                            makeInfoKeyValue('Niveau', `2 — Métier ${groupLabel.toLowerCase()} (route requise)`);
                            if (!hasRoadAccess) {
                                makeInfoBuildingText(
                                    '🚧 Route perdue : régression au niveau 1 imminente',
                                    false,
                                    'warning-message'
                                );
                            }
                        }
                    }

                    // Palace: no further evolution (frozen legacy path, see EvolveHouseBuilding)
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
                    }, employment);
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
                    const budget = await accounting.getTreasurySnapshot();
                    if (budget && budget.turn !== undefined) {
                        const timeInfo = TimeManager.getTimeInfo(budget.turn);
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
                    }, employment);
                }

                // Display windmill hub panel (Cesar III inspired)
                if (supplyView?.kind === 'windmill' && Object.hasOwn(houseStocks || {}, 'food')) {
                    const hubView = supply.getHubStorageInfoView('windmill', buildingRow, {
                        stocks: houseStocks,
                        maxStock: supplyView.maxStock,
                    });
                    await renderHubStorageInfoPanel({
                        view: hubView,
                        buildingId: uniqueId,
                        supply,
                        buildingRow,
                        supplyView,
                    });
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ Le moulin tourne à plein régime',
                        noWorkers: '❌ Le moulin manque de bras, il ne peut fonctionner',
                        partialWorkers: '⚠️ Le moulin tourne avec peine car trop peu d\'employés',
                    }, employment);
                }

                if (buildingRow?.type?.includes('Barn')) {
                    const hubView = supply.getHubStorageInfoView('barn', buildingRow);
                    await renderHubStorageInfoPanel({
                        view: hubView,
                        buildingId: uniqueId,
                        supply,
                        buildingRow,
                    });
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ La grange peut stocker jusqu\'à sa capacité',
                        noWorkers: '❌ Aucun magasinier — stockage impossible',
                        partialWorkers: '⚠️ Capacité limitée par le nombre d\'ouvriers',
                    }, employment);
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
