import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/multiplayer-tictactoe/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/nakama': {
        target: 'http://localhost:7350',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nakama/, ''),
      },
    },
  },
})
