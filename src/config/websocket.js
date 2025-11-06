/**
 * Configuration de l'URL WebSocket selon l'environnement
 * 
 * En développement : ws://localhost:9876
 * En production : wss://votre-serveur.railway.app (ou render.com, fly.dev)
 * 
 * Pour déployer sur Railway/Render/Fly.io, remplacez l'URL ci-dessous
 * par celle fournie par votre service d'hébergement.
 */

const getWebSocketUrl = () => {
  // Détection automatique de l'environnement
  const hostname = window.location.hostname;
  
  // Développement local
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return 'ws://localhost:9876';
  }
  
  // Production - Remplacez par votre URL de serveur WebSocket
  // Exemples :
  // Railway: 'wss://votre-app.railway.app'
  // Render: 'wss://votre-app.onrender.com'
  // Fly.io: 'wss://votre-app.fly.dev'
  
  // TODO: Remplacez cette URL par celle de votre serveur déployé
  const PRODUCTION_WS_URL = 'wss://votre-serveur.railway.app'; // ⚠️ À MODIFIER
  
  return PRODUCTION_WS_URL;
};

export default getWebSocketUrl;

