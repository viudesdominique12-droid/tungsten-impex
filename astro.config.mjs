import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  // Le brief impose moins de 150 Ko de JS sur l'accueil. Pas d'intégration
  // framework : la bascule Out/In est du CSS plus une classe sur <body>.
});
