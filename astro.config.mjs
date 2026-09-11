import { defineConfig } from 'astro/config';

/* ---------------------------------------------------------------------------
   `site` et `base` viennent de l'environnement, et valent la racine par defaut.

   Une page de projet GitHub est servie sous /nom-du-depot/ : sans `base`, les
   dix-huit pages s'affichent et chaque lien renvoie vers une adresse qui
   n'existe pas. Rien n'avertit au build — c'est le genre de defaut qui se
   decouvre chez le client.

   Les deux valeurs sont posees par le flux de publication, qui ne les invente
   pas : il les LIT dans src/data/site.json, cle web.canonique — chemin pour la
   base, origine pour le domaine. Elles etaient auparavant deduites du nom du
   depot, ce qui aurait servi un site entierement casse le jour d'un nom de
   domaine ; voir l'en-tete de .github/workflows/pages.yml.

   En local, aucune variable n'est definie : le site se construit a la racine,
   exactement comme avant, et c'est cette forme-la qu'attendent la suite de
   verification et le compilateur de la maquette partageable.
   --------------------------------------------------------------------------- */
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  /* 'always' et non 'auto'. Sur telephone, au chargement, il n'y a AUCUN script
     externe et une seule ressource vraiment bloquante : la feuille de style.
     Bride a 400 kbit/s et 400 ms de latence, le premier affichage passe de
     1510 a 770 ms sur l'accueil, 1522 -> 694 sur /about/, 1528 -> 732 sur
     /contact/, 1534 -> 692 sur une fiche — sans un octet de plus sur le fil.

     La contrepartie, mesuree elle aussi : la feuille partagee (4,8 ko gzippes)
     cesse d'etre mise en cache d'une page a l'autre, ce qui coute +88 ms et
     +4,4 ko a chaque page suivante. On l'assume : ce site s'ouvre depuis un
     lien WhatsApp, et la premiere page est presque toujours la seule. */
  build: { inlineStylesheets: 'always' },
  // Le brief impose moins de 150 Ko de JS sur l'accueil. Pas d'intégration
  // framework : la bascule Out/In est du CSS plus une classe sur <body>.
});
