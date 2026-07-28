/**
 * UrbanAdviceManager - Gère le centre de conseils urbains
 */
import { initLoanSystem, loadActiveLoans } from '../loans/LoansManager.js';
import { hasRoadAccessFromCount } from '../../contexts/urban/domain/value-objects/RoadAccess.js';

/**
 * Initialise le centre de conseils urbains
 */
export function initUrbanAdviceCenter() {
    const budgetBtn = document.getElementById('budget-btn');
    const budgetPanel = document.getElementById('budget-panel');
    const budgetCloseBtn = document.querySelector('.budget-close-btn');
    const budgetTabs = document.querySelectorAll('.budget-tab');
    const tabContents = document.querySelectorAll('.budget-tab-content');

    if (!budgetBtn || !budgetPanel || !budgetCloseBtn) {
        return;
    }

    // Toggle panel on budget button click
    budgetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (e.target === budgetBtn || budgetBtn.contains(e.target)) {
            budgetPanel.classList.toggle('active');
            budgetBtn.classList.toggle('active');
            if (budgetPanel.classList.contains('active')) {
                // Load data when opening
                await loadUrbanAnalysis();
                await loadAdvice();
            }
        }
    });

    // Close panel on close button click
    budgetCloseBtn.addEventListener('click', () => {
        budgetPanel.classList.remove('active');
        budgetBtn.classList.remove('active');
    });

    // Close panel when clicking outside
    budgetPanel.addEventListener('click', (e) => {
        if (e.target === budgetPanel) {
            budgetPanel.classList.remove('active');
            budgetBtn.classList.remove('active');
        }
    });

    // Tab switching
    budgetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active class from all tabs and contents
            budgetTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Load specific data based on tab
            if (targetTab === 'analysis') {
                loadUrbanAnalysis();
            } else if (targetTab === 'advice') {
                loadAdvice();
            } else if (targetTab === 'loans') {
                loadActiveLoans();
            }
        });
    });

    // Initialize loan system
    initLoanSystem();
}

/**
 * Charge l'analyse urbaine
 */
export async function loadUrbanAnalysis() {
    try {
        // Get all houses from database
        const houses = await window.housesStore.listAllHouses();
        
        // Analyze social classes
        const socialClasses = {
            red: 0,    // Classe populaire
            blue: 0,   // Classe moyenne  
            purple: 0  // Classe aisée
        };

        // Count houses by color/type
        houses.forEach(house => {
            if (house.type && house.type.includes('House')) {
                if (house.type.includes('Red')) {
                    socialClasses.red++;
                } else if (house.type.includes('Blue')) {
                    socialClasses.blue++;
                } else if (house.type.includes('Purple')) {
                    socialClasses.purple++;
                }
            }
        });

        // Update social classes display
        document.getElementById('red-houses').textContent = socialClasses.red;
        document.getElementById('blue-houses').textContent = socialClasses.blue;
        document.getElementById('purple-houses').textContent = socialClasses.purple;

        // Analyze commerce (markets)
        const markets = houses.filter(house => 
            house.type && house.type.includes('Market')
        );
        document.getElementById('food-markets').textContent = markets.length;

        // Analyze agriculture (farms)
        const farms = houses.filter(house => 
            house.type && house.type.includes('Farm')
        );
        
        const fieldTypes = {
            cabbage: 0,
            wheat: 0,
            carrot: 0
        };

        farms.forEach(farm => {
            if (farm.type.includes('Cabbage')) fieldTypes.cabbage++;
            else if (farm.type.includes('Wheat')) fieldTypes.wheat++;
            else if (farm.type.includes('Carrot')) fieldTypes.carrot++;
        });

        document.getElementById('cabbage-fields').textContent = fieldTypes.cabbage;
        document.getElementById('wheat-fields').textContent = fieldTypes.wheat;
        document.getElementById('carrot-fields').textContent = fieldTypes.carrot;


    } catch (error) {
        console.error('Error loading urban analysis:', error);
    }
}

/**
 * Charge les conseils
 */
