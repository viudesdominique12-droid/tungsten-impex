/* ---------------------------------------------------------------------------
   Le système de couleurs.

   Méthode reprise de zaziwe-labs : aucune neutre n'est vraiment neutre. Le fond
   n'est pas blanc mais teinté, l'encre n'est pas noire mais teintée, le gris
   secondaire est teinté. Tout dérive d'une seule teinte.

   Différence ici : au lieu d'UNE famille bleue, QUATORZE familles. Chaque
   produit engendre la sienne, et la page entière change de température.

   La formule ci-dessous, nourrie du bleu Zaziwe #1B3FA6, reproduit la palette
   de zaziwe-labs à quelques points près — c'est la vérification qu'elle capture
   bien la méthode et pas seulement le résultat. Voir `node src/color.mjs`.
   --------------------------------------------------------------------------- */

/* ------------------------------------------------------------ conversions -- */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return t.map((v) => (v + m) * 255);
}

const hsl = (h, s, l) => rgbToHex(hslToRgb([h, s, l]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* -------------------------------------------------------------- contraste -- */

const relLum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const contrast = (a, b) => {
  const [x, y] = [relLum(hexToRgb(a)), relLum(hexToRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* Assombrit une couleur le long de sa propre teinte jusqu'à ce que le blanc
   passe le seuil WCAG. Les couleurs qui passent déjà ressortent inchangées. */
export function strongOn(color, bg = '#ffffff', target = 4.6) {
  if (contrast(color, bg) >= target) return color;
  const [h, s, l] = rgbToHsl(hexToRgb(color));
  for (let L = l; L > 2; L -= 0.5) {
    const c = hsl(h, s, L);
    if (contrast(c, bg) >= target) return c;
  }
  return hsl(h, s, 2);
}

/* --------------------------------------------------------------- famille --- */

/* Les coefficients sont calés sur zaziwe-labs. Les bornes empêchent une teinte
   très saturée (l'ambre solaire) de virer au sale, et une teinte très désaturée
   (le gris des ascenseurs) de devenir un gris parfaitement plat et sans vie. */
const RECIPE = {
  bg:      { k: 0.42, lo: 5,  hi: 32, L: 96.5 },
  surface: { k: 0.55, lo: 6,  hi: 45, L: 99.2 },
  wash:    { k: 0.55, lo: 7,  hi: 46, L: 91.5 },
  line:    { k: 0.40, lo: 5,  hi: 28, L: 88.0 },
  muted:   { k: 0.34, lo: 5,  hi: 28, L: 38.0 },
  /* Les fonds sombres sont de l'ENCRE, pas du bleu marine. Un dégradé marine
     saturé est la signature du template SaaS ; on garde donc la teinte du
     produit en simple soupçon sur un presque-noir. */
  ink:     { k: 0.40, lo: 5,  hi: 26, L: 11.0 },
  night:   { k: 0.45, lo: 6,  hi: 30, L:  9.5 },
  night2:  { k: 0.42, lo: 6,  hi: 26, L: 14.5 },
};

export function family(accent) {
  const [h, s, l] = rgbToHsl(hexToRgb(accent));
  const out = { accent };
  for (const [name, r] of Object.entries(RECIPE)) out[name] = hsl(h, clamp(s * r.k, r.lo, r.hi), r.L);

  out.deep = hsl(h, s, l * 0.72);
  out.strong = strongOn(accent);                 // blanc lisible dessus
  out.onBg = strongOn(accent, out.bg);           // lisible sur le fond teinté
  out.nightInk = hsl(h, clamp(s * 0.30, 6, 24), 93);
  out.nightMuted = hsl(h, clamp(s * 0.26, 6, 22), 68);
  out.nightLine = hsl(h, clamp(s * 0.45, 8, 34), 26);
  return out;
}

/* Émet la famille en variables CSS pour le <head> d'une page. */
export function familyVars(accent) {
  const f = family(accent);
  return [
    `--accent:${f.accent}`, `--accent-deep:${f.deep}`, `--accent-strong:${f.strong}`,
    `--accent-on-bg:${f.onBg}`, `--bg:${f.bg}`, `--surface:${f.surface}`, `--wash:${f.wash}`,
    `--line:${f.line}`, `--muted:${f.muted}`, `--ink:${f.ink}`, `--night:${f.night}`,
    `--night-2:${f.night2}`, `--night-ink:${f.nightInk}`, `--night-muted:${f.nightMuted}`,
    `--night-line:${f.nightLine}`,
  ].join(';');
}

/* ------------------------------------------ contrôle : `node src/color.mjs` - */

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const ZAZIWE = {
    accent: '#1B3FA6', bg: '#F2F5F9', surface: '#FBFDFF', wash: '#DCE7F4',
    muted: '#45597A', ink: '#0A1A33', night: '#0A1B3C',
  };
  const got = family(ZAZIWE.accent);
  const dist = (a, b) => {
    const [x, y] = [hexToRgb(a), hexToRgb(b)];
    return Math.round(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]));
  };
  console.log('La formule, nourrie du bleu Zaziwe, retrouve-t-elle la palette de zaziwe-labs ?\n');
  console.log('  jeton      zaziwe    calculé   écart (sur 441)');
  for (const k of ['bg', 'surface', 'wash', 'muted', 'ink', 'night']) {
    const d = dist(ZAZIWE[k], got[k]);
    console.log(`  ${k.padEnd(10)} ${ZAZIWE[k]}   ${got[k]}   ${String(d).padStart(3)}  ${d <= 14 ? 'oui' : d <= 28 ? 'proche' : 'NON'}`);
  }
}

/* ---------------------------------------------------------------------------
   LA PALETTE DE MAISON — constante sur tout le site.

   Relevée sur trois sites de logistique primés aux Awwwards : Manuport
   (#00358D bleu / #CEAA53 laiton), LODISNA (#2779A7 / #D14836 vermillon),
   Logika (#000000 / #FF4700 orange). Tous les trois tiennent DEUX couleurs :
   un fond qui ancre, un signal chaud qui claque. Jamais un spectre.

   La couleur du produit ne teinte donc plus la page — elle devient la marque
   de caisse : un aplat franc, à pleine saturation.
   --------------------------------------------------------------------------- */

export const HOUSE = {
  paper:   '#F5F2ED',   // papier chaud, pas porcelaine froide
  wash:    '#EBE6DC',
  line:    '#D8D0C3',
  ink:     '#14141A',
  muted:   '#585349',
  ground:  '#151A3D',   // l'indigo du logo, poussé vers l'encre
  ground2: '#1F2550',
  onGround:      '#F2EFE9',
  onGroundMuted: '#9DA0BC',
  groundLine:    '#2E3462',
  signal:     '#E4501E', // vermillon — pour les aplats et les marques
  signalText: '#B03A11', // la même, assez sombre pour porter du texte
};

/* Sur un aplat de couleur, on ne change pas la couleur : on choisit le texte
   qui se lit dessus. C'est ce qui permet de garder les teintes à pleine force. */
export function textOn(bg) {
  return contrast('#ffffff', bg) >= contrast(HOUSE.ink, bg) ? '#ffffff' : HOUSE.ink;
}

/* Les jetons de maison, identiques sur chaque page. */
export function houseVars() {
  const H = HOUSE;
  return [
    `--paper:${H.paper}`, `--wash:${H.wash}`, `--line:${H.line}`, `--ink:${H.ink}`,
    `--muted:${H.muted}`, `--ground:${H.ground}`, `--ground-2:${H.ground2}`,
    `--on-ground:${H.onGround}`, `--on-ground-muted:${H.onGroundMuted}`,
    `--ground-line:${H.groundLine}`, `--signal:${H.signal}`, `--signal-text:${H.signalText}`,
  ].join(';');
}
