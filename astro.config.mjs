process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import mkcert from 'vite-plugin-mkcert';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  server: {
    port: 8686,
  },

  image: {
    domains: [
      'localhost',
      'sodeco.dev.net.pe',
      'stamps-forestry-ourselves-endif.trycloudflare.com',
    ],
    remotePatterns: [{ protocol: 'https' }],
  },

  adapter: node({ mode: 'standalone' }),

  vite: {
    plugins: [tailwindcss(), mkcert()],
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

  integrations: [svelte()],
});
