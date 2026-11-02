import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo>/; everywhere else it's at the root.
  base: process.env.VITE_BASE ?? '/',
  server: {
    host: true,
    port: 5173,
  },
})
