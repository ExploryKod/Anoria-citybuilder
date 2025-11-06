/**
 * Serveur HTTP simple pour servir la page de test WebSocket
 * Usage: node test-server.js
 * Puis ouvrez http://localhost:8080/test-websocket.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './test-websocket.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Fichier non trouvé</h1><p>Ouvrez <a href="/test-websocket.html">test-websocket.html</a></p>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Erreur serveur: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ Serveur de test démarré sur http://localhost:${PORT}`);
    console.log(`📄 Ouvrez http://localhost:${PORT}/test-websocket.html dans votre navigateur`);
});

