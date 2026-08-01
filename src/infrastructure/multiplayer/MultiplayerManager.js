/**
 * Gestionnaire multijoueur
 * Intègre WebSocket avec le jeu existant
 */

import { WebSocketClient } from './WebSocketClient.js';
import { getGame, getGameCity, getPopupManager } from '../../composition/sessionShell.js';

export class MultiplayerManager {
    constructor(game, scene) {
        this.game = game;
        this.scene = scene;
        this.wsClient = null;
        this.isMultiplayer = false;
        this.remoteBuildings = new Map(); // Bâtiments placés par d'autres joueurs
        this.playersList = []; // Liste locale des joueurs connectés
    }

    /**
     * Active le mode multijoueur
     * @param {string} serverUrl - URL du serveur WebSocket (ex: 'ws://localhost:9876')
     * @param {string} playerPseudo - Pseudo du joueur
     * @param {string|number} roomIdOrCitySize - ID du salon à rejoindre ou taille de ville pour créer un salon
     * @param {string} action - 'create' pour créer un salon, 'join' pour rejoindre
     * @param {string} roomName - Nom du salon (optionnel, seulement pour 'create')
     */
    async enable(serverUrl = 'ws://localhost:9876', playerPseudo = 'Joueur', roomIdOrCitySize = null, action = 'create', roomName = null) {
        this.playerPseudo = playerPseudo;
        if (this.isMultiplayer) {
            console.warn('[Multiplayer] Déjà activé');
            return;
        }

        console.log('[Multiplayer] Activation du mode multijoueur...');
        
        this.wsClient = new WebSocketClient(serverUrl, playerPseudo);
        this.setupEventHandlers();
        
        // Gérer la connexion refusée avant de connecter
        return new Promise((resolve, reject) => {
            let connectionRefused = false;
            let roomCreatedOrJoined = false;
            
            const onRefused = (data) => {
                connectionRefused = true;
                this.wsClient.off('connectionRefused', onRefused);
                this.showConnectionRefusedAlert(data);
                reject(new Error('MAX_PLAYERS_REACHED'));
            };
            
            const onRoomCreated = (data) => {
                roomCreatedOrJoined = true;
                this.wsClient.off('roomCreated', onRoomCreated);
                console.log('[Multiplayer] Salon créé:', data.roomId);
                this.isMultiplayer = true;
                // Mettre le jeu en pause si seul dans le salon
                this.checkAndPauseIfAlone();
                resolve();
            };
            
            const onRoomJoined = (data) => {
                roomCreatedOrJoined = true;
                this.wsClient.off('roomJoined', onRoomJoined);
                console.log('[Multiplayer] Salon rejoint:', data.roomId);
                this.isMultiplayer = true;
                // Mettre le jeu en pause si seul dans le salon
                this.checkAndPauseIfAlone();
                resolve();
            };
            
            this.wsClient.on('connectionRefused', onRefused);
            this.wsClient.on('roomCreated', onRoomCreated);
            this.wsClient.on('roomJoined', onRoomJoined);
            
            this.wsClient.connect()
                .then(() => {
                    if (!connectionRefused) {
                        // Une fois connecté, créer ou rejoindre le salon
                        if (action === 'join' && roomIdOrCitySize) {
                            // Rejoindre un salon existant
                            this.wsClient.send('JOIN_ROOM', {
                                roomId: roomIdOrCitySize,
                                playerPseudo: playerPseudo
                            });
                        } else if (action === 'create' && roomIdOrCitySize) {
                            // Créer un nouveau salon avec la taille spécifiée
                            this.wsClient.send('CREATE_ROOM', {
                                citySize: roomIdOrCitySize,
                                playerPseudo: playerPseudo,
                                roomName: roomName
                            });
                        } else {
                            // Ancien comportement (fallback)
                            this.wsClient.off('connectionRefused', onRefused);
                            this.isMultiplayer = true;
                            console.log('[Multiplayer] Mode multijoueur activé');
                            resolve();
                        }
                    }
                })
                .catch((error) => {
                    if (!connectionRefused) {
                        this.wsClient.off('connectionRefused', onRefused);
                        this.wsClient.off('roomCreated', onRoomCreated);
                        this.wsClient.off('roomJoined', onRoomJoined);
                        console.error('[Multiplayer] Erreur de connexion:', error);
                        this.isMultiplayer = false;
                        this.showConnectionFailedAlert();
                        reject(error);
                    }
                });
        });
    }

