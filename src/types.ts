/**
 * Types du domaine vtc-bons.
 *
 * Règle transversale : TOUS les montants sont exprimés en CENTIMES ENTIERS.
 * Aucun montant ne doit jamais être manipulé en nombre flottant en euros.
 */

export type RegimeTVA = 'assujetti' | 'franchise_en_base';

/** Péages et parkings refacturés : soit intégrés à la base taxable, soit traités en débours. */
export type TraitementPeages = 'dans_base' | 'debours';

export type TypePrestation =
  | 'course_simple'
  | 'transfert_aeroport'
  | 'transfert_gare'
  | 'mise_a_disposition'
  | 'excursion'
  | 'forfait';

export type StatutBon = 'brouillon' | 'emis' | 'annule' | 'facture';

export type StatutFacture = 'emise' | 'payee' | 'en_retard' | 'annulee';

export type TypeFacture = 'facture' | 'avoir';

export type TypeClient = 'particulier' | 'professionnel';

export type ModePaiement = 'especes' | 'cb' | 'virement' | 'plateforme' | 'facture' | 'autre';

export interface RemiseGlobale {
  type: 'pourcentage' | 'montant';
  /** Pourcentage (0-100) si type = 'pourcentage', sinon montant en CENTIMES. */
  valeur: number;
}

export interface LignePrestation {
  id: string;
  libelle: string;
  quantite: number;
  /** Prix unitaire en CENTIMES. */
  prixUnitaireCentimes: number;
  /** Taux de TVA en pourcentage (10 pour le transport de personnes). */
  tauxTVA: number;
  /** Ligne de débours (péage, parking refacturé à l'identique), hors base TVA. */
  estDebours: boolean;
}

export interface DetailTVA {
  taux: number;
  /** Base HT taxable pour ce taux, en CENTIMES. */
  baseHT: number;
  /** Montant de TVA pour ce taux, en CENTIMES. */
  montantTVA: number;
}

/** Copie figée de l'exploitant, prise au moment de l'émission. */
export interface SnapshotEmetteur {
  raisonSociale: string;
  formeJuridique: string;
  nomCommercial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siren: string;
  siret: string;
  numeroREVTC: string;
  numeroTVAIntracom: string;
  capitalSocial: string;
  rcsVille: string;
  rcsNumero: string;
  codeAPE: string;
  assureurNom: string;
  assureurContrat: string;
  assureurCouvertureGeographique: string;
  iban: string;
  bic: string;
  titulaireCompte: string;
  logo: string;
  signature: string;
  couleurAccent: string;
}

/** Copie figée du client, prise au moment de l'émission. */
export interface SnapshotClient {
  type: TypeClient;
  civilite: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siret: string;
  numeroTVAIntracom: string;
  contactSurPlace: string;
}

/**
 * PROFIL DE BON INSTANTANÉ.
 *
 * Tout ce qu'il faut pour émettre un bon en un seul geste, décidé une fois pour
 * toutes et rangé sur la fiche du client concerné.
 *
 * Pourquoi sur le client, et non dans les Réglages : c'est le CLIENT que le chauffeur
 * désigne du doigt au moment de partir. Un profil rangé ailleurs devrait être relié
 * à la main, et cette liaison serait une occasion de se tromper de profil — au pire
 * moment, c'est-à-dire au moment où le client monte.
 *
 * Ce profil ne recopie AUCUNE mention obligatoire déjà portée par la fiche client
 * (nom, téléphone) : les dupliquer créerait deux sources de vérité, qui finiraient
 * par diverger. Il ne contient que ce que la fiche client ne dit pas.
 */
