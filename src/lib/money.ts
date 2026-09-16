/**
 * Manipulation monétaire.
 *
 * INVARIANT ABSOLU DU PROJET : tout montant est un entier de centimes.
 * Aucun calcul monétaire n'est effectué en nombre flottant d'euros.
 * Les seules opérations flottantes autorisées sont les multiplications par un taux
 * de TVA ou un pourcentage de remise, immédiatement suivies d'un arrondi au centime.
 */

/** Arrondi commercial au centime le plus proche. */
export function arrondiCentimes(valeur: number): number {
  if (!Number.isFinite(valeur)) return 0;
  // Le garde-fou sur 1e-9 évite qu'une erreur de représentation binaire (ex. 0.5 - epsilon)
  // fasse descendre un arrondi qui devrait monter.
  return Math.round(valeur + (valeur >= 0 ? 1e-9 : -1e-9));
}

/** Convertit un montant en euros (saisie utilisateur) en centimes entiers. */
export function eurosVersCentimes(euros: number): number {
  return arrondiCentimes(euros * 100);
}

/** Convertit des centimes entiers en euros. À n'utiliser que pour l'affichage ou la saisie. */
export function centimesVersEuros(centimes: number): number {
  return centimes / 100;
}

/** Applique un pourcentage à un montant en centimes, arrondi au centime. */
export function pourcentageDe(centimes: number, pourcentage: number): number {
  return arrondiCentimes((centimes * pourcentage) / 100);
}

/**
 * Formate un montant en centimes pour l'affichage, en français : `1 234,56 €`.
 * Les espaces produits par Intl (fine insécable U+202F ou insécable U+00A0) sont
 * normalisés en espace ordinaire : le rendu est ainsi déterministe et testable.
 */
export function formatEuros(centimes: number): string {
  const euros = centimes / 100;
  const texte = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
  return texte.replace(/[\u202f\u00a0]/g, ' ');
}

/**
 * Formate un montant sans le symbole, pour la saisie dans un champ.
 * Exemple : 123456 -> "1234,56"
 */
export function formatSaisieEuros(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',');
}

/**
 * Analyse une saisie utilisateur en euros et renvoie des centimes entiers.
 * Accepte la virgule et le point comme séparateur décimal, les espaces de milliers,
 * et le symbole euro. Renvoie null si la saisie n'est pas un nombre exploitable.
 */
export function parseSaisieEuros(saisie: string): number | null {
  if (saisie == null) return null;
  const nettoye = saisie
    .replace(/[\u202f\u00a0\s]/g, '')
    .replace(/€/g, '')
    .replace(',', '.');
  if (nettoye === '') return 0;
  if (!/^-?\d*\.?\d*$/.test(nettoye)) return null;
  const valeur = Number(nettoye);
  if (!Number.isFinite(valeur)) return null;
  return eurosVersCentimes(valeur);
}

/** Formate une quantité (jusqu'à 2 décimales) en français. */
export function formatQuantite(quantite: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(quantite);
}
