import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The production app is served by @yummycode/server from dist/ (same origin, no
// proxy). For local `vite dev`, point /api at a running server.
const apiTarget = process.env.YUMMYCODE_API ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