export interface PresetInstantane {
  /** Le client apparaît dans l'onglet Instantané. */
  actif: boolean;
  /**
   * Remplacer le lieu de prise en charge par la position du chauffeur au moment de
   * générer. C'est ce qui rend le geste unique possible : le chauffeur est sur place.
   */
  utiliserMaPosition: boolean;
  /**
   * Lieu de prise en charge de secours, utilisé quand la position n'est pas obtenue —
   * hors connexion, autorisation refusée, ou aide à la saisie coupée. C'est un repli,
   * pas un doublon : sans lui, une panne de localisation rendrait le bon inutilisable.
   */
  lieuPriseEnCharge: string;
  destination: string;
  /**
   * Distance habituelle, en kilomètres. Saisie une fois, elle évite un appel réseau
   * au moment de générer — c'est-à-dire exactement quand on n'a pas le temps.
   */
  distanceKm: number | null;
  typePrestation: TypePrestation;
  /** Désignation portée sur la ligne de prestation. */
  libellePrestation: string;
  /**
   * Prix habituel, en CENTIMES, exprimé TTC — c'est-à-dire tel que le chauffeur
   * l'annonce à son client. Le HT et la TVA sont recalculés à la génération, selon
   * le régime et le taux par défaut des Réglages. Stocker le HT obligerait le
   * chauffeur à faire lui-même la conversion à l'envers, au moment de configurer.
   */
  prixTTCcentimes: number;
  nombrePassagers: number | null;
  modePaiement: ModePaiement;
  notesInternes: string;
}

export interface Client extends SnapshotClient {
  id: string;
  notes: string;
  parDefaut: boolean;
  /** Profil du bon instantané. Voir `PresetInstantane`. */
  instantane: PresetInstantane;
  creeLe: string;
  modifieLe: string;
  supprime: boolean;
}

export interface Settings {
  id: 'app';
  raisonSociale: string;
  formeJuridique: string;
  nomCommercial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siren: string;
  siret: string;
  numeroREVTC: string;
  numeroTVAIntracom: string;
  capitalSocial: string;
  rcsVille: string;
  rcsNumero: string;
  codeAPE: string;

  regimeTVA: RegimeTVA;
  tauxTVADefaut: number;
  /** Seuil de franchise en base, ÉDITABLE. Aucune valeur légale n'est figée dans le code. */
  seuilFranchise: number;
  traitementPeages: TraitementPeages;

  assureurNom: string;
  assureurContrat: string;
  assureurCouvertureGeographique: string;

  iban: string;
  bic: string;
  titulaireCompte: string;

  prefixeBon: string;
  prefixeFacture: string;
  prefixeAvoir: string;
  reinitialiserChaqueAnnee: boolean;

  delaiPaiementJours: number;
  conditionsPaiement: string;
  penalitesRetard: string;
  escompteTexte: string;
  mentionSpecifique: string;

  /** Dernier véhicule utilisé, proposé automatiquement à la saisie. */
  vehiculeMarque: string;
  vehiculeModele: string;
  vehiculeImmatriculation: string;
  vehiculeCouleur: string;

  logo: string;
  signature: string;
  couleurAccent: string;

  /**
   * Autorise l'aide à la saisie d'adresse : propositions au fil de la frappe, bouton
   * « Ma position », et calcul automatique de la distance entre deux adresses.
   *
   * Ces aides interrogent des services externes — c'est la seule chose de
   * l'application qui sorte sur le réseau. Désactivé, plus aucune donnée ne quitte
   * l'appareil et la saisie redevient entièrement manuelle.
   */
  aideAdresse: boolean;

  /**
   * Minutes retranchées à l'heure de RÉSERVATION du bon instantané.
   *
   * La prise en charge n'est jamais décalée, et c'est délibéré : reculer les deux dates
   * ensemble les laisserait égales, donc le justificatif aussi faible qu'avant. Le
   * raisonnement complet est dans `src/lib/antedatation.ts`, avec la lecture défensive
   * qui protège les sauvegardes restaurées.
   */
  antedatationReservationMinutes: number;

  derniereSauvegarde: string | null;
}