export async function loadAdvice() {
    const adviceList = document.getElementById('advice-list');
    
    try {
        // Get current city data
        const houses = await window.housesStore.listAllHouses();
        const budget = await window.budgetManager.getCurrentBudget();
        
        const advice = [];

        // Check for missing markets
        const markets = houses.filter(house => 
            house.type && house.type.includes('Market')
        );
        
        if (markets.length === 0) {
            advice.push({
                type: 'priority',
                icon: '🛒',
                title: 'Marché manquant',
                description: 'Construisez un marché de nourriture pour distribuer les ressources agricoles à vos habitants.'
            });
        }

        // Check for food production vs population
        const farms = houses.filter(house => 
            house.type && house.type.includes('Farm')
        );
        const totalPopulation = houses.reduce((sum, house) => 
            sum + (house.pop || 0), 0
        );

        if (totalPopulation > 0 && farms.length === 0) {
            advice.push({
                type: 'priority',
                icon: '🌾',
                title: 'Production alimentaire insuffisante',
                description: 'Vos habitants ont besoin de nourriture. Construisez des fermes pour produire des aliments.'
            });
        }

        // Check for road connectivity (use helper when available; fallback preserved)
        const housesWithoutRoads = [];
        for (const house of houses) {
            if (!house.type || !house.type.includes('House')) continue;
            const hasRoadAccess = hasRoadAccessFromCount(house.roads);
            if (!hasRoadAccess) housesWithoutRoads.push(house);
        }

        if (housesWithoutRoads.length > 0) {
            advice.push({
                type: 'priority',
                icon: '🛣️',
                title: 'Maisons sans accès routier',
                description: `${housesWithoutRoads.length} maison(s) n'ont pas d'accès aux routes. Connectez-les pour permettre le commerce.`
            });
        }

        // Financial advice
        if (budget.funds < 50) {
            advice.push({
                type: 'priority',
                icon: '💰',
                title: 'Fonds insuffisants',
                description: 'Vos fonds sont faibles. Considérez contracter un prêt ou réduire vos dépenses.'
            });
        } else if (budget.funds > 500) {
            advice.push({
                type: 'suggestion',
                icon: '🏗️',
                title: 'Opportunité d\'expansion',
                description: 'Vous avez des fonds suffisants pour développer votre ville. Construisez de nouveaux bâtiments !'
            });
        }

        // Social balance advice
        const socialClasses = {
            red: houses.filter(h => h.type && h.type.includes('Red')).length,
            blue: houses.filter(h => h.type && h.type.includes('Blue')).length,
            purple: houses.filter(h => h.type && h.type.includes('Purple')).length
        };

        const totalHouses = socialClasses.red + socialClasses.blue + socialClasses.purple;
        if (totalHouses > 0) {
            const redPercentage = (socialClasses.red / totalHouses) * 100;
            if (redPercentage > 70) {
                advice.push({
                    type: 'suggestion',
                    icon: '🏘️',
                    title: 'Diversité sociale',
                    description: 'Votre ville est principalement composée de maisons populaires. Diversifiez avec des maisons de classe moyenne et aisée.'
                });
            }
        }

        // Display advice
        if (advice.length === 0) {
            adviceList.innerHTML = `
                <div class="advice-item suggestion">
                    <div class="advice-header">
                        <div class="advice-icon">✅</div>
                        <div class="advice-title">Ville équilibrée</div>
                    </div>
                    <div class="advice-description">Votre ville semble bien équilibrée ! Continuez sur cette voie.</div>
                </div>
            `;
        } else {
            adviceList.innerHTML = advice.map(item => `
                <div class="advice-item ${item.type}">
                    <div class="advice-header">
                        <div class="advice-icon">${item.icon}</div>
                        <div class="advice-title">${item.title}</div>
                    </div>
                    <div class="advice-description">${item.description}</div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Error loading advice:', error);
        adviceList.innerHTML = `
            <div class="advice-loading">
                Erreur lors du chargement des conseils
            </div>
        `;
    }
}

