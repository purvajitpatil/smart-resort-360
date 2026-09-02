import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The design system lives outside this app's root.
  resolve: { preserveSymlinks: true },
  server: {
    host: '127.0.0.1',
    // Allow importing the shared theme from ../../packages.
    fs: { allow: ['..', '../..'] },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})