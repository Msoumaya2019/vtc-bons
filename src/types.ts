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

export interface Client extends SnapshotClient {
  id: string;
  notes: string;
  parDefaut: boolean;
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
