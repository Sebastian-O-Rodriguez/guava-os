import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'guava-os Manual',
      description: 'Internal manual for the guava-os control plane.',
      head: [
        { tag: 'script', attrs: { type: 'module', src: '/mermaid-init.js' } },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview & routing', link: '/' },
            { label: 'Core', link: '/core/' },
            { label: 'Onboarding', link: '/onboarding/' },
          ],
        },
        {
          label: 'Roles',
          autogenerate: { directory: 'roles' },
        },
        {
          label: 'Reference',
          items: [
            { label: 'Skills', link: '/skills/' },
            { label: 'Repo structure', link: '/structure/' },
            { label: 'Workflow', link: '/workflow/' },
          ],
        },
      ],
    }),
  ],
});