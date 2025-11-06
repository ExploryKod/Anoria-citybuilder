/**
 * Configuration PM2 pour Hostinger VPS
 * 
 * Installation:
 *   npm install -g pm2
 * 
 * Utilisation:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup  # Suivez les instructions
 */

module.exports = {
  apps: [{
    name: 'anoria-websocket',
    script: './websocket-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 9876
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

