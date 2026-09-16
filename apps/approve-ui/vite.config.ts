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
      // Identity-loop (8788). Dedicated prefix so /local/egress-destinations
      // on this path does not hit mail-loop (8787).
      '/id-api': {
        target: 'http://127.0.0.1:8788',
        rewrite: (path) => path.replace(/^\/id-api/, ''),
      },
      '/local/identity': 'http://127.0.0.1:8788',
      '/local': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
})
