/**
 * WebSocket Server pour Anoria City Builder - Multijoueur
 * 
 * Installation:
 *   npm install ws uuid
 * 
 * Lancement:
 *   node server/websocket-server.js
 * 
 * Le serveur écoute sur ws://localhost:9876
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 9876;
const MAX_PLAYERS_PER_ROOM = 2; // Limite de 2 joueurs par salon

// Gestion des salons (rooms)
const rooms = new Map(); // Map<roomId, roomData>
let nextRoomId = 1;

// Démarrer le serveur HTTP pour les salons (après avoir créé rooms)
// Le serveur HTTP sera démarré automatiquement lors du require
const { setRoomsReference } = require('./rooms-server.js');
setRoomsReference(rooms);

// Structure d'un salon
// {
//     id: string,
//     citySize: number,
//     players: Map<playerId, playerData>,
//     buildings: Map<buildingId, buildingData>,
//     gameTime: number,
//     nextBuildingId: number,
//     createdAt: timestamp
// }

// État global (pour compatibilité avec l'ancien code)
const gameState = {
    citySize: 16,
    buildings: new Map(),
    players: new Map(),
    gameTime: 0,
    nextBuildingId: 1
};

// Serveur WebSocket
const wss = new WebSocket.Server({ port: PORT });

// Gestion des erreurs du serveur (port déjà utilisé, etc.)
wss.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erreur: Le port ${PORT} est déjà utilisé.`);
        console.error(`💡 Solutions:`);
        console.error(`   1. Arrêtez l'autre processus utilisant le port ${PORT}`);
        console.error(`   2. Utilisez un autre port: PORT=9877 node websocket-server.js`);
        console.error(`   3. Trouvez le processus: lsof -i :${PORT} ou netstat -tulpn | grep ${PORT}`);
        process.exit(1);
    } else {
        console.error('❌ Erreur serveur WebSocket:', error);
        throw error;
    }
});

wss.on('listening', () => {
    console.log(`🚀 Serveur WebSocket démarré sur ws://localhost:${PORT}`);
    console.log(`📡 Connectez vos clients à: ws://localhost:${PORT}`);
});

// Gestion des connexions
wss.on('connection', (ws, req) => {
    const playerId = uuidv4();
    const playerIP = req.socket.remoteAddress;
    let playerPseudo = 'Joueur';
    let currentRoom = null; // Salon actuel du joueur
    
    console.log(`[${playerId}] Nouvelle tentative de connexion depuis ${playerIP}`);
    
    // Stocker la référence du salon dans la connexion WebSocket
    ws.roomId = null;
    ws.playerId = playerId;
    
    // Envoyer immédiatement la liste de TOUS les salons (même pleins)
    const allRooms = Array.from(rooms.values())
        .map(room => ({
            id: room.id,
            citySize: room.citySize,
            currentPlayers: room.players.size,
            maxPlayers: MAX_PLAYERS_PER_ROOM
        }));
    
    console.log(`[Server] Envoi de ${allRooms.length} salon(s) au nouveau client`);
    
    ws.send(JSON.stringify({
        type: 'AVAILABLE_ROOMS',
        rooms: allRooms
    }));
    
    // Gestion des messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, playerId, data);
        } catch (error) {
            console.error(`[${playerId}] Erreur parsing message:`, error);
            sendError(ws, 'INVALID_MESSAGE', 'Message invalide');
        }
    });
    
    // Gestion de la déconnexion
    ws.on('close', () => {
        console.log(`[${playerId}] Déconnexion`);
        
        const roomId = ws.roomId;
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                const player = room.players.get(playerId);
                const playerPseudo = player ? player.pseudo : 'Joueur';
                
                // Supprimer le joueur du salon
                room.players.delete(playerId);
                
                // Notifier les autres joueurs du salon
                broadcastToRoom(roomId, ws, {
                    type: 'PLAYER_LEFT',
                    playerId: playerId,
                    playerPseudo: playerPseudo,
                    totalPlayers: room.players.size
                });
                
                // Si le salon est vide, le supprimer après 30 secondes
                if (room.players.size === 0) {
                    setTimeout(() => {
                        if (rooms.get(roomId) && rooms.get(roomId).players.size === 0) {
                            rooms.delete(roomId);
                            console.log(`[Server] Salon ${roomId} supprimé (vide)`);
                            broadcastRoomListUpdate();
                        }
                    }, 30000);
                } else {
                    // Notifier la mise à jour de la liste des salons
                    broadcastRoomListUpdate();
                }
            }
        } else {
            // Ancien système (fallback)
            const player = gameState.players.get(playerId);
            const playerPseudo = player ? player.pseudo : 'Joueur';
            gameState.players.delete(playerId);
            broadcastToOthers(ws, {
                type: 'PLAYER_LEFT',
                playerId: playerId,
                playerPseudo: playerPseudo,
                totalPlayers: gameState.players.size
            });
        }
    });
    
    // Gestion des erreurs
    ws.on('error', (error) => {
        console.error(`[${playerId}] Erreur WebSocket:`, error);
    });
});

/**
 * Gère les messages reçus des clients
 */
