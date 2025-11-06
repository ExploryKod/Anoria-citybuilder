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
  
  // Production - Utilise la variable d'environnement Vercel
  // Configurez VITE_WEBSOCKET_URL dans Vercel Dashboard → Settings → Environment Variables
  // Format: ws://194.164.76.63:9876 ou wss://votre-domaine.com
  // Note: Avec Vite, les variables doivent être préfixées par VITE_ pour être accessibles côté client
  const PRODUCTION_WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 
                            'ws://194.164.76.63:9876'; // Fallback par défaut
  
  return PRODUCTION_WS_URL;
};

export default getWebSocketUrl;

