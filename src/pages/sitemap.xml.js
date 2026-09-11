/* ---------------------------------------------------------------------------
   Le plan du site — absent lui aussi.

   Les dix-huit pages, construites depuis les memes donnees que la navigation :
   il ne peut donc pas se desynchroniser du site. Le jour ou une ligne de
   marchandise s'ajoute dans site.json, elle entre ici toute seule.

   L'adresse-relais du QR n'y figure pas : elle renvoie ailleurs, elle n'est pas
   une page. Les priorites vont de l'accueil aux fiches, ce qui reflete
   l'importance reelle et non un classement invente.
   --------------------------------------------------------------------------- */
import site from '../data/site.json';
import { absolu } from '../lib/lien.js';

export const GET = () => {
  const C = site.web.canonique;
  const pages = [
    ['/', '1.0'],
    ['/about/', '0.7'],
    ['/contact/', '0.8'],
    ['/training/', '0.7'],
    ...site.exports.map((p) => [`/export/${p.slug}/`, '0.6']),
    ...site.imports.map((p) => [`/import/${p.slug}/`, '0.6']),
  ];

  const corps = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([chemin, prio]) =>
  `  <url>\n    <loc>${absolu(chemin, C)}</loc>\n    <priority>${prio}</priority>\n  </url>`
).join('\n')}
</urlset>
`;
  return new Response(corps, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
