// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  site: 'https://clemparpa.github.io',
  base: '/signal-store',
  integrations: [
    starlight({
      title: '@fluch/signal-store',
      description: 'NgRx SignalStore-inspired state management for React, built on Preact signals',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/clemparpa/signal-store',
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ['../../packages/core/src/index.ts'],
          tsconfig: '../../packages/core/tsconfig.json',
          output: 'api',
          typeDoc: {
            excludeInternal: true,
            excludePrivate: true,
            entryFileName: 'index',
          },
        }),
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Your first store', slug: 'getting-started/first-store' },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
