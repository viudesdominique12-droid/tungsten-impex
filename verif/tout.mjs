/* ---------------------------------------------------------------------------
   Une seule commande : node verif/tout.mjs

   « Tout est bien verifie ? » ne veut rien dire tant qu'il faut se souvenir de
   huit scripts. Celui-ci les enchaine, s'arrete au premier qui echoue, et dit
   ce qui est couvert — et ce qui ne l'est pas.
   --------------------------------------------------------------------------- */
import { spawnSync } from 'node:child_process';

const ETAPES = [
  ['check.mjs',          'systeme, couleur, images, mobile, tableau — 35 controles'],
  ['partout.mjs',        'contraste et cibles tactiles sur LES 18 PAGES, bureau + iPhone'],
  ['safari-clavier.mjs', 'WebKit (moteur de Safari), clavier, piege de focus, formulaire'],
  ['links.mjs',          'tous les liens de toutes les pages'],
  ['photos-diag.mjs',    'aucune image affichee au-dela de sa taille reelle'],
  ['photos.mjs',         'quelles photos sont posees, lesquelles restent en reserve'],
  ['couleur.mjs',        'part de bleu par page, face a la reference du client'],
  ['mobile.mjs',         'poids et cibles sur iPhone 12 et Android 360'],
];

let rate = 0;
for (const [f, quoi] of ETAPES) {
  process.stdout.write(`\n──────── ${f}  —  ${quoi}\n`);
  const r = spawnSync(process.execPath, [`verif/${f}`], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\n!! ${f} a echoue`); rate++; break; }
}

console.log(`\n${'═'.repeat(72)}`);
if (rate) { console.log('ARRET : une etape a echoue.'); process.exit(1); }
console.log(`TOUT PASSE.

  Couvert   les 18 pages, a 1440px et sur iPhone 12 emule ; Chromium ET WebKit,
            le moteur de Safari donc de l'iPhone ; Android 360px pour le poids.
            Contraste AA compose (l'alpha est empile avant mesure), cibles
            tactiles de 44px, debordement, agrandissement d'image, part de
            bleu, liens, clavier et piege de focus, validation du formulaire.

  NON couvert, et il faut le savoir :
   . Firefox n'est pas installe. Les trois moteurs du web sont Blink, WebKit et
     Gecko ; deux sur trois sont testes.
   . Aucun appareil reel : ce sont des emulations. Un vrai iPhone peut differer
     sur le rendu des polices et la barre d'adresse escamotable.
   . Le formulaire ouvre un mailto:, il n'y a pas de serveur. Rien n'arrive
     dans une boite automatiquement : c'est l'application mail du visiteur qui
     s'ouvre, pre-remplie. Sur un ordinateur sans client mail configure, il ne
     se passe rien — d'ou le message de repli affiche sous le bouton.
   . Le HTML n'est pas valide par un validateur formel.
   . Aucune mesure de vitesse reelle (LCP, CLS) : le poids est mesure, pas le
     ressenti sur un reseau lent.`);
