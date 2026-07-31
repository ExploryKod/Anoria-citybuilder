/**
 * RandomEventsService - Gère les événements aléatoires du jeu
 * Ouragan, inondation, etc.
 */
import { isEventsEnabled, getEventProbability, getDaysPerMonth } from '../../../config/events.js';
import { SimService } from './SimService.js';
import { listAllBuildingRows } from '../../acl/construction.js';
import { syncRemovedBuilding } from '../../acl/parcels.js';
import { instanceIdFromHouseRow } from '../../acl/building-identity.js';
import { TimeManager } from '../utils/TimeManager.js';

export class RandomEventsService extends SimService {
    
    /**
     * Met à jour firstYearEnd en utilisant la valeur depuis localStorage
     */
    updateFirstYearEnd() {
        this.firstYearEnd = 12 * getDaysPerMonth();
    }
    constructor() {
        super();
        
        // Charger la probabilité depuis localStorage (en pourcentage, convertie en 0-1)
        const probabilityPercent = getEventProbability();
        this.eventProbability = probabilityPercent / 100;
        
        // Si probabilité élevée (>= 50%), on considère que c'est un mode test et on réduit le délai minimum
        if (probabilityPercent >= 50) {
            this.minTurnsBetweenEvents = 0; // Pas de minimum pour le test
        } else {
            this.minTurnsBetweenEvents = 10; // Minimum 10 tours entre événements
        }
        
        // Dernier tour où un événement s'est produit (pour éviter les événements trop fréquents)
        this.lastEventTurn = -10;
        // Première année = 12 mois, donc 12 * DAYS_PER_MONTH tours
        // Utiliser getDaysPerMonth() depuis events.js pour avoir la valeur depuis localStorage
        this.updateFirstYearEnd();
    }

    /**
     * Liste des événements possibles
     */
    getAvailableEvents() {
        return [
            {
                type: 'ouragan',
                name: 'Ouragan',
                cost: 150,
                description: 'Un violent ouragan a frappé votre ville !'
            },
            {
                type: 'inondation',
                name: 'Inondation',
                cost: 150,
                description: 'Une inondation a dévasté votre ville !'
            }
        ];
    }

    /**
     * Sélectionne un événement aléatoire
     */
    selectRandomEvent() {
        const events = this.getAvailableEvents();
        const randomIndex = Math.floor(Math.random() * events.length);
        return events[randomIndex];
    }

    /**
     * Trouve une maison aléatoire à détruire
     */
    async findRandomHouse() {
        try {
            const allHouses = await listAllBuildingRows();
            
            // Filtrer pour ne garder que les maisons (House-Blue, House-Red, House-Purple, House-2Story)
            const houses = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('House');
            });

            if (houses.length === 0) {
                return null;
            }

