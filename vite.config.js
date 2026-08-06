import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app also works when opened from a file path /
// static host without a server. Everything runs offline; the only network
// call the app makes at runtime is to the local LM Studio server.
//
// The proxy forwards same-origin `/v1/*` calls to LM Studio server-side. This
// avoids the browser CORS preflight (OPTIONS) that LM Studio mishandles when
// the app calls localhost:1234 cross-origin from localhost:5173. Change the
// target if your LM Studio server runs on a different port.
const LM_STUDIO = 'http://localhost:1234'
const proxy = {
  '/v1': { target: LM_STUDIO, changeOrigin: true },
}

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