function handleMessage(ws, playerId, data) {
    const player = gameState.players.get(playerId);
    if (player) {
        player.lastActivity = Date.now();
        
        // Mettre à jour le pseudo si fourni
        if (data.playerPseudo && data.playerPseudo.trim()) {
            const newPseudo = data.playerPseudo.trim();
            if (player.pseudo !== newPseudo) {
                const oldPseudo = player.pseudo;
                player.pseudo = newPseudo;
                console.log(`[${playerId}] Pseudo mis à jour: ${oldPseudo} → ${newPseudo}`);
                
                // Notifier les autres joueurs du changement de pseudo
                if (ws.roomId) {
                    broadcastToRoom(ws.roomId, ws, {
                        type: 'PLAYER_PSEUDO_UPDATED',
                        playerId: playerId,
                        playerPseudo: newPseudo
                    });
                    broadcastPlayersList(ws.roomId);
                } else {
                    broadcastToOthers(ws, {
                        type: 'PLAYER_PSEUDO_UPDATED',
                        playerId: playerId,
                        playerPseudo: newPseudo
                    });
                    broadcastPlayersList();
                }
            }
        }
    }
    
    switch (data.type) {
        case 'CREATE_ROOM':
            handleCreateRoom(ws, playerId, data);
            break;
            
        case 'JOIN_ROOM':
            handleJoinRoom(ws, playerId, data);
            break;
            
        case 'BUILD':
            handleBuild(ws, playerId, data);
            break;
            
        case 'SYNC_REQUEST':
            sendFullSync(ws, ws.roomId);
            break;
            
        case 'PLAYER_PSEUDO':
            // Le pseudo est déjà traité dans la section au-dessus
            // On peut juste confirmer
            break;
            
        case 'PING':
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
            
        default:
            console.warn(`[${playerId}] Type de message inconnu:`, data.type);
            sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Type inconnu: ${data.type}`);
    }
}

/**
 * Crée un nouveau salon
 */
function handleCreateRoom(ws, playerId, data) {
    const { citySize, playerPseudo } = data;
    
    if (!citySize || typeof citySize !== 'number' || citySize < 12 || citySize > 24) {
        sendError(ws, 'INVALID_CITY_SIZE', 'Taille de ville invalide (12-24)');
        return;
    }
    
    // Créer un nouveau salon
    const roomId = `room_${nextRoomId++}`;
    const room = {
        id: roomId,
        citySize: citySize,
        players: new Map(),
        buildings: new Map(),
        gameTime: 0,
        nextBuildingId: 1,
        createdAt: Date.now()
    };
    
    // Ajouter le joueur au salon
    room.players.set(playerId, {
        id: playerId,
        pseudo: playerPseudo || 'Joueur',
        connected: true,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        ws: ws
    });
    
    rooms.set(roomId, room);
    ws.roomId = roomId;
    
    // Envoyer confirmation
    ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        roomId: roomId,
        citySize: citySize,
        playerId: playerId
    }));
    
    // Envoyer la synchronisation complète
    sendFullSync(ws, roomId);
    
    // Notifier tous les clients connectés de la nouvelle salle disponible
    broadcastRoomListUpdate();
    
    console.log(`[${playerId}] Salon créé: ${roomId} (${citySize}×${citySize})`);
}

/**
 * Rejoint un salon existant
 */
function handleJoinRoom(ws, playerId, data) {
    const { roomId, playerPseudo } = data;
    
    const room = rooms.get(roomId);
    if (!room) {
        sendError(ws, 'ROOM_NOT_FOUND', 'Salon introuvable');
        return;
    }
    
    // Vérifier si le salon est plein
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        sendError(ws, 'ROOM_FULL', 'Le salon est plein (2/2 joueurs)');
        return;
    }
    
    // Ajouter le joueur au salon
    room.players.set(playerId, {
        id: playerId,
        pseudo: playerPseudo || 'Joueur',
        connected: true,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        ws: ws
    });
    
    ws.roomId = roomId;
    
    // Envoyer confirmation
    ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        roomId: roomId,
        citySize: room.citySize,
        playerId: playerId
    }));
    
    // Envoyer la synchronisation complète
    sendFullSync(ws, roomId);
    
    // Notifier les autres joueurs du salon
    broadcastToRoom(roomId, ws, {
        type: 'PLAYER_JOINED',
        playerId: playerId,
        playerPseudo: playerPseudo || 'Joueur',
        totalPlayers: room.players.size,
        maxPlayers: MAX_PLAYERS_PER_ROOM
    });
    
    // Envoyer la liste mise à jour
    broadcastPlayersList(roomId);
    
    // Notifier tous les clients connectés de la mise à jour de la salle
    broadcastRoomListUpdate();
    
    console.log(`[${playerId}] A rejoint le salon: ${roomId}`);
}

/**
 * Gère le placement d'un bâtiment
 */
function handleBuild(ws, playerId, data) {
    const roomId = ws.roomId;
    if (!roomId) {
        sendError(ws, 'NOT_IN_ROOM', 'Vous n\'êtes pas dans un salon');
        return;
    }
    
    const room = rooms.get(roomId);
    if (!room) {
        sendError(ws, 'ROOM_NOT_FOUND', 'Salon introuvable');
        return;
    }
    
    const { buildingType, x, y } = data;
    
    // Validation basique
    if (!buildingType || typeof x !== 'number' || typeof y !== 'number') {
        sendError(ws, 'INVALID_BUILD_DATA', 'Données de construction invalides');
        return;
    }
    
    // Vérifier les limites de la ville
    if (x < 0 || x >= room.citySize || y < 0 || y >= room.citySize) {
        sendError(ws, 'OUT_OF_BOUNDS', 'Position hors limites');
        return;
    }
    
    // Vérifier si la position est déjà occupée
    const existingBuilding = Array.from(room.buildings.values())
        .find(b => b.x === x && b.y === y);
    
    if (existingBuilding) {
        sendError(ws, 'POSITION_OCCUPIED', `Position (${x}, ${y}) déjà occupée`);
        return;
    }
    
    // Récupérer le pseudo du joueur
    const player = room.players.get(playerId);
    const playerPseudo = player ? player.pseudo : 'Joueur';
    
    // Créer le bâtiment
    const buildingId = `building_${room.nextBuildingId++}`;
    const building = {
        id: buildingId,
        type: buildingType,
        x: x,
        y: y,
        playerId: playerId,
        playerPseudo: playerPseudo,
        timestamp: Date.now()
    };
    
    // Ajouter au state du salon
    room.buildings.set(buildingId, building);
    
    // Confirmer au joueur qui a placé
    ws.send(JSON.stringify({
        type: 'BUILD_CONFIRMED',
        buildingId: buildingId,
        building: building
    }));
    
    // Diffuser à tous les autres clients du salon
    broadcastToRoom(roomId, ws, {
        type: 'BUILD_BROADCAST',
        building: building
    });
    
    console.log(`[${playerId}] ${playerPseudo} a placé: ${buildingType} à (${x}, ${y}) dans ${roomId}`);
}

/**
 * Envoie l'état complet de la ville à un client
 */
function sendFullSync(ws, roomId) {
    if (!roomId) {
        // Fallback vers l'ancien système
        const buildings = Array.from(gameState.buildings.values());
        const players = Array.from(gameState.players.values())
            .map(p => ({ 
                id: p.id, 
                pseudo: p.pseudo,
                connectedAt: p.connectedAt 
            }));
        
        ws.send(JSON.stringify({
            type: 'FULL_SYNC',
            citySize: gameState.citySize,
            buildings: buildings,
            players: players,
            gameTime: gameState.gameTime
        }));
        return;
    }
    
    const room = rooms.get(roomId);
    if (!room) {
        sendError(ws, 'ROOM_NOT_FOUND', 'Salon introuvable');
        return;
    }
    
    const buildings = Array.from(room.buildings.values());
    const players = Array.from(room.players.values())
        .map(p => ({ 
            id: p.id, 
            pseudo: p.pseudo,
            connectedAt: p.connectedAt 
        }));
    
    ws.send(JSON.stringify({
        type: 'FULL_SYNC',
        citySize: room.citySize,
        buildings: buildings,
        players: players,
        gameTime: room.gameTime
    }));
}

/**
 * Diffuse un message à tous les clients d'un salon sauf l'expéditeur
 */
function broadcastToRoom(roomId, sender, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    room.players.forEach((player) => {
        if (player.ws && player.ws !== sender && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(messageStr);
        }
    });
}

/**
 * Diffuse un message à tous les clients sauf l'expéditeur (ancien système)
 */
function broadcastToOthers(sender, message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

/**
 * Diffuse un message à tous les clients
 */
function broadcast(message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

/**
 * Diffuse la liste mise à jour de tous les joueurs à tous les clients d'un salon
 */
function broadcastPlayersList(roomId) {
    if (!roomId) {
        // Fallback vers l'ancien système
        const players = Array.from(gameState.players.values())
            .map(p => ({ 
                id: p.id, 
                pseudo: p.pseudo || 'Joueur',
                connectedAt: p.connectedAt 
            }));
        
        const message = {
            type: 'PLAYERS_LIST_UPDATE',
            players: players
        };
        
        broadcast(message);
        return;
    }
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const players = Array.from(room.players.values())
        .map(p => ({ 
            id: p.id, 
            pseudo: p.pseudo || 'Joueur',
            connectedAt: p.connectedAt 
        }));
    
    const message = {
        type: 'PLAYERS_LIST_UPDATE',
        players: players
    };
    
    // Diffuser à tous les joueurs du salon
    room.players.forEach((player) => {
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

/**
 * Diffuse la mise à jour de la liste des salons à tous les clients connectés
 */
function broadcastRoomListUpdate() {
    // Inclure TOUS les salons, même ceux qui sont pleins
    const allRooms = Array.from(rooms.values())
        .map(room => ({
            id: room.id,
            citySize: room.citySize,
            currentPlayers: room.players.size,
            maxPlayers: MAX_PLAYERS_PER_ROOM
        }));
    
    const message = {
        type: 'AVAILABLE_ROOMS',
        rooms: allRooms
    };
    
    console.log(`[Server] Diffusion de ${allRooms.length} salon(s) à tous les clients`);
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && !client.roomId) {
            // Envoyer seulement aux clients qui ne sont pas encore dans un salon
            client.send(JSON.stringify(message));
        }
    });
}

/**
 * Envoie une erreur au client
 */
function sendError(ws, code, message) {
    ws.send(JSON.stringify({
        type: 'ERROR',
        code: code,
        message: message
    }));
}

// Nettoyage périodique (optionnel)
setInterval(() => {
    const now = Date.now();
    gameState.players.forEach((player, playerId) => {
        // Supprimer les joueurs inactifs depuis plus de 5 minutes
        if (now - player.lastActivity > 5 * 60 * 1000) {
            console.log(`[${playerId}] Suppression joueur inactif`);
            gameState.players.delete(playerId);
        }
    });
}, 60000); // Toutes les minutes

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    wss.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});

