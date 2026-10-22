import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.GATEWAY_URL ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/oauth': target,
      '/.well-known': target,
      '/health': target
    }
  },
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 800 }
});
