/* ---------------------------------------------------------------------------
   Tungsten Import Export — identité, produits, couleurs.

   Le TEXTE des fiches produits vit dans src/copy.json (écrit par la passe
   rédactionnelle, contrôlé contre les pages d'origine). Ici on ne trouve que
   l'identité : nom, couleur, photo.

       node src/build.mjs      régénère tout le site
   --------------------------------------------------------------------------- */

export const company = {
  name: 'Tungsten Import Export',
  founded: 2007,
  address: {
    line1: 'Africa Avenue, Dembel City Center',
    line2: '4th Floor — FF-002',
    city: 'Addis Ababa',
    country: 'Ethiopia',
  },
  phone: '+251 91 261 0248',
  phoneHref: '+251912610248',
  email: 'info@tungstenimpex.com',
  mapQuery: 'Dembel City Center, Africa Avenue, Addis Ababa, Ethiopia',
  mapBbox: '38.7820,9.0060,38.7940,9.0160',
  mapMarker: '9.0110,38.7880',
  // Une entrée sans url est ignorée partout. Renseignez-la et le lien apparaît.
  socials: [
    { id: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/251912610248' },
    { id: 'linkedin', label: 'LinkedIn', url: '' },
    { id: 'facebook', label: 'Facebook', url: '' },
    { id: 'telegram', label: 'Telegram', url: '' },
    { id: 'instagram', label: 'Instagram', url: '' },
  ],
};

/* La marque : le bleu du logo. */
export const brand = '#2A3491';

export const founderLetter = {
  name: '',                       // à confirmer avant publication
  role: 'Founder & General Manager',
  paragraphs: [
    'With over 30 years in the Ethiopian oilseed and pulse trade, I’ve learned that real resilience isn’t just about weathering storms — it’s about stability when it matters most. That’s the spirit behind our name: like Tungsten, we are naturally strong and built to endure.',
    'I started this company in 2007 to bridge local potential with global markets. My background in international business taught me that trust is the real currency of trade. Today, that means putting your needs first, sourcing only the best products, and showing up with integrity every single day.',
    'Welcome to our home online. We’re here to connect you to the world — reliably, honestly, and personally.',
  ],
};

/* ---------------------------------------------------------------------------
   Les 14 teintes.

   Choisies pour être séparées sur la roue chromatique — l'écart de teinte le
   plus serré est de 12°, et là où deux teintes se rapprochent (terracotta vs
   ambre, bleu nuit vs gris acier) la saturation les sépare nettement.

   `hero: true`  → la photo est assez grande pour un bandeau pleine largeur.
   `hero: false` → elle passe en panneau encadré, à sa taille réelle.
   --------------------------------------------------------------------------- */

export const imports = [
  { slug: 'electric-vehicles',      name: 'Electric Vehicles',     accent: '#17325C', hero: true,  note: 'bleu nuit — demandé' },
  { slug: 'medical-equipment',      name: 'Medical Equipment',     accent: '#0E7C86', hero: true,  note: 'sarcelle clinique' },
  { slug: 'human-medicine',         name: 'Human Medicine',        accent: '#9D2449', hero: true,  note: 'cramoisi pharmaceutique' },
  { slug: 'building-glass',         name: 'Building Glass',        accent: '#5292AE', hero: true,  note: 'aqua pâle du verre float' },
  { slug: 'elevator-and-escalator', name: 'Elevator & Escalator',  accent: '#5C6672', hero: true,  note: 'gris acier — demandé' },
  { slug: 'calcium-hypochlorite',   name: 'Calcium Hypochlorite',  accent: '#1E8F6E', hero: false, note: 'vert d’eau — traitement de l’eau' },
  { slug: 'plastic-raw-materials',  name: 'Plastic Raw Materials', accent: '#6A3FB5', hero: true,  note: 'violet polymère' },
  { slug: 'solar-lanterns',         name: 'Solar Lanterns',        accent: '#D97A0F', hero: false, note: 'ambre solaire' },
  { slug: 'stationery-materials',   name: 'Stationery Materials',  accent: '#8E3B7A', hero: false, note: 'prune — encre' },
  { slug: 'ceramics',               name: 'Ceramics',              accent: '#B4562F', hero: true,  note: 'terracotta — argile cuite' },
];

export const exports_ = [
  { slug: 'niger-seed-noug',  name: 'Niger Seed (Noug)', accent: '#7E8B2A', hero: true,  note: 'olive doré — l’huile' },
  { slug: 'sesame-seed',      name: 'Sesame Seed',       accent: '#A08A45', hero: true,  note: 'kaki doré — la graine' },
  { slug: 'red-kidney-beans', name: 'Red Kidney Beans',  accent: '#7E2E2E', hero: false, note: 'bordeaux — le haricot' },
  { slug: 'soya-bean',        name: 'Soya Bean',         accent: '#3F7D4E', hero: false, note: 'vert soja' },
];

/* Couleurs des sections générales. */
export const sections = {
  home:     brand,
  about:    brand,
  imports:  brand,
  exports:  '#3F7D4E',
  training: '#1F4E8C',
  contact:  brand,
};

export const training = {
  intro:
    'We run practical import and export training in Addis Ababa, for people who want to work in Ethiopian foreign trade or to trade on their own account. Leave us your details and roughly when you would like to begin — we will contact you as soon as a place opens.',
  // TODO — contours provisoires. À remplacer par le vrai programme.
  tracks: [
    { name: 'Import track', body: 'How an import is put together end to end — finding and checking suppliers, the paperwork and permits, clearing goods and getting them delivered.' },
    { name: 'Export track', body: 'Ethiopian oilseeds and pulses in practice — quality and grading, buyers and contracts, documentation, inspection and shipping.' },
    { name: 'Both tracks',  body: 'The full programme, taken back to back. The usual choice for people setting up their own import–export company.' },
  ],
  note: 'No payment and no commitment at this stage. Sending this form only puts you on the list for the next intake.',
};
