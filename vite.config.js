import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

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

// viteSingleFile inlines every JS/CSS asset — including the PDF.js worker,
// as base64 — into dist/index.html, so the built demo is genuinely one
// file: double-click and open in a browser, no server, no `dist/assets/`.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  server: { proxy },
  preview: { proxy },
})
