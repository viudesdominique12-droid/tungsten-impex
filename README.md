# Tungsten Import Export — site

Site statique. Aucune dépendance, aucun `npm install`. On ouvre `index.html`
et ça marche.

## Modifier le contenu

Deux fichiers, et deux seulement :

| Fichier | Contient |
|---|---|
| `src/catalog.mjs` | l'identité : coordonnées, réseaux, lettre du fondateur, les 14 produits avec leur **couleur** et leur photo |
| `src/copy.json` | le **texte** des 14 fiches produits |

Après toute modification :

```bash
node src/build.mjs
```

Les 20 pages sont réécrites. **Ne jamais modifier les `.html` à la main** — ils
sont écrasés à chaque build.

## Le système de couleurs

C'est la pièce maîtresse. La méthode vient de zaziwe-labs : **aucune neutre
n'est vraiment neutre.** Le fond n'est pas blanc, l'encre n'est pas noire, le
gris secondaire n'est pas gris — tout est teinté vers la couleur du produit.

Dans `src/catalog.mjs`, un produit ne déclare qu'**une seule couleur** :

```js
{ slug: 'solar-lanterns', name: 'Solar Lanterns', accent: '#D97A0F', hero: false }
```

`src/color.mjs` en dérive quinze jetons — fond, surface, lavis, filet,
sourdine, encre, trois tons de nuit, et trois variantes d'accent garanties
lisibles. Résultat concret :

| | ascenseurs `#5C6672` | lanternes solaires `#D97A0F` |
|---|---|---|
| fond | `#f6f6f7` gris porcelaine | `#f9f6f3` crème chaud |
| encre | `#1b1d20` noir froid | `#2d1e0d` brun-noir chaud |
| sourdine | `#5c6066` gris acier | `#7c6346` gris-brun |

La page entière change de température, pas seulement un bouton.

**Vérifier la méthode** — la formule, nourrie du bleu de zaziwe-labs, doit
retrouver la palette de zaziwe-labs :

```bash
node -e "const{family,hexToRgb}=await import('./src/color.mjs');const Z={accent:'#1B3FA6',bg:'#F2F5F9',ink:'#0A1A33',muted:'#45597A'};const g=family(Z.accent);const d=(a,b)=>{const[x,y]=[hexToRgb(a),hexToRgb(b)];return Math.round(Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]))};for(const k of ['bg','ink','muted'])console.log(k,Z[k],g[k],'ecart',d(Z[k],g[k]))"
```

Les écarts doivent rester sous 10 (sur 441).

### Choisir une couleur

Prenez celle qui vous plaît. Les couleurs trop claires pour porter du texte
blanc sont **assombries automatiquement** le long de leur propre teinte
jusqu'à passer le seuil d'accessibilité WCAG — vous n'avez pas à y penser.

Seule contrainte : gardez au moins ~12° d'écart de teinte avec les produits
voisins, ou compensez par la saturation. Pour contrôler :

```bash
node -e "const{family,contrast,rgbToHsl,hexToRgb}=await import('./src/color.mjs');const{imports,exports_}=await import('./src/catalog.mjs');for(const p of [...imports,...exports_]){const[h]=rgbToHsl(hexToRgb(p.accent));const f=family(p.accent);console.log(p.name.padEnd(24),'H'+Math.round(h),'blanc/accent',contrast('#fff',f.strong).toFixed(1),'encre/fond',contrast(f.ink,f.bg).toFixed(1))}"
```

## Les photos

`assets/img/products/` — les 14 photos produits, **récupérées de votre propre
site** puis recompressées (5,6 Mo → 2 Mo).

Le champ `hero` décide du traitement :

- `hero: true` — photo assez grande (≥ 1100 px) → bandeau pleine largeur
- `hero: false` — photo plus petite → panneau encadré, à sa taille réelle

C'est ce qui évite qu'une image de 400 px soit étirée et floue en pleine
largeur. Si vous remplacez une photo par une plus grande, passez `hero` à
`true`.

`assets/img/company/` — vos photos : bureaux, entrepôt, quarantaine, fondateur.

## Structure

```
index.html · about.html · imports.html · exports.html
training.html · contact.html
imports/*.html   10 fiches   (générées)
exports/*.html    4 fiches   (générées)

assets/css/site.css   une seule feuille
assets/js/site.js     menu pop-up, apparitions, formulaire
src/catalog.mjs       ← identité, couleurs, photos
src/copy.json         ← textes des fiches
src/color.mjs         ← la dérivation des couleurs
src/build.mjs         ← le générateur
photos-originaux/     vos originaux, intacts. Ne pas publier.
```

## Ajouter un produit

Un objet dans `imports` ou `exports_` de `src/catalog.mjs`, une entrée dans
`src/copy.json`, une photo dans `assets/img/products/<slug>.jpg`, puis le
build. Le produit apparaît tout seul dans le menu pop-up, le registre, le pied
de page et la navigation précédent/suivant.

## Le formulaire de formation

Sans serveur, il ouvre la messagerie du visiteur avec l'e-mail déjà rédigé.
Pour collecter les inscriptions automatiquement, mettez l'adresse d'un service
de formulaire (Formspree, Netlify Forms) dans `ENDPOINT`, en haut de
`assets/js/site.js`. Le repli par e-mail devient alors le chemin d'erreur.

## Réseaux sociaux

`company.socials` dans `src/catalog.mjs`. Une entrée dont l'`url` est vide est
ignorée partout. Renseignez-la et le lien apparaît dans le pied de page et sur
la page Contact. WhatsApp est déjà branché sur le numéro de l'entreprise.

## Mise en ligne

N'importe quel hébergeur statique — Netlify, Vercel, GitHub Pages, Cloudflare
Pages, ou FTP. Envoyez tout **sauf** `src/`, `photos-originaux/`, `.staging/`,
`.claude/` et `README.md`.

Aperçu local :

```bash
npx serve .
```
