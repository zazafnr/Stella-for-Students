import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @stella/web-core: die gemeinsamen Bausteine aus dem Kern-Spiegel (Quellcode, kein Build-Schritt)
  resolve: { alias: { '@stella/web-core': path.resolve(import.meta.dirname, '../core/web-core/src') } },
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