            // Sélectionner une maison aléatoire
            const randomIndex = Math.floor(Math.random() * houses.length);
            return houses[randomIndex];
        } catch (error) {
            console.error('[RandomEventsService] Error finding random house:', error);
            return null;
        }
    }

    /**
     * Supprime un bâtiment de la scène
     */
    async removeBuildingFromScene(house, city) {
        try {
            const x = house.x;
            const y = house.y;

            // Vérifier que les coordonnées sont valides
            if (typeof x !== 'number' || typeof y !== 'number' || 
                !city.tiles || !city.tiles[x] || !city.tiles[x][y]) {
                console.warn('[RandomEventsService] Invalid coordinates:', { x, y });
                return false;
            }

            // Retirer le buildingId du tile - la scène se mettra à jour au prochain tour
            city.tiles[x][y].buildingId = undefined;

            // Forcer une mise à jour de la scène si possible
            if (window.game && window.game.scene && window.game.city) {
                // La scène se mettra à jour automatiquement au prochain tour
                // mais on peut aussi forcer une mise à jour immédiate si nécessaire
                // await window.game.scene.update(window.game.city, window.game.time || 0);
            }

            return true;
        } catch (error) {
            console.error('[RandomEventsService] Error removing building from scene:', error);
            return false;
        }
    }

    /**
     * Déclenche un événement
     */
    async triggerEvent(event, city, time) {
        try {
            // Trouver une maison à détruire
            const houseToDestroy = await this.findRandomHouse();
            
            if (!houseToDestroy) {
                return;
            }

            // Déduire le coût de réparation (dépense exceptionnelle, pas une construction)
            if (window.budgetManager) {
                await window.budgetManager.addExceptionalExpense(
                    event.cost,
                    `${event.name}: ${event.description} - Maison détruite et réparations`
                );
            }

            // Supprimer la maison de la base de données EN PREMIER
            const houseId = instanceIdFromHouseRow(houseToDestroy);
            if (houseId) {
                await syncRemovedBuilding({ instanceId: houseId });
            }

            // Supprimer la maison de la scène (retirer le buildingId du tile)
            await this.removeBuildingFromScene(houseToDestroy, city);
            
            // Forcer une mise à jour immédiate de la scène pour supprimer visuellement le bâtiment
            // La scène vérifiera maintenant que le bâtiment n'existe plus dans la DB et le supprimera
            if (window.game && window.game.scene && window.game.city) {
                try {
                    const currentTime = window.game.time || 0;
                    // Forcer une mise à jour immédiate pour que la suppression soit visible tout de suite
                    await window.game.scene.update(window.game.city, currentTime, { skipBudget: true });
                } catch (err) {
                    console.warn('[RandomEventsService] Could not force scene update:', err);
                }
            }

            // Afficher une notification
            this.showEventNotification(event, houseToDestroy);

            return true;
        } catch (error) {
            console.error('[RandomEventsService] Error triggering event:', error);
            return false;
        }
    }

    /**
     * Affiche une notification d'événement
     */
    showEventNotification(event, house) {
        // Créer une notification toast
        const notification = document.createElement('div');
        notification.className = 'event-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                ⚠️ ${event.name}
            </div>
            <div style="margin-bottom: 10px;">
                ${event.description}
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                Une maison a été détruite à (${house.x}, ${house.y})<br>
                Coût de réparation : ${event.cost}€
            </div>
        `;

        // Ajouter l'animation CSS si elle n'existe pas
        if (!document.getElementById('event-notification-style')) {
            const style = document.createElement('style');
            style.id = 'event-notification-style';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Supprimer la notification après 5 secondes
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    /**
     * Méthode principale appelée à chaque tour
     */
    async simulate(city, time = 0) {
        try {
            // Vérifier si les événements sont activés
            if (!isEventsEnabled()) {
                return; // Événements désactivés
            }

            // Recharger la probabilité depuis localStorage (peut avoir changé)
            const probabilityPercent = getEventProbability();
            this.eventProbability = probabilityPercent / 100;
            
            // Mettre à jour le délai minimum selon la probabilité
            if (probabilityPercent >= 50) {
                this.minTurnsBetweenEvents = 0;
            } else {
                this.minTurnsBetweenEvents = 10;
            }
            
            // Mettre à jour firstYearEnd au cas où daysPerMonth aurait changé
            this.updateFirstYearEnd();

            // AUCUN événement pendant la première année (12 premiers tours)
            if (time <= this.firstYearEnd) {
                return; // Pas d'événements la première année
            }

            // Vérifier si assez de temps s'est écoulé depuis le dernier événement
            const turnsSinceLastEvent = time - this.lastEventTurn;
            if (turnsSinceLastEvent < this.minTurnsBetweenEvents) {
                return; // Trop tôt pour un nouvel événement
            }

            // Vérifier s'il y a des maisons dans la ville
            const allHouses = await listAllBuildingRows();
            const houses = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('House');
            });

            if (houses.length === 0) {
                return; // Pas de maisons à détruire
            }

            // Tirage aléatoire pour déterminer si un événement se produit
            const randomValue = Math.random();
            if (randomValue <= this.eventProbability) {
                // Sélectionner un événement aléatoire
                const event = this.selectRandomEvent();
                
                // Déclencher l'événement
                await this.triggerEvent(event, city, time);
                
                // Mettre à jour le dernier tour d'événement
                this.lastEventTurn = time;
            }
        } catch (error) {
            console.error('[RandomEventsService] Error in simulate:', error);
        }
    }
}

