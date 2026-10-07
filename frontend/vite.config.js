import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API is proxied, so the frontend can call relative /api URLs.
    proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:4000' },
  },
});
