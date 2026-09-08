import { defineConfig } from 'astro/config';

/* ---------------------------------------------------------------------------
   `site` et `base` viennent de l'environnement, et valent la racine par defaut.

   Une page de projet GitHub est servie sous /nom-du-depot/ : sans `base`, les
   dix-huit pages s'affichent et chaque lien renvoie vers une adresse qui
   n'existe pas. Rien n'avertit au build — c'est le genre de defaut qui se
   decouvre chez le client.

   Les deux valeurs sont posees par le flux de publication (.github/workflows).
   En local, aucune variable n'est definie : le site se construit a la racine,
   exactement comme avant, et c'est cette forme-la que le compilateur de la
   maquette partageable attend.
   --------------------------------------------------------------------------- */
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  build: { inlineStylesheets: 'auto' },
  // Le brief impose moins de 150 Ko de JS sur l'accueil. Pas d'intégration
  // framework : la bascule Out/In est du CSS plus une classe sur <body>.
});
