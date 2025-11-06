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
  // Si VITE_WEBSOCKET_URL est défini, TOUJOURS l'utiliser (même en local pour tester les certificats SSL)
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }
  
  // Détection automatique de l'environnement
  const hostname = window.location.hostname;
  
  // Développement local (par défaut si pas de VITE_WEBSOCKET_URL)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return 'ws://localhost:9876';
  }
  
  // Production - Fallback si pas de variable d'environnement
  // Format: wss://194.164.76.63 (avec Traefik + certificat auto-signé)
  return 'wss://194.164.76.63'; // Fallback - Traefik avec certificat auto-signé
};

export default getWebSocketUrl;