    /**
     * Configure les handlers d'événements WebSocket
     */
    setupEventHandlers() {
        // Connexion établie
        this.wsClient.on('connected', () => {
            console.log('[Multiplayer] Connecté au serveur');
        });

        // Connexion refusée (limite de joueurs atteinte)
        this.wsClient.on('connectionRefused', (data) => {
            console.error('[Multiplayer] Connexion refusée:', data);
            this.isMultiplayer = false;
            this.showConnectionRefusedAlert(data);
        });

        // ID joueur reçu
        this.wsClient.on('playerId', (playerId) => {
            console.log(`[Multiplayer] ID joueur: ${playerId}`);
            // Vous pouvez stocker l'ID pour l'afficher dans l'UI
            const game = getGame();
            if (game) {
                game.playerId = playerId;
            }
            
            // Ajouter ce joueur à la liste locale avec le bon pseudo
            const existingPlayer = this.playersList.find(p => p.id === playerId);
            if (!existingPlayer) {
                this.playersList.push({
                    id: playerId,
                    pseudo: this.playerPseudo || 'Joueur'
                });
            } else {
                // Mettre à jour le pseudo si nécessaire
                existingPlayer.pseudo = this.playerPseudo || existingPlayer.pseudo || 'Joueur';
            }
            // Mettre à jour l'affichage
            this.updatePlayersList(this.playersList);
        });

        // Synchronisation complète
        this.wsClient.on('fullSync', (data) => {
            console.log('[Multiplayer] Synchronisation complète reçue');
            this.handleFullSync(data);
            
            // Mettre à jour la liste locale des joueurs avec tous les pseudos
            if (data.players && Array.isArray(data.players)) {
                console.log('[Multiplayer] Joueurs reçus:', data.players);
                this.playersList = data.players.map(p => ({
                    id: p.id,
                    pseudo: p.pseudo || 'Joueur'
                }));
                
                // S'assurer que notre propre pseudo est correct
                const myPlayer = this.playersList.find(p => p.id === this.wsClient?.playerId);
                if (myPlayer && this.playerPseudo) {
                    myPlayer.pseudo = this.playerPseudo;
                }
                
                this.updatePlayersList(this.playersList);
            }
        });

        // Bâtiment confirmé (celui qu'on a placé)
        this.wsClient.on('buildConfirmed', (data) => {
            console.log('[Multiplayer] Bâtiment confirmé:', data);
            // Le bâtiment est déjà placé localement, on peut juste confirmer
            this.showNotification(`Bâtiment placé: ${data.building.type}`, 'success');
        });

        // Bâtiment placé par un autre joueur
        this.wsClient.on('buildBroadcast', (data) => {
            console.log('[Multiplayer] Bâtiment d\'un autre joueur:', data);
            this.handleRemoteBuild(data.building);
        });

        // Joueur rejoint
        this.wsClient.on('playerJoined', (data) => {
            const pseudo = data.playerPseudo || 'Joueur';
            console.log(`[Multiplayer] ${pseudo} a rejoint (Total: ${data.totalPlayers})`);
            this.showNotification(`${pseudo} a rejoint`, 'info');
            
            // Ajouter ou mettre à jour le joueur dans la liste locale
            const existingPlayer = this.playersList.find(p => p.id === data.playerId);
            if (!existingPlayer) {
                this.playersList.push({
                    id: data.playerId,
                    pseudo: pseudo
                });
            } else {
                // Mettre à jour le pseudo si fourni
                if (data.playerPseudo) {
                    existingPlayer.pseudo = data.playerPseudo;
                }
            }
            this.updatePlayersList(this.playersList);
            
            // Si on était seul et qu'un joueur rejoint, reprendre le jeu
            this.checkAndPauseIfAlone();
        });

        // Joueur parti
        this.wsClient.on('playerLeft', (data) => {
            const pseudo = data.playerPseudo || data.playerId.substring(0, 8);
            console.log(`[Multiplayer] ${pseudo} est parti (Total: ${data.totalPlayers})`);
            
            // Afficher une alerte visible pour la déconnexion
            this.showDisconnectionAlert(pseudo);
            
            // Retirer le joueur de la liste locale
            this.playersList = this.playersList.filter(p => p.id !== data.playerId);
            this.updatePlayersList(this.playersList);
            
            // Vérifier si on doit mettre en pause (si on est seul maintenant)
            this.checkAndPauseIfAlone();
        });

        // Pseudo mis à jour
        this.wsClient.on('playerPseudoUpdated', (data) => {
            // Mettre à jour le pseudo dans la liste locale
            const player = this.playersList.find(p => p.id === data.playerId);
            if (player) {
                player.pseudo = data.playerPseudo;
            } else {
                // Ajouter le joueur s'il n'existe pas encore
                this.playersList.push({
                    id: data.playerId,
                    pseudo: data.playerPseudo || 'Joueur'
                });
            }
            this.updatePlayersList(this.playersList);
        });

        // Liste des joueurs mise à jour (broadcast du serveur)
        this.wsClient.on('playersListUpdate', (data) => {
            if (data.players && Array.isArray(data.players)) {
                console.log('[Multiplayer] Liste des joueurs mise à jour:', data.players);
                this.playersList = data.players.map(p => ({
                    id: p.id,
                    pseudo: p.pseudo || 'Joueur'
                }));
                
                // S'assurer que notre propre pseudo est correct
                const myPlayer = this.playersList.find(p => p.id === this.wsClient?.playerId);
                if (myPlayer && this.playerPseudo) {
                    myPlayer.pseudo = this.playerPseudo;
                }
                
                this.updatePlayersList(this.playersList);
                
                // Vérifier si on doit mettre en pause ou reprendre
                this.checkAndPauseIfAlone();
            }
        });

        // Erreur
        this.wsClient.on('error', (error) => {
            console.error('[Multiplayer] Erreur:', error);
            this.showNotification(`Erreur: ${error.message || error.code}`, 'error');
        });

        // Échec de connexion
        this.wsClient.on('connectionFailed', (data) => {
            console.error('[Multiplayer] Échec de connexion:', data);
            if (this.isMultiplayer) {
                this.isMultiplayer = false;
                this.showConnectionFailedAlert();
            }
        });

        // Déconnexion
        this.wsClient.on('disconnected', () => {
            console.log('[Multiplayer] Déconnecté du serveur');
            this.showNotification('Déconnecté du serveur', 'warning');
        });

        // Échec de reconnexion après plusieurs tentatives
        this.wsClient.on('reconnectFailed', () => {
            console.error('[Multiplayer] Échec de reconnexion après plusieurs tentatives');
            this.isMultiplayer = false;
            this.showConnectionFailedAlert();
        });
    }

