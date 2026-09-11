/* ---------------------------------------------------------------------------
   robots.txt — il etait absent, et rien ne declarait le perimetre du site.

   Deux lignes utiles : tout est ouvert, et voici le plan. La troisieme exclut
   l'adresse-relais du QR code : c'est une porte qui renvoie ailleurs, elle n'a
   rien a faire dans un index et elle ferait doublon avec l'accueil.
   --------------------------------------------------------------------------- */
import site from '../data/site.json';

export const GET = () => {
  const base = String(site.web.canonique).replace(/\/+$/, '');
  const corps = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /aller/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
