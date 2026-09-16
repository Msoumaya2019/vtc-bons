/**
 * Référentiel des mentions réglementaires.
 *
 * Ce fichier est la SOURCE UNIQUE de ces libellés : le contrôle de conformité, le PDF et
 * la page d'aide s'y réfèrent tous. Cela garantit qu'une mention vérifiée est exactement
 * une mention imprimée.
 */

/**
 * Les 7 mentions obligatoires du justificatif de réservation préalable.
 * Arrêté du 6 août 2025 (JO du 29 août 2025), en vigueur depuis le 29 octobre 2025,
 * pris en application de l'article L. 3120-2 du Code des transports.
 * Support papier OU électronique.
 */
export const MENTIONS_ARRETE_2025 = [
  'Nom ou raison sociale de l’exploitant, et ses coordonnées',
  'Numéro d’inscription au registre des VTC (REVTC)',
  'Numéro unique d’identification (SIREN)',
  'Nom et coordonnées téléphoniques du client',
  'Date et heure de la réservation',
  'Date et heure de prise en charge souhaitées',
  'Lieu de prise en charge indiqué par le client',
] as const;

/**
 * Mentions obligatoires d'une facture (Code de commerce et CGI).
 * La signature n'en fait pas partie : elle est inutile sur une facture en France.
 */
export const MENTIONS_OBLIGATOIRES_FACTURE = [
  'Numéro unique de facture, séquence chronologique continue',
  'Date d’émission',
  'Date de la prestation',
  'Identité complète du vendeur (dénomination, forme juridique, adresse, SIREN/SIRET)',
  'Numéro de TVA intracommunautaire si assujetti',
  'Numéro d’inscription au registre des VTC (REVTC)',
  'Identité de l’acheteur (nom ou raison sociale et adresse)',
  'Désignation détaillée des prestations, quantité et prix unitaire HT',
  'Taux de TVA appliqué par ligne',
  'Total HT',
  'Détail de la TVA par taux',
  'Total TTC',
  'Somme totale à payer',
  'Date d’échéance et conditions de règlement',
  'Pénalités de retard et indemnité forfaitaire de recouvrement de 40 €',
  'Escompte pour paiement anticipé, le cas échéant',
  'Mention d’assurance professionnelle (assureur, contrat, couverture géographique)',
  'Mention « TVA non applicable, article 293 B du CGI » en franchise en base',
  'Coordonnées bancaires si virement',
] as const;

/** Documents à pouvoir présenter lors d'un contrôle routier. Liste indicative. */
export const DOCUMENTS_CONTROLE = [
  'Permis de conduire catégorie B en cours de validité',
  'Carte professionnelle VTC (affichée sur le pare-brise)',
  'Attestation d’assurance RC circulation',
  'Attestation d’assurance RC Pro / exploitation',
  'Macaron VTC (lunette arrière)',
  'Certificat de contrôle technique à jour',
  'Carte grise du véhicule',
  'Certificat médical d’aptitude (Cerfa 14880)',
  'Justificatif d’inscription au registre des VTC (REVTC)',
  'Attestation de vigilance URSSAF (contrat supérieur à 5 000 €)',
] as const;

export const AVERTISSEMENT_JURIDIQUE =
  'Cette application produit des documents conformes aux textes cités, mais elle ne constitue ni un conseil juridique ni un conseil fiscal. Les mentions réglementaires évoluent : vérifiez-les auprès des textes en vigueur ou de votre expert-comptable.';
