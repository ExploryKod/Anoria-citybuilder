import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createMapsApiPlugin, resolveMapsDirectory } from './scripts/dev/mapsApiPlugin.mjs'

const mapsDir = resolveMapsDirectory(__dirname)

const cleanRoutes = [
  { path: '/game', file: '/game.html' },
  { path: '/hamlets', file: '/hamlets.html' },
  { path: '/world', file: '/world.html' },
  { path: '/missions', file: '/missions.html' },
  { path: '/settings', file: '/settings.html' },
  { path: '/privacy', file: '/privacy.html' },
  { path: '/terms', file: '/terms.html' },
  { path: '/legal', file: '/legal.html' },
  { path: '/credits', file: '/credits.html' },
  { path: '/assets', file: '/assets.html' },
]

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
        hamlets: resolve(__dirname, 'hamlets.html'),
        world: resolve(__dirname, 'world.html'),
        missions: resolve(__dirname, 'missions.html'),
        settings: resolve(__dirname, 'settings.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        legal: resolve(__dirname, 'legal.html'),
        credits: resolve(__dirname, 'credits.html'),
        assets: resolve(__dirname, 'assets.html'),
        placement: resolve(__dirname, 'placement.html'),
      },
    },
  },
  plugins: [
    createMapsApiPlugin(mapsDir),
    {
      name: 'rewrite-clean-routes',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) {
            next();
            return;
          }
          const pathname = req.url.split('?')[0];
          const match = cleanRoutes.find((r) => pathname === r.path || pathname === `${r.path}/`);
          if (match) {
            req.url = match.file;
          }
          next();
        });
      },
    },
    VitePWA({
    registerType: 'autoUpdate',
    // Enregistrement manuel via src/pwa.js (toast js-toast-notifier) —
    // évite un double register sur /game.
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'anoria',
      short_name: 'anoria',
      description: 'A 3D city builder game',
      theme_color: '#db4938',
      start_url: '/',
      scope: '/',
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,ico}'],
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      maximumFileSizeToCacheInBytes: 6000000,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/assets\//, /^\/game/, /^\/hamlets/, /^\/world/, /^\/privacy/, /^\/terms/, /^\/legal/, /^\/credits/, /^\/assets/],
      // Modèles 3D (.glb/.gltf/.fbx), leurs textures/JSON associés et les sprites de statut
      // pèsent plusieurs dizaines de Mo au total (village_town_assets_v2.glb, citizenCool...).
      // Les précacher bloquerait l'installation du SW ; on les met en cache à l'exécution
      // (CacheFirst) après le premier chargement, ce qui rend les visites suivantes rapides
      // et robustes aux réseaux mobiles instables — sans télécharger 150 Mo dès l'install.
      runtimeCaching: [
        {
          urlPattern: ({ url }) =>
            /^\/(resources|citizen02|citizenCool)\//.test(url.pathname) ||
            url.pathname === '/village_town_assets.json',
          handler: 'CacheFirst',
          options: {
            cacheName: 'anoria-game-assets',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 60 * 60 * 24 * 60, // 60 jours
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }) => /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'anoria-images',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },

    devOptions: {
      enabled: true,
      navigateFallback: '/index.html',
      suppressWarnings: true,
      type: 'module',
      disableDevLogs: true,
    },
    }),
  ],
})
