import { chromium } from 'playwright';

/* Repartition des sols dans la surface peinte, page par page.

   Ce fichier mesurait « la part de bleu », plafonnee a 10,3 % — la valeur
   relevee sur la reference du client, a l'epoque ou il reprochait au site un
   fond bleu integral. Depuis la refonte, le sombre n'est plus un fond subi :
   c'est la famille NUIT, et son retour toutes les deux ou trois sections est
   le principal remede a la page qui paraissait « vide et remplie a la fois ».
   Confondre les deux ferait echouer le controle sur ce qu'il devrait valider.

   Trois familles sont donc distinguees, et le sombre est teste EN PREMIER :
   la nuit du site (rgb 10,27,60) a bien plus de bleu que de rouge, et l'ancien
   ordre de test la comptait comme de l'accent.

     clair    le papier, la surface, le lavis
     nuit     les sections sombres, le pied de page
     accent   le bleu franc — bandeau utilitaire, ruban, boutons, face
              entrante du tableau. C'est LUI qui doit rester a l'echelle d'un
              accent, et c'est lui qu'on plafonne. */
const analyse = async (p, nom) => {
  const m = await p.evaluate(() => {
    const W = innerWidth;
    const total = document.documentElement.scrollHeight * W;
    const fam = (v) => {
      const n = (v.match(/[\d.]+/g) || []).map(Number);
      if (n.length > 3 && n[3] < 0.5) return null;
      const [r, g, b] = n;
      if (r === undefined) return null;
      if (r > 200 && g > 200 && b > 195) return 'clair';
      if (r < 90 && g < 90 && b < 130) return 'nuit';
      if (b - r > 45) return 'accent';
      return 'autre';
    };
    const a = { clair: 0, nuit: 0, accent: 0, autre: 0 };
    const porteurs = {};
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      /* Ce qui n'est pas a l'ecran ne peint pas. Le menu plein ecran et la
         barre d'appel sont poses dans le document en permanence, caches ; ils
         couvrent chacun une fenetre entiere, et ils faussaient la mesure de
         part en part — c'est le menu, clair a l'epoque, qui portait a lui seul
         une bonne moitie du « blanc » que ce fichier annoncait. */
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.hidden) continue;
      if (cs.position === 'fixed') continue;
      const f = fam(cs.backgroundColor);
      if (!f) continue;
      const r = el.getBoundingClientRect();
      const s = r.width * r.height;
      if (s < 100) continue;
      a[f] += s;
      if (f === 'accent') {
        const k = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
        porteurs[k] = Math.max(porteurs[k] || 0, Math.round(s));
      }
    }
    return { total, a, porteurs };
  });
  const pc = (v) => ((v / m.total) * 100).toFixed(1) + ' %';
  const top = Object.entries(m.porteurs).sort((x, y) => y[1] - x[1]).slice(0, 3);
  console.log(`${nom.padEnd(16)} clair ${pc(m.a.clair).padStart(7)}   nuit ${pc(m.a.nuit).padStart(7)}` +
              `   accent ${pc(m.a.accent).padStart(7)}   ${top.map(([k, v]) => `${k} ${Math.round(v / 1000)}k`).join('  ')}`);
  return (m.a.accent / m.total) * 100;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pages = [['/', 'accueil'], ['/import/electric-vehicles/', 'fiche import'],
               ['/export/niger-seed-noug/', 'fiche export'], ['/about/', 'a propos'],
               ['/contact/', 'contact'], ['/training/', 'formation']];
let pire = 0;
for (const [u, nom] of pages) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  pire = Math.max(pire, await analyse(p, nom));
  await p.close();
}
console.log(`\npart d'accent la plus forte : ${pire.toFixed(1)} %   (reference du client : 10,3 %)`);
await b.close();
