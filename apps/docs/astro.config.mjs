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
          entryPoints: [
            '../../packages/core/src/index.ts',
            '../../packages/entities/src/index.ts',
            '../../packages/react/src/index.ts',
            '../../packages/devtools/src/index.ts',
          ],
          tsconfig: './tsconfig.typedoc.json',
          output: 'api',
          typeDoc: {
            excludeInternal: true,
            excludePrivate: true,
            entryFileName: 'index',
            exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-d.ts'],
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
        {
          label: 'Guides',
          items: [
            { label: 'Entities', slug: 'guides/entities' },
            { label: 'React Provider', slug: 'guides/react' },
            { label: 'rxMethod (async side effects)', slug: 'guides/rx-method' },
            { label: 'DevTools', slug: 'guides/devtools' },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
