import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import packageJson from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'react-vendor'
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor'
            }
            if (id.includes('@tauri-apps')) {
              return 'tauri-vendor'
            }
            return 'vendor'
          }
          if (id.includes('/data/changelog.json')) {
            return 'changelog-data'
          }
          if (id.includes('/locales/')) {
            return 'locales-data'
          }
          if (id.includes('/views/dsp/')) {
            return 'view-dsp'
          }
          if (id.includes('/views/library/')) {
            return 'view-library'
          }
          if (id.includes('/views/settings/')) {
            return 'view-settings'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})

