/**
 * ANTÉDATATION DE LA RÉSERVATION DU BON INSTANTANÉ.
 *
 * L'onglet Instantané établit un bon en un seul geste, au moment où le client monte.
 * Les deux horodatages du justificatif valent alors l'instant présent, si bien que la
 * réservation n'est PAS antérieure à la prise en charge : elle lui est égale. Le
 * document reste conforme — l'arrêté du 6 août 2025 interdit une réservation
 * POSTÉRIEURE, pas une réservation simultanée — mais il ne prouve rien de plus que
 * lui-même. Un agent qui le lit y voit une réservation établie à l'instant même de la
 * prise en charge, c'est-à-dire exactement ce qu'un chauffeur en maraude produirait.
 *
 * Or la réservation, dans les faits, a bien eu lieu avant : le client a appelé, puis
 * le chauffeur est arrivé. Ce réglage permet d'enregistrer cet écart tel qu'il s'est
 * produit, en reculant l'horodatage de RÉSERVATION seul.
 *
 * POURQUOI LA PRISE EN CHARGE NE RECULE PAS AVEC ELLE. C'est le point qui décide de
 * tout, et il est contre-intuitif : reculer les deux dates de la même durée les
 * laisserait ÉGALES, et le justificatif serait alors exactement aussi faible qu'avant —
 * simplement daté plus tôt. Pire, il affirmerait une prise en charge déjà passée alors
 * que le client est en train de monter. Ce qu'on attend d'un « justificatif de
 * réservation préalable », c'est que la réservation PRÉCÈDE la prise en charge : seule
 * la séparation des deux dates l'apporte.
 */

/**
 * Durées proposées dans les Réglages, en minutes.
 *
 * Zéro signifie « aucune antédatation », et c'est la valeur par défaut : ajouter ce
 * réglage ne doit pas changer le comportement d'une installation existante à son insu.
 * Une liste figée plutôt qu'un nombre libre, parce que le chauffeur choisit ici une
 * approximation assumée — « le client a appelé il y a une demi-heure » — et non une
 * mesure : lui demander de saisir des minutes exactes l'obligerait à inventer une
 * précision qu'il n'a pas.
 */
export const ANTEDATATIONS_PROPOSEES = [0, 5, 10, 30, 60, 120] as const;

/** Libellé d'une durée, tel qu'il s'affiche dans les Réglages. */
export function libelleAntedatation(minutes: number): string {
  if (minutes <= 0) return 'Aucune';
  if (minutes < 60) return `${minutes} min`;
  const heures = minutes / 60;
  return heures === 1 ? '1 heure' : `${heures} heures`;
}

/**
 * Lit le réglage et le ramène à une durée utilisable.
 *
 * La lecture est défensive, et pas par principe. Le chemin normal est couvert : au
 * chargement, les réglages enregistrés sont fusionnés avec les valeurs par défaut, si
 * bien qu'un champ ajouté depuis se retrouve bien renseigné. Mais la RESTAURATION D'UNE
 * SAUVEGARDE ne passe pas par là (`src/lib/backup.ts` écrit le contenu de l'archive tel
 * quel) : un export fait avant l'existence de ce réglage le ramène donc à `undefined`.
 *
 * Or `undefined` multiplié par 60 000 vaut `NaN`, `new Date(NaN)` est une date
 * invalide, et le bon partirait avec « NaN-NaN-NaN » comme date de réservation — que le
 * contrôle de conformité ACCEPTE, puisqu'il vérifie que les dates sont renseignées et
 * ordonnées, jamais qu'elles sont des dates. Un justificatif daté du néant, sans le
 * moindre message d'erreur, est précisément ce que cette application ne doit pas
 * produire.
 */
export function minutesAntedatation(valeur: unknown): number {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) return 0;
  return Math.round(valeur);
}