    /**
     * Gère la synchronisation complète
     */
    async handleFullSync(data) {
        console.log(`[Multiplayer] Synchronisation: ${data.buildings.length} bâtiments, ${data.players.length} joueurs`);
        
        // Mettre à jour la liste des joueurs
        if (data.players && Array.isArray(data.players)) {
            this.playersList = data.players.map(p => ({
                id: p.id,
                pseudo: p.pseudo || 'Joueur'
            }));
            this.updatePlayersList(this.playersList);
        }
        
        // Placer tous les bâtiments distants
        for (const building of data.buildings) {
            // Ne pas replacer nos propres bâtiments
            if (building.playerId !== this.wsClient.playerId) {
                await this.placeRemoteBuilding(building);
            }
        }
        
        // Vérifier si on doit mettre en pause (si seul)
        this.checkAndPauseIfAlone();
    }

    /**
     * Gère le placement d'un bâtiment par un autre joueur
     */
    async handleRemoteBuild(building) {
        // Vérifier si on n'a pas déjà ce bâtiment
        if (this.remoteBuildings.has(building.id)) {
            return;
        }

        await this.placeRemoteBuilding(building);
    }

    /**
     * Vérifie si on est seul dans le salon et met en pause si nécessaire
     */
    checkAndPauseIfAlone() {
        if (!this.isMultiplayer || !this.game) {
            return;
        }
        
        // Compter les joueurs (nous inclus)
        const totalPlayers = this.playersList.length;
        
        if (totalPlayers < 2) {
            // Seul dans le salon - mettre en pause et afficher le message
            if (this.game && typeof this.game.pause === 'function') {
                this.game.pause();
            }
            this.showWaitingForPlayerMessage(true);
        } else {
            // Au moins 2 joueurs - reprendre le jeu et masquer le message
            this.showWaitingForPlayerMessage(false);
            if (this.game && typeof this.game.play === 'function') {
                this.game.play();
                this.showNotification('Partie démarrée !', 'success');
            }
        }
    }

