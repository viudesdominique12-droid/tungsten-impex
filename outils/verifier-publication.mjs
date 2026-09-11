/* ---------------------------------------------------------------------------
   L'ARTEFACT CORRESPOND-IL A L'ADRESSE OU IL VA ETRE SERVI ?

   POURQUOI CE FICHIER EXISTE. Le flux de publication portait deja un garde-fou,
   et ce garde-fou ne pouvait pas echouer la ou il fallait. Il cherchait les
   adresses restees HORS du sous-chemin :

       grep -rhoE '(href|src)="/[^"]*"' dist | grep -vE "\"$BASE_PATH"

   Autrement dit : il verifiait que les adresses PORTENT le prefixe, jamais que
   le prefixe est le BON. Plus le prefixe est faux, plus il est content. Mesure
   faite : en rejouant cette commande sur les dix-neuf pages publiees, avec un
   artefact entierement bati pour /tungsten-impex/ alors qu'il serait servi a la
   racine d'un domaine propre, elle rend zero reste et l'etape passe au vert.

   Ce jour-la, le visiteur recoit dix-neuf pages dont la feuille de style, les
   quatre fontes, les images et les huit cent soixante-dix-huit liens repondent
   404 — et la publication est verte. Regle de la maison : quand un controle
   passe alors que la chose est visiblement fausse, c'est le controle qu'on
   repare.

   CE QU'IL VERIFIE MAINTENANT.

   1. Le prefixe employe au build est celui qu'impose l'adresse publique. La
      source unique est src/data/site.json, cle web.canonique : son chemin donne
      le prefixe, son origine donne le domaine. Si le build a employe autre
      chose, on s'arrete.
   2. Toute adresse absolue d'origine (href, src, srcset) commence par ce
      prefixe. C'est l'ancien controle, conserve : il attrape la fuite inverse.
   3. Aucune trace de l'ANCIEN hebergeur ne subsiste quand l'adresse publique
      n'est plus chez lui — y compris dans robots.txt et sitemap.xml, que
      l'ancien `--include=index.html` laissait passer, et ou un canonique perime
      survivrait sans que rien ne bronche.
   4. La balise canonique de l'accueil est exactement web.canonique.

   Usage :
     node outils/verifier-publication.mjs            (prefixe lu dans BASE_PATH)
     BASE_PATH=/tungsten-impex/ node outils/verifier-publication.mjs

   En local le site se construit a la racine alors que le canonique porte encore
   un sous-chemin : les deux ne s'accordent pas, et c'est normal. Le controle le
   dit, verifie ce qui reste verifiable, et ne fait pas echouer le build local.
   --------------------------------------------------------------------------- */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const site = JSON.parse(readFileSync('src/data/site.json', 'utf8'));
const publique = new URL(site.web.canonique);
const attendu = publique.pathname.endsWith('/') ? publique.pathname : publique.pathname + '/';
const employe = (() => {
  const b = process.env.BASE_PATH || '/';
  return b.endsWith('/') ? b : b + '/';
})();

if (!existsSync('dist')) {
  console.error('ARRET : dist/ n existe pas. Construire d abord.');
  process.exit(1);
}

/* Tous les fichiers servis, pas seulement les index.html : c'est par
   robots.txt et sitemap.xml qu'une adresse perimee passait. */
const fichiers = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (/\.(html|xml|txt)$/i.test(e)) fichiers.push(p);
  }
})('dist');

const publication = attendu === employe;
console.log(`adresse publique   : ${publique.origin}${attendu}`);
console.log(`prefixe employe    : ${employe}`);
console.log(`fichiers examines  : ${fichiers.length}`);
console.log(publication
  ? 'mode publication   : les deux s accordent, tous les controles s appliquent'
  : 'mode local         : le build est a la racine et le canonique porte un sous-chemin.\n'
    + '                     Normal hors publication. Les controles d origine sont sautes.');
console.log('');

const fautes = [];

/* ---- 1. le prefixe employe est-il celui qu'impose l'adresse publique ? ---- */
if (!publication && process.env.CI) {
  fautes.push(`Le build a employe « ${employe} » alors que web.canonique impose « ${attendu} ».\n`
    + '  C est exactement le defaut qui rendait les dix-neuf pages muettes : la seule\n'
    + '  source de l adresse publique est src/data/site.json, cle web.canonique.');
}

