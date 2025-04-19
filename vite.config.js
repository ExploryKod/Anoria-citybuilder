import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base:'/', // Use relative paths for assets

  build: {
    outDir: 'dist', // Default output directory
    emptyOutDir: true,
    assetsDir: 'assets', // Directory for built assets
  },

  plugins: [VitePWA({
    registerType: 'prompt',
    injectRegister: true,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'anoria',
      short_name: 'anoria',
      description: 'A 3D game with thee js',
      theme_color: '#ffffff',
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      maximumFileSizeToCacheInBytes: 6000000
    },

    devOptions: {
      enabled: true,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
})