    /**
     * Affiche ou masque le message d'attente d'un joueur
     * @param {boolean} show - True pour afficher, false pour masquer
     */
    showWaitingForPlayerMessage(show) {
        let messageEl = document.getElementById('multiplayer-waiting-message');
        
        if (show) {
            if (!messageEl) {
                // Créer le message s'il n'existe pas
                messageEl = document.createElement('div');
                messageEl.id = 'multiplayer-waiting-message';
                messageEl.innerHTML = `
                    <div class="waiting-message-content">
                        <div class="waiting-message-icon">⏳</div>
                        <div class="waiting-message-text">En attente d'un nouveau joueur...</div>
                    </div>
                `;
                document.body.appendChild(messageEl);
            }
            messageEl.style.display = 'flex';
        } else {
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }
    }

    /**
     * Place un bâtiment distant dans la scène
     */
    async placeRemoteBuilding(building) {
        try {
            const { type, x, y, id, playerId, playerPseudo } = building;

            // Vérifier si on n'a pas déjà ce bâtiment
            if (this.remoteBuildings.has(id)) {
                return;
            }

            // Récupérer la ville depuis le jeu
            if (!this.game || !this.game.scene || !getGame()) {
                console.warn('[Multiplayer] Impossible de placer bâtiment: jeu non initialisé');
                return;
            }

            // Accéder à la ville via le jeu
            const city = getGameCity() || (this.game && this.game.city);
            
            if (!city || !city.tiles) {
                console.warn('[Multiplayer] Impossible de placer bâtiment: ville non trouvée');
                return;
            }

            // Marquer la position dans la ville (sans payer ni ajouter à la DB)
            // On utilise juste la scène pour l'affichage visuel
            if (city.tiles[x] && city.tiles[x][y]) {
                city.tiles[x][y].buildingId = type;
            }

            // Mettre à jour la scène pour afficher le bâtiment
            await this.scene.update(city, 0, { skipBudget: true });

            // Marquer comme placé
            this.remoteBuildings.set(id, building);
            
            const pseudo = playerPseudo || playerId.substring(0, 8);
            this.showNotification(`${pseudo} a placé: ${type} à (${x}, ${y})`, 'info');
        } catch (error) {
            console.error('[Multiplayer] Erreur placement bâtiment distant:', error);
        }
    }

