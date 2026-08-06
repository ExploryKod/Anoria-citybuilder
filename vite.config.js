import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const cleanRoutes = [
  { path: '/game', file: '/game.html' },
  { path: '/missions', file: '/missions.html' },
  { path: '/settings', file: '/settings.html' },
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
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
        missions: resolve(__dirname, 'missions.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },

  plugins: [
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
    registerType: 'prompt',
    injectRegister: true,

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
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      maximumFileSizeToCacheInBytes: 6000000,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/assets\//, /^\/game/],
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
