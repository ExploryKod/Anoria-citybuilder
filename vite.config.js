import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { createMapsApiPlugin, resolveMapsDirectory } from './scripts/dev/mapsApiPlugin.mjs'
import { createDevLogPlugin } from './scripts/dev/devLogPlugin.mjs'

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
    createDevLogPlugin(__dirname),
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
    // PWA (vite-plugin-pwa / workbox) removed 2026-09-07 — not needed right
    // now, and workbox-build's dependency tree was tripping Socket
    // Firewall's supply-chain trust check on install (blocking every
    // `pnpm install`). See src/pwa.js for how to restore it: re-add
    // `vite-plugin-pwa`/`workbox-window`/`@vite-pwa/assets-generator` to
    // package.json, re-import `VitePWA` here, and paste the removed plugin
    // config back (kept in git history on this commit).
  ],
})