    /**
     * Place un bâtiment (appelé depuis le jeu)
     * @param {string} buildingType - Type de bâtiment
     * @param {number} x - Position X
     * @param {number} y - Position Y
     */
    async placeBuilding(buildingType, x, y) {
        if (!this.isMultiplayer || !this.wsClient) {
            return false;
        }

        // Envoyer au serveur
        this.wsClient.build(buildingType, x, y);
        
        // Le serveur confirmera, on attend la confirmation
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout attente confirmation serveur'));
            }, 5000);

            const onConfirmed = (data) => {
                if (data.building.x === x && data.building.y === y) {
                    clearTimeout(timeout);
                    this.wsClient.off('buildConfirmed', onConfirmed);
                    resolve(data);
                }
            };

            const onError = (error) => {
                if (error.code === 'POSITION_OCCUPIED' || error.code === 'OUT_OF_BOUNDS') {
                    clearTimeout(timeout);
                    this.wsClient.off('error', onError);
                    reject(error);
                }
            };

            this.wsClient.on('buildConfirmed', onConfirmed);
            this.wsClient.on('error', onError);
        });
    }

    /**
     * Affiche une alerte d'échec de connexion et propose le mode solo
     * Style simple comme les modales du jeu
     */
    showConnectionFailedAlert() {
        // Créer une modale simple comme les autres modales du jeu
        const modal = document.createElement('div');
        modal.className = 'multiplayer-error-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: var(--z-index-modal, 10000);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            background: #fafafa;
            color: var(--primary, #333);
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            width: 90%;
            max-width: 500px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 0;
            overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            background: white;
            padding: 20px;
            border-bottom: 2px solid var(--cta, #fb8122);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0; font-size: 1.4rem; font-weight: 600; color: var(--primary, #333);">Serveur multijoueur inaccessible</h3>
            <button class="modal-close-btn" style="background: white; border: 3px solid var(--cta, #fb8122); color: var(--cta, #fb8122); width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-size: 24px; line-height: 1;">×</button>
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;
        content.innerHTML = `
            <p style="margin: 0; color: var(--primary, #333); font-size: 14px; line-height: 1.5;">
                Le serveur multijoueur est actuellement inaccessible. Voulez-vous continuer en mode solo ?
            </p>
        `;
        
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 0 20px 20px;
        `;
        actions.innerHTML = `
            <button class="modal-btn secondary" id="dismiss-btn" style="background: white; color: var(--cta, #fb8122); border: 3px solid var(--cta, #fb8122); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 80px;">Fermer</button>
            <button class="modal-btn" id="switch-to-solo-btn" style="background-color: var(--cta, #fb8122); color: white; border: 3px solid var(--cta, #fb8122); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 80px;">Jouer en solo</button>
        `;
        
        wrapper.appendChild(header);
        wrapper.appendChild(content);
        wrapper.appendChild(actions);
        modal.appendChild(wrapper);
        document.body.appendChild(modal);
        
        // Bouton fermer (X)
        header.querySelector('.modal-close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Bouton "Fermer"
        actions.querySelector('#dismiss-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Bouton "Jouer en solo"
        actions.querySelector('#switch-to-solo-btn').addEventListener('click', () => {
            this.switchToSoloMode();
            modal.remove();
        });
    }

    /**
     * Bascule en mode solo
     */
    switchToSoloMode() {
        console.log('[Multiplayer] Basculement en mode solo...');
        
        // Désactiver le mode multijoueur
        this.disable();
        
        // Reprendre le jeu si il était en pause
        if (this.game && typeof this.game.play === 'function') {
            this.game.play();
        }
        
        // Masquer le message d'attente
        this.showWaitingForPlayerMessage(false);
        
        // Afficher une notification de confirmation
        this.showNotification('Mode solo activé', 'success');
        
        // Émettre un événement pour que le code externe puisse réagir
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('multiplayer-switched-to-solo'));
        }
    }

    /**
     * Affiche une alerte de connexion refusée (limite de joueurs)
     * Style simple comme les modales du jeu
     */
    showConnectionRefusedAlert(data) {
        // Créer une modale simple comme les autres modales du jeu
        const modal = document.createElement('div');
        modal.className = 'multiplayer-error-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: var(--z-index-modal, 10000);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            background: #fafafa;
            color: var(--primary, #333);
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            width: 90%;
            max-width: 500px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 0;
            overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            background: white;
            padding: 20px;
            border-bottom: 2px solid var(--cta, #fb8122);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0; font-size: 1.4rem; font-weight: 600; color: var(--primary, #333);">Limite de joueurs atteinte</h3>
            <button class="modal-close-btn" style="background: white; border: 3px solid var(--cta, #fb8122); color: var(--cta, #fb8122); width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-size: 24px; line-height: 1;">×</button>
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;
        content.innerHTML = `
            <p style="margin: 0; color: var(--primary, #333); font-size: 14px; line-height: 1.5;">
                ${data.message || `Limite de ${data.maxPlayers} joueurs atteinte (${data.currentPlayers}/${data.maxPlayers})`}
            </p>
            <p style="margin: 0; color: var(--primary, #333); font-size: 14px; line-height: 1.5; font-style: italic;">
                Vous pouvez toujours jouer en mode solo.
            </p>
        `;
        
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 0 20px 20px;
        `;
        actions.innerHTML = `
            <button class="modal-btn" id="close-btn" style="background-color: var(--cta, #fb8122); color: white; border: 3px solid var(--cta, #fb8122);">Fermer</button>
        `;
        
        wrapper.appendChild(header);
        wrapper.appendChild(content);
        wrapper.appendChild(actions);
        modal.appendChild(wrapper);
        document.body.appendChild(modal);
        
        // Bouton fermer (X)
        header.querySelector('.modal-close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Bouton "Fermer"
        actions.querySelector('#close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Auto-remove après 8 secondes
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 8000);
    }

    /**
     * Affiche une alerte de déconnexion
     */
    showDisconnectionAlert(playerPseudo) {
        const alert = document.createElement('div');
        alert.className = 'multiplayer-disconnect-alert';
        alert.innerHTML = `
            <div class="alert-content">
                <div class="alert-icon">⚠️</div>
                <div class="alert-text">
                    <div class="alert-title">Joueur déconnecté</div>
                    <div class="alert-message">${playerPseudo} s'est déconnecté</div>
                </div>
            </div>
        `;
        
        // Les styles sont maintenant dans multiplayer.css
        
        document.body.appendChild(alert);
        
        // Auto-remove après 5 secondes
        setTimeout(() => {
            alert.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 400);
        }, 5000);
    }

    /**
     * Affiche une notification
     */
    showNotification(message, type = 'info') {
        // Utiliser votre système de notification existant
        if (getPopupManager()) {
            // Exemple avec popupManager si disponible
            console.log(`[Multiplayer] ${type}: ${message}`);
        } else {
            // Notification simple
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '#1976d2'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 10000;
                font-family: sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    /**
     * Met à jour la liste des joueurs connectés
     */
    updatePlayersList(players = null) {
        // Utiliser la liste locale si pas de liste fournie
        if (!players) {
            players = this.playersList;
        }
        
        // Si toujours pas de liste, ne rien faire
        if (!players || players.length === 0) {
            return;
        }

        // Créer ou mettre à jour l'UI des joueurs dans la modal legend-btns
        let playersContainer = document.getElementById('multiplayer-players-list');
        if (!playersContainer) {
            // Trouver le container legend-btns-container
            const legendContainer = document.querySelector('.legend-btns-container');
            if (!legendContainer) {
                console.warn('[Multiplayer] Container legend-btns-container non trouvé');
                return;
            }
            
            // Créer le conteneur pour les joueurs multijoueur
            playersContainer = document.createElement('div');
            playersContainer.id = 'multiplayer-players-list';
            playersContainer.className = 'legend-btns multiplayer-players-container';
            
            // Créer le bouton toggle
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'legend-toggle-btn multiplayer-toggle-btn';
            toggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Joueurs connectés</span>
            `;
            
            // Créer le dropdown
            const dropdown = document.createElement('div');
            dropdown.id = 'multiplayer-players-dropdown';
            dropdown.className = 'legend-dropdown hidden';
            
            const title = document.createElement('div');
            title.className = 'legend-item';
            title.style.cssText = 'font-weight: 600; font-size: 14px; padding: 12px 16px; border-bottom: 2px solid rgba(255, 255, 255, 0.2);';
            title.textContent = '🎮 Joueurs connectés';
            dropdown.appendChild(title);
            
            const list = document.createElement('div');
            list.id = 'multiplayer-players-items';
            list.style.cssText = 'padding: 8px 0;';
            dropdown.appendChild(list);
            
            // Ajouter au DOM
            playersContainer.appendChild(toggleBtn);
            playersContainer.appendChild(dropdown);
            legendContainer.appendChild(playersContainer);
            
            // Ajouter le toggle functionality
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });
            
            // Fermer le dropdown si on clique ailleurs
            document.addEventListener('click', (e) => {
                if (!playersContainer.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        const list = document.getElementById('multiplayer-players-items');
        if (!list) return;

        // Afficher la liste dans le style legend-item
        list.innerHTML = '';
        players.forEach(player => {
            const isCurrentPlayer = player.id === this.wsClient?.playerId;
            const item = document.createElement('div');
            item.className = `legend-item${isCurrentPlayer ? ' current-player' : ''}`;
            
            const indicator = document.createElement('div');
            indicator.className = 'legend-icon-wrapper';
            indicator.style.cssText = `
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: ${isCurrentPlayer ? '#2196f3' : '#4caf50'};
                border: none;
                padding: 0;
            `;
            
            const name = document.createElement('span');
            // Toujours afficher le pseudo, qu'il soit le joueur actuel ou non
            const displayPseudo = player.pseudo || (isCurrentPlayer ? this.playerPseudo : null) || 'Joueur';
            name.textContent = displayPseudo;
            if (isCurrentPlayer) {
                name.style.fontWeight = '600';
                name.textContent += ' (Vous)';
            }
            
            item.appendChild(indicator);
            item.appendChild(name);
            list.appendChild(item);
        });
    }

    /**
     * Désactive le mode multijoueur
     */
    disable() {
        if (this.wsClient) {
            // Désactiver les tentatives de reconnexion avant de déconnecter
            this.wsClient.shouldReconnect = false;
            this.wsClient.disconnect();
            this.wsClient = null;
        }
        this.isMultiplayer = false;
        this.remoteBuildings.clear();
        
        // Masquer le message d'attente
        this.showWaitingForPlayerMessage(false);
        
        // Supprimer l'UI des joueurs
        const playersContainer = document.getElementById('multiplayer-players-list');
        if (playersContainer) {
            playersContainer.remove();
        }
        
        console.log('[Multiplayer] Mode multijoueur désactivé');
    }
}

// Export singleton
let multiplayerManager = null;

export function getMultiplayerManager(game, scene) {
    if (!multiplayerManager) {
        multiplayerManager = new MultiplayerManager(game, scene);
    }
    return multiplayerManager;
}