/* ---- 2. toute adresse d'origine porte-t-elle le prefixe employe ? -------- */
let horsPrefixe = new Set();
for (const f of fichiers.filter((f) => f.endsWith('.html'))) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (!m[1].startsWith(employe)) horsPrefixe.add(m[1]);
  }
  /* srcset porte plusieurs adresses separees par des virgules */
  for (const m of t.matchAll(/srcset="([^"]+)"/g)) {
    for (const bout of m[1].split(',')) {
      const a = bout.trim().split(/\s+/)[0];
      if (a.startsWith('/') && !a.startsWith(employe)) horsPrefixe.add(a);
    }
  }
}
if (horsPrefixe.size) {
  fautes.push(`${horsPrefixe.size} adresse(s) ne commencent pas par « ${employe} » :\n  `
    + [...horsPrefixe].slice(0, 12).join('\n  '));
} else {
  console.log(`ok   toutes les adresses d origine commencent par ${employe}`);
}

/* ---- 2 bis. ET CE CONTROLE-LA NON PLUS NE POUVAIT PAS ECHOUER ------------
   Quand le prefixe employe vaut « / », toute adresse d origine commence par
   « / » : le controle ci-dessus est vrai par construction et ne dit plus rien.
   C est le meme defaut que celui qu on repare, un etage plus bas.

   L invariant exact existe pourtant : Astro pose TOUS ses fichiers batis sous
   <base>_astro/. Si le build a employe « / » et que les adresses disent
   « /tungsten-impex/_astro/ », l artefact vient d un autre prefixe, et cela se
   constate sans heuristique. */
const assets = new Set();
const MOTIF = /["'\s(](\/[^"'\s),]*_astro\/[^"'\s),]*)/g;
for (const f of fichiers.filter((f) => f.endsWith('.html'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(MOTIF)) assets.add(m[1]);
}
const egares = [...assets].filter((a) => !a.startsWith(employe + '_astro/'));
if (!assets.size) {
  fautes.push('Aucun fichier bati (_astro/) referencé : l artefact est-il complet ?');
} else if (egares.length) {
  fautes.push(egares.length + ' fichier(s) bati(s) portent un prefixe etranger a « ' + employe + ' » :\n  '
    + egares.slice(0, 6).join('\n  ')
    + '\n  Astro pose toujours ses fichiers sous « ' + employe + '_astro/ » : l artefact a\n'
    + '  ete construit pour une autre adresse que celle ou il va etre servi.');
} else {
  console.log('ok   les ' + assets.size + ' fichiers batis sont bien sous ' + employe + '_astro/');
}


/* ---- 3. l'ancien hebergeur a-t-il disparu ? ------------------------------ */
if (publication) {
  const etranger = new Map();
  for (const f of fichiers) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const hote = m[1].toLowerCase();
      if (hote === publique.hostname) continue;
      /* Les adresses tierces sont legitimes : reseaux, cartes, schema.org. */
      if (!/github\.io$/.test(hote)) continue;
      etranger.set(hote, (etranger.get(hote) || 0) + 1);
    }
  }
  if (etranger.size) {
    fautes.push('L ancien hebergeur subsiste dans l artefact publie :\n  '
      + [...etranger].map(([h, n]) => `${h} — ${n} occurrence(s)`).join('\n  ')
      + '\n  Un canonique ou un plan du site perime renvoie les moteurs vers l ancienne adresse.');
  } else {
    console.log('ok   aucune trace de l ancien hebergeur');
  }

  /* ---- 4. la balise canonique de l'accueil ------------------------------- */
  const accueil = readFileSync('dist/index.html', 'utf8');
  const c = accueil.match(/<link rel="canonical" href="([^"]+)"/);
  if (!c) fautes.push('L accueil ne porte aucune balise canonique.');
  else if (c[1] !== site.web.canonique) {
    fautes.push(`Canonique de l accueil : « ${c[1] }»\n  attendu              : « ${site.web.canonique} »`);
  } else {
    console.log('ok   la balise canonique de l accueil est l adresse publique');
  }
}

console.log('');
if (fautes.length) {
  console.error(`ARRET : ${fautes.length} probleme(s) avant publication.\n`);
  for (const f of fautes) console.error('  ' + f + '\n');
  process.exit(1);
}
console.log('L artefact correspond a l adresse ou il sera servi.');
