/* ---------------------------------------------------------------------------
   Les largeurs de variantes a demander pour une image.

   Pourquoi ce fichier existe. Chaque appel a <Picture> portait sa propre liste,
   ecrite a la main sur le modele :

       [400, 620, 900, 1240].filter((w) => w <= img.width)

   Pour une source de 447px, cela ne laisse que 400. La taille NATIVE — 447,
   celle qui contient le plus de pixels — n'etait jamais proposee au
   navigateur, qui servait donc une variante plus petite que le fichier
   disponible. Mesure faite sur la fiche des lanternes solaires : srcset
   « 400w » seul, pour un fichier de 447px, affiche sur 361px CSS. Sur un ecran
   a densite double il en faut 722 : on en servait 400 quand 447 existaient.

   Ce n'est pas enorme, et c'est justement pour cela que personne ne le voit :
   la perte est de 10 % sur une image deja trop petite. Mais elle etait
   gratuite, et elle touchait les quatorze fiches.

   La regle est donc : les paliers utiles, PLUS la taille native, et jamais
   au-dela — on n'agrandit jamais.
   --------------------------------------------------------------------------- */

export const largeurs = (image, paliers) => {
  const nat = image?.width ?? 0;
  if (!nat) return [];
  return [...new Set([...paliers.filter((w) => w < nat), nat])].sort((a, b) => a - b);
};
