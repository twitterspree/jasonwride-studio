// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// https://astro.build/config
// Fully static site — Cloudflare serves ./dist as static assets (see wrangler.jsonc).
export default defineConfig({
  site: 'https://jasonwride.studio',
  integrations: [svelte()],
  redirects: {
    '/concepts': '/concepts/book',
  },
});
