import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // Dedicated prefix so identity /local/egress-destinations hits :8788,
      // not mail-loop :8787.
      '/id-api': {
        target: 'http://127.0.0.1:8788',
        rewrite: (path) => path.replace(/^\/id-api/, ''),
      },
      '/wa-api': {
        target: 'http://127.0.0.1:8789',
        rewrite: (path) => path.replace(/^\/wa-api/, ''),
      },
      '/local': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
})
