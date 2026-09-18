/**
 * Les formules vendues, leur prix, et le lien de paiement de chacune.
 *
 * Le prix vit ici en CENTIMES ENTIERS, comme partout ailleurs dans l'application, et tout
 * ce qui s'affiche en est DÉRIVÉ : le prix au mois équivalent de la formule annuelle, et
 * l'économie annoncée. Écrire « 2,50 € par mois » à la main à côté d'un « 29,99 € par an »
 * créerait deux vérités pour un même calcul, et elles divergeraient au premier changement
 * de tarif sans que rien ne le signale.
 *
 * ATTENTION, et c'est une conséquence à connaître : ces valeurs sont CUITES dans le
 * binaire. L'application ne demande rien au réseau pour afficher ses prix — c'est le
 * principe même du produit. Changer un tarif demande donc une nouvelle compilation et, le
 * paquet s'installant à la main, que chaque client réinstalle. Le lien de paiement doit
 * suivre pour la même raison : Stripe ne modifie pas le montant d'un tarif, il en crée un
 * nouveau, et le lien désigne un tarif précis.
 */

import { formatEuros } from '../../lib/money';

export type IdOffre = 'mensuel' | 'annuel';

export interface Offre {
  id: IdOffre;
  /** Prix en centimes entiers. */
  centimes: number;
  /** Nombre de mois couverts. Sert à comparer les formules entre elles. */
  mois: number;
  /**
   * Durée du jeton délivré à l'achat, en jours.
   *
   * 31 pour la formule mensuelle, et non 30 : le mois le plus long en compte 31, et il vaut
   * mieux couvrir un jour de trop que retrancher un jour payé. 366 pour l'annuelle, afin
   * qu'une année bissextile ne raccourcisse pas le droit.
   *
   * Ce n'est délibérément PAS « mois × 30,44 » : la durée du jeton est une décision
   * d'exploitation, la période facturée est une décision commerciale, et les lier par un
   * calcul ferait qu'une retouche de tarif changerait en silence ce qu'on signe.
   */
  jours: number;
  /** Lien de paiement Stripe. Tant qu'il est vide, la formule n'est pas proposée. */
  lien: string;
}

/**
 * À REMPLACER par les deux liens de paiement créés dans le tableau de bord Stripe.
 *
 * Tant qu'ils ne commencent pas par « https:// », la formule correspondante n'apparaît
 * PAS à l'écran. C'est délibéré : un bouton d'achat qui ne mène nulle part est pire qu'un
 * bouton absent — il tombe au moment précis où le client a sorti sa carte, et il passe
 * pour une panne de l'application plutôt que pour un oubli de configuration.
 */
const LIEN_MENSUEL = '';
const LIEN_ANNUEL = '';

export const OFFRES: readonly Offre[] = [
  { id: 'mensuel', centimes: 399, mois: 1, jours: 31, lien: LIEN_MENSUEL },
  { id: 'annuel', centimes: 2999, mois: 12, jours: 366, lien: LIEN_ANNUEL },
];

/** Vrai quand le lien de paiement a réellement été renseigné. */
export function offreDisponible(offre: Offre): boolean {
  return offre.lien.startsWith('https://');
}

/** Les formules réellement proposables. Vide tant que les liens n'ont pas été collés. */
export function offresDisponibles(): Offre[] {
  return OFFRES.filter(offreDisponible);
}

export function offreParId(id: IdOffre): Offre | undefined {
  return OFFRES.find((offre) => offre.id === id);
}

/** « 3,99 € par mois », « 29,99 € par an ». */
export function libellePrix(offre: Offre): string {
  return `${formatEuros(offre.centimes)} par ${offre.mois > 1 ? 'an' : 'mois'}`;
}

/**
 * Prix ramené au mois, pour rendre deux formules comparables d'un coup d'œil. `null` pour
 * une formule qui couvre déjà un seul mois : l'annonce n'apprendrait rien.
 */
export function equivalentMensuel(offre: Offre): string | null {
  if (offre.mois <= 1) return null;
  return `${formatEuros(Math.round(offre.centimes / offre.mois))} par mois`;
}

/**
 * Économie de la formule longue, en pourcentage entier, comparée à la formule courte.
 *
 * Calculée et non écrite : un « −37 % » figé dans le texte deviendrait faux au premier
 * changement de tarif, et c'est exactement le genre de chiffre qu'on ne pense pas à
 * corriger — il ne casse rien, il ment simplement.
 */
export function economiePourcent(): number | null {
  const courte = OFFRES.find((offre) => offre.mois === 1);
  const longue = OFFRES.find((offre) => offre.mois > 1);
  if (!courte || !longue || courte.centimes <= 0) return null;

  const parMoisLongue = longue.centimes / longue.mois;
  const economie = 1 - parMoisLongue / courte.centimes;
  if (economie <= 0) return null;
  return Math.round(economie * 100);
}
