/**
 * Client WebSocket pour le multijoueur
 * Gère la connexion et la communication avec le serveur
 */

export class WebSocketClient {
    constructor(url = 'ws://localhost:9876', playerPseudo = 'Joueur') {
        this.url = url;
        this.playerPseudo = playerPseudo;
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.listeners = new Map();
        this.messageQueue = [];
        this.shouldReconnect = true; // Flag pour contrôler les tentatives de reconnexion
    }

    /**
     * Connecte au serveur WebSocket
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Réinitialiser le flag de reconnexion pour une nouvelle connexion
                this.shouldReconnect = true;
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('[WebSocket] Connecté au serveur');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Envoyer le pseudo au serveur dès la connexion
                    if (this.playerPseudo) {
                        this.send('PLAYER_PSEUDO', { playerPseudo: this.playerPseudo });
                    }
                    
                    // Envoyer les messages en attente
                    this.flushMessageQueue();
                    
                    this.emit('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        // Traiter les messages de refus immédiatement
                        if (data.type === 'CONNECTION_REFUSED') {
                            this.handleMessage(data);
                            return;
                        }
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('[WebSocket] Erreur parsing message:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocket] Erreur:', error);
                    this.connected = false;
                    this.emit('error', error);
                    this.emit('connectionFailed', { error, message: 'Erreur de connexion WebSocket' });
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('[WebSocket] Connexion fermée', event.code, event.reason);
                    this.connected = false;
                    this.emit('disconnected');
                    
                    // Si la fermeture est due à une erreur (code != 1000), émettre un événement
                    if (event.code !== 1000 && event.code !== 1001) {
                        this.emit('connectionFailed', { 
                            error: { code: event.code, reason: event.reason },
                            message: `Connexion fermée: ${event.reason || 'Erreur inconnue'}`
                        });
                    }
                    
                    // Tentative de reconnexion seulement si :
                    // 1. Ce n'est pas une fermeture volontaire (code != 1000, 1001)
                    // 2. Le flag shouldReconnect est true (pas de déconnexion explicite)
                    if (this.shouldReconnect && event.code !== 1000 && event.code !== 1001) {
                        this.attemptReconnect();
                    }
                };

            } catch (error) {
                console.error('[WebSocket] Erreur de connexion:', error);
                reject(error);
            }
        });
    }

    /**
     * Gère les messages reçus du serveur
     */
    handleMessage(data) {
        switch (data.type) {
            case 'CONNECTED':
                this.playerId = data.playerId;
                console.log(`[WebSocket] ID joueur: ${this.playerId}`);
                this.emit('playerId', this.playerId);
                break;

            case 'CONNECTION_REFUSED':
                console.error('[WebSocket] Connexion refusée:', data.message);
                this.connected = false;
                this.emit('connectionRefused', data);
                if (this.ws) {
                    this.ws.close();
                }
                break;

            case 'FULL_SYNC':
                this.emit('fullSync', data);
                break;

            case 'BUILD_CONFIRMED':
                this.emit('buildConfirmed', data);
                break;

            case 'BUILD_BROADCAST':
                this.emit('buildBroadcast', data);
                break;

            case 'PLAYER_JOINED':
                this.emit('playerJoined', data);
                break;

            case 'PLAYER_LEFT':
                this.emit('playerLeft', data);
                break;

            case 'PLAYER_PSEUDO_UPDATED':
                this.emit('playerPseudoUpdated', data);
                break;

            case 'PLAYERS_LIST_UPDATE':
                this.emit('playersListUpdate', data);
                break;

            case 'AVAILABLE_ROOMS':
                this.emit('availableRooms', data);
                break;

            case 'ROOM_CREATED':
                this.emit('roomCreated', data);
                break;

            case 'ROOM_JOINED':
                this.emit('roomJoined', data);
                break;

            case 'ERROR':
                this.emit('error', { code: data.code, message: data.message });
                break;

            case 'PONG':
                // Réponse au ping, rien à faire
                break;

            default:
                console.warn('[WebSocket] Type de message inconnu:', data.type);
        }
    }

    /**
     * Envoie un message au serveur
     */
    send(type, data = {}) {
        const message = {
            type: type,
            playerId: this.playerId,
            playerPseudo: this.playerPseudo,
            ...data,
            timestamp: Date.now()
        };

        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Mettre en file d'attente si pas connecté
            this.messageQueue.push(message);
        }
    }

    /**
     * Envoie les messages en attente
     */
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.connected) {
                this.ws.send(JSON.stringify(message));
            }
        }
    }

    /**
     * Place un bâtiment
     */
    build(buildingType, x, y) {
        this.send('BUILD', {
            buildingType: buildingType,
            x: x,
            y: y
        });
    }

    /**
     * Demande une synchronisation complète
     */
    requestSync() {
        this.send('SYNC_REQUEST');
    }

    /**
     * Ajoute un listener pour un type d'événement
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Supprime un listener
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Émet un événement
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[WebSocket] Erreur dans listener ${event}:`, error);
                }
            });
        }
    }

    /**
     * Tentative de reconnexion
     */
    attemptReconnect() {
        // Ne pas tenter de reconnexion si shouldReconnect est false
        if (!this.shouldReconnect) {
            console.log('[WebSocket] Reconnexion désactivée (déconnexion volontaire)');
            return;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Nombre maximum de tentatives de reconnexion atteint');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        console.log(`[WebSocket] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms...`);

        setTimeout(() => {
            // Vérifier à nouveau avant de se reconnecter
            if (this.shouldReconnect) {
                this.connect().catch(() => {
                    // La reconnexion échouera et tentera à nouveau
                });
            }
        }, delay);
    }

    /**
     * Déconnecte du serveur
     */
    disconnect() {
        // Désactiver les tentatives de reconnexion
        this.shouldReconnect = false;
        
        if (this.ws) {
            // Fermer proprement avec code 1000 (normal closure)
            try {
                this.ws.close(1000, 'Déconnexion volontaire');
            } catch (error) {
                // Si la connexion est déjà fermée, juste nettoyer
                console.log('[WebSocket] Connexion déjà fermée');
            }
            this.ws = null;
        }
        this.connected = false;
        this.listeners.clear();
        this.reconnectAttempts = 0; // Réinitialiser les tentatives
    }
}

