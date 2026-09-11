/* ---------------------------------------------------------------------------
   Toute adresse interne du site passe par ici.

   Pourquoi ce fichier existe. Le site etait ecrit en chemins absolus —
   href="/about/", href="/export/sesame-seed/". C'est juste tant qu'il est
   servi a la racine d'un domaine, et faux partout ailleurs. Une page de projet
   GitHub, par exemple, est servie sous /nom-du-depot/ : les dix-huit pages
   s'affichent, et chaque lien du menu, du pied de page et des registres renvoie
   vers une adresse qui n'existe pas. Trente-deux liens, et pas un seul avertis-
   sement au build — c'est le genre de defaut qui se decouvre chez le client.

   `import.meta.env.BASE_URL` vaut `/` par defaut et `/nom-du-depot/` quand le
   site est construit pour un sous-chemin. Le site devient deplacable sans
   qu'aucune page ait a savoir ou elle est publiee.

   Les fontes, elles, ne passent pas par ici : elles vivent dans src/fonts/ et
   leurs adresses sont resolues par le compilateur (voir tokens.css).
   --------------------------------------------------------------------------- */

export const lien = (chemin = '/') => {
  const brut = import.meta.env.BASE_URL || '/';
  const base = brut.endsWith('/') ? brut : brut + '/';
  return base + String(chemin).replace(/^\//, '');
};

/* ---------------------------------------------------------------------------
   L'adresse ABSOLUE d'une page.

   Le canonique, l'Open Graph et le plan du site ne peuvent pas se contenter
   d'un chemin : ils exigent une adresse complete, avec le protocole et le
   domaine. On la construit depuis `web.canonique` de site.json — la meme valeur
   que vise le QR code, donc une seule source pour l'adresse publique du site.

   Le chemin est AJOUTE au canonique, il n'est pas resolu contre lui. La
   nuance a l'air academique et elle ne l'est pas : `new URL('/about/', 'https://
   host/tungsten-impex/')` rend `https://host/about/` — le sous-chemin disparait,
   parce qu'un chemin absolu resolu contre une base en ecrase le chemin. Le
   canonique porte deja le prefixe de publication ; on le complete, on ne le
   reinterprete pas. Ecrit ainsi, le resultat est le meme que le site soit bati
   a la racine ou sous un sous-chemin — et lien() n'a plus rien a faire ici.
   --------------------------------------------------------------------------- */
export const absolu = (chemin, canonique) =>
  String(canonique).replace(/\/+$/, '') + '/' + String(chemin).replace(/^\/+/, '');
