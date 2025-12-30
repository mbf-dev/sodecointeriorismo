import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      hmr: {
        overlay: true,
      },
      watch: {
        // Activar polling en Windows para mejor detección de cambios
        usePolling: true,
        interval: 1000,
      },
    },
    optimizeDeps: {
      exclude: ['lucide-astro'],
    },
  },
});
