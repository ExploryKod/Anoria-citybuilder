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
    }

    /**
     * Connecte au serveur WebSocket
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
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
                    this.emit('error', error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('[WebSocket] Connexion fermée');
                    this.connected = false;
                    this.emit('disconnected');
                    
                    // Tentative de reconnexion
                    this.attemptReconnect();
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
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Nombre maximum de tentatives de reconnexion atteint');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        console.log(`[WebSocket] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms...`);

        setTimeout(() => {
            this.connect().catch(() => {
                // La reconnexion échouera et tentera à nouveau
            });
        }, delay);
    }

    /**
     * Déconnecte du serveur
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.listeners.clear();
    }
}

