# Tungsten Import Export

Site de la maison de négoce Tungsten Import Export, Addis-Abeba. Dix-huit pages
statiques, construites avec [Astro](https://astro.build). Aucun framework
d'interface, aucun JavaScript de bibliothèque : ce qui bouge tient en une
poignée de lignes écrites à la main.

**Le dossier de reprise est [`REPRISE.md`](REPRISE.md)** — le client, le
contenu, le système visuel, ce qui attend une réponse, et les pièges qui ont
déjà coûté du temps. Commencez par là.

---

## Démarrer

```bash
npm install
npm run dev        # http://localhost:4321
```

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | construit les 18 pages dans `dist/` |
| `npm run preview` | sert `dist/` sur le port 4321 |
| `npm run verif` | **la vérification complète** — voir plus bas |
| `node outils/bundle.mjs` | compile le site en un fichier unique, partageable |

## Modifier le contenu

Trois fichiers, et trois seulement. Aucun texte n'est écrit dans un composant.

| Fichier | Contient |
|---|---|
| `src/data/site.json` | coordonnées, horaires, lettre du fondateur, programme de formation, les 14 produits |
| `src/data/copy.json` | le texte des 14 fiches produits : chapeau, spécifications, blocs, appel |
| `src/data/home.json` | les sections de l'accueil : manifeste, réassurance, process, FAQ, appel final |

`home.json` porte une clé **`aConfirmer`** : la liste des affirmations rédigées
d'après l'usage courant du négoce mais **jamais confirmées par le client**. Le
process et trois questions sur sept en font partie. C'est cette liste qu'on lui
envoie.

## Le système visuel

Huit types de section, alternés de sorte que deux voisines ne se ressemblent
jamais — héros nuit, bande de données, ruban défilant, bande photo pleine
largeur, éditorial à titre collant, grille de cartes, citation, index à filets.
Trois familles de police : Fraunces pour les titres, Instrument Sans pour le
texte, IBM Plex Mono pour les micro-libellés.

Tout est décrit, avec les raisons, dans `src/styles/tokens.css` et dans
[`REPRISE.md`](REPRISE.md) §6.

**Deux règles se vérifient toutes seules** et font échouer `npm run verif` :
deux sections voisines ne peuvent pas porter le même type, et aucune page ne
peut dépasser 50 % de surface sombre.

## Les images

Une règle, et elle est absolue : **on n'agrandit jamais au-delà de 1,4×**. Le
pipeline ne fabrique aucune variante plus large que la source, `--nat` borne la
largeur affichée, et les bandes pleine largeur se centrent plutôt que de
s'étirer. Sous 1 024 px de source, pas de bande du tout.

Les fontes vivent dans `src/fonts/` et non dans `public/` : les chemins doivent
être **relatifs** pour que le compilateur les résolve. Un chemin absolu pointe à
côté dès que le site n'est pas servi à la racine.

## Publication

### GitHub Pages

`.github/workflows/pages.yml` construit et publie à chaque poussée sur `master`.
Le sous-chemin est **calculé depuis le nom du dépôt** : `/nom-du-depot/` pour
une page de projet, `/` pour une page de compte (`compte.github.io`). Une étape
du flux échoue si une seule adresse est restée à la racine.

Pour activer : *Settings → Pages → Source: **GitHub Actions***.

Toute adresse interne passe par `lien()` (`src/lib/lien.js`). N'écrivez jamais
`href="/about/"` en dur — le site doit rester déplaçable.

### La maquette en un fichier

```bash
npm run build && node outils/bundle.mjs
```

Produit deux formes des mêmes morceaux :

- `verif/maquette.html` — le fragment, pour une publication qui fournit
  elle-même son enveloppe ;
- `verif/maquette-autonome.html` — le document complet, pour ouvrir le fichier
  ou le poser sur n'importe quel hébergeur.

Les 18 pages, toutes les images et les quatre fontes en data URI, un routeur de
vingt lignes. Aucune dépendance réseau.

> **Construisez la maquette à la racine**, sans `BASE_PATH` : le routeur indexe
> ses routes par leur chemin nu.

## La vérification

```bash
npm run build
npm run preview &     # le port 4321 doit répondre
npm run verif
```

Enchaîne huit contrôles et s'arrête au premier qui échoue : polices, répertoire
de sections, sols, images, contraste AA composé sur fond clair **et** sur fond
nuit, cibles tactiles de 48 px, débordement horizontal, liens, clavier et piège
de focus, poids sur iPhone 12 et Android 360, et le tableau de départs — sa
**forme**, pas seulement son comportement.

Ce qui n'est **pas** couvert est écrit à la fin de la sortie. Lisez-le.

> **La règle qui gouverne ce dossier** : quand un contrôle passe alors que la
> chose est visiblement fausse, c'est le contrôle qu'il faut réparer. Trois
> défauts sont déjà partis chez le client sous des contrôles au vert.