export interface EntreeHistorique {
  dateISO: string;
  champ: string;
  ancienneValeur: string;
  nouvelleValeur: string;
  motif: string;
}

export interface Bon {
  id: string;
  /** null tant que le bon est un brouillon : le numéro n'est attribué qu'à l'émission. */
  numero: string | null;
  statut: StatutBon;

  clientId: string;
  /** Renseigné à l'émission : un document émis ne change plus jamais rétroactivement. */
  clientSnapshot: SnapshotClient | null;
  emetteurSnapshot: SnapshotEmetteur | null;

  creeLe: string;
  /** Date et heure auxquelles la RÉSERVATION a été enregistrée (mention 5 de l'arrêté). */
  dateReservation: string;
  heureReservation: string;
  /** Date et heure de prise en charge souhaitées (mention 6 de l'arrêté). */
  datePriseEnCharge: string;
  heurePriseEnCharge: string;
  /** Lieu de prise en charge indiqué par le client (mention 7 de l'arrêté). */
  lieuPriseEnCharge: string;
  destination: string;
  distanceKm: number | null;
  typePrestation: TypePrestation;
  numeroVolTrain: string;
  terminal: string;
  bagages: string;
  nombrePassagers: number | null;

  vehiculeMarque: string;
  vehiculeModele: string;
  vehiculeImmatriculation: string;
  vehiculeCouleur: string;
  nomConducteur: string;

  lignes: LignePrestation[];
  remiseGlobale: RemiseGlobale | null;
  modePaiement: ModePaiement;

  notesInternes: string;
  notesClient: string;

  factureId: string | null;

  pdfBlob: Blob | null;
  pdfGenereLe: string | null;

  historique: EntreeHistorique[];

  supprime: boolean;
  supprimeLe: string | null;
}

export interface Facture {
  id: string;
  numero: string;
  type: TypeFacture;

  bonId: string | null;
  /** Pour un avoir : la facture annulée. */
  factureOrigineId: string | null;

  clientId: string;
  clientSnapshot: SnapshotClient;
  emetteurSnapshot: SnapshotEmetteur;

  dateEmission: string;
  /** Date de la prestation, distincte de la date d'émission. */
  datePrestation: string;
  dateEcheance: string;

  lignes: LignePrestation[];
  remiseGlobale: RemiseGlobale | null;

  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  /** Débours refacturés à l'identique, hors base TVA. */
  montantDebours: number;
  detailTVA: DetailTVA[];
  mentionTVA: string;

  conditionsPaiement: string;
  penalitesRetard: string;
  escompteTexte: string;
  mentionSpecifique: string;

  statut: StatutFacture;
  datePaiement: string | null;
  moyenPaiement: ModePaiement | null;

  notes: string;

  pdfBlob: Blob | null;
  pdfGenereLe: string | null;

  historique: EntreeHistorique[];

  supprime: boolean;
  supprimeLe: string | null;
}

export interface Compteur {
  /** Clé de compteur : `PREFIXE-AAAA` si réinitialisation annuelle, sinon `PREFIXE`. */
  key: string;
  valeur: number;
}

export interface DocumentChauffeur {
  id: string;
  libelle: string;
  numero: string;
  dateDelivrance: string;
  dateExpiration: string;
  note: string;
  ordre: number;
}

export type ActionAudit = 'creation' | 'modification' | 'suppression';

export interface EntreeAudit {
  id: string;
  dateISO: string;
  entite: 'bon' | 'facture' | 'client' | 'reglages' | 'document';
  entiteId: string;
  action: ActionAudit;
  details: string;
}

/** Sauvegarde complète, exportée en JSON. */
export interface Sauvegarde {
  version: number;
  exporteLe: string;
  settings: Settings;
  clients: Client[];
  bons: Bon[];
  factures: Facture[];
  compteurs: Compteur[];
  documentsChauffeur: DocumentChauffeur[];
  audit: EntreeAudit[];
}
