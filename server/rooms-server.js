/**
 * Serveur HTTP pour gérer les salons multijoueur
 * Fournit une API REST pour lister et créer des salons
 */

const http = require('http');
const url = require('url');

const ROOMS_API_PORT = 9877;

// Référence vers les salons (sera partagée avec websocket-server.js)
let roomsRef = null;

function setRoomsReference(rooms) {
    roomsRef = rooms;
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // GET /rooms - Liste tous les salons disponibles
    if (path === '/rooms' && method === 'GET') {
        const rooms = roomsRef || new Map();
        const roomsList = Array.from(rooms.values())
            .map(room => ({
                id: room.id,
                citySize: room.citySize,
                currentPlayers: room.players.size,
                maxPlayers: 2,
                createdAt: room.createdAt
            }))
            .filter(room => room.currentPlayers < room.maxPlayers); // Seulement les salons avec de la place

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(roomsList));
        return;
    }

    // POST /rooms - Créer un nouveau salon
    if (path === '/rooms' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { citySize } = data;

                if (!citySize || typeof citySize !== 'number' || citySize < 12 || citySize > 24) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Taille de ville invalide (12-24)' }));
                    return;
                }

                // La création du salon sera gérée par websocket-server.js
                // On retourne juste une confirmation
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    message: 'Salon créé avec succès',
                    citySize: citySize
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Données invalides' }));
            }
        });
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erreur: Le port ${ROOMS_API_PORT} est déjà utilisé.`);
        process.exit(1);
    } else {
        console.error('❌ Erreur serveur HTTP:', error);
        throw error;
    }
});

server.listen(ROOMS_API_PORT, () => {
    console.log(`📋 API des salons disponible sur http://localhost:${ROOMS_API_PORT}`);
});

module.exports = { setRoomsReference, ROOMS_API_PORT };

