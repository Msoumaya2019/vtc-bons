import { parametresParDefaut } from '../src/lib/db';
import { presetInstantaneVide, snapshotClient, snapshotEmetteur } from '../src/lib/snapshots';
import { calculerTotaux } from '../src/lib/tva';
import type {
  Bon,
  Client,
  Facture,
  LignePrestation,
  PresetInstantane,
  Settings,
} from '../src/types';

/** Réglages complets et valides, pour les tests. */
export function reglagesTest(surcharge: Partial<Settings> = {}): Settings {
  return {
    ...parametresParDefaut(),
    raisonSociale: 'Transports Dupont',
    formeJuridique: 'Entreprise individuelle',
    adresse: '1 rue de la Gare',
    codePostal: '95300',
    ville: 'Pontoise',
    telephone: '06 12 34 56 78',
    email: 'contact@transports-dupont.fr',
    siren: '123456789',
    siret: '12345678900012',
    numeroREVTC: 'EVTC0123456789',
    numeroTVAIntracom: 'FR12345678901',
    assureurNom: 'Assur VTC',
    assureurContrat: 'RC-2026-0042',
    assureurCouvertureGeographique: 'Union européenne',
    ...surcharge,
  };
}

export function clientTest(surcharge: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    type: 'particulier',
    civilite: 'M.',
    nom: 'Martin Leroy',
    adresse: '5 avenue Victor Hugo',
    codePostal: '75016',
    ville: 'Paris',
    pays: 'France',
    telephone: '07 98 76 54 32',
    email: 'martin.leroy@example.fr',
    siret: '',
    numeroTVAIntracom: '',
    contactSurPlace: '',
    notes: '',
    parDefaut: true,
    instantane: presetInstantaneVide(),
    creeLe: '2026-01-01T10:00:00.000Z',
    modifieLe: '2026-01-01T10:00:00.000Z',
    supprime: false,
    ...surcharge,
  };
}

/**
 * Profil de bon instantané complet et exploitable. Le lieu de prise en charge de
 * secours est renseigné : sans lui, un échec de localisation rendrait le bon
 * impossible à émettre, et c'est précisément ce que le profil doit couvrir.
 */
export function profilInstantane(surcharge: Partial<PresetInstantane> = {}): PresetInstantane {
  return {
    ...presetInstantaneVide(),
    actif: true,
    lieuPriseEnCharge: '5 avenue Victor Hugo, 75016 Paris',
    destination: 'Aéroport Charles-de-Gaulle, terminal 2E',
    distanceKm: 32,
    typePrestation: 'transfert_aeroport',
    libellePrestation: 'Transfert aéroport',
    prixTTCcentimes: 9500,
    nombrePassagers: 2,
    modePaiement: 'cb',
    notesInternes: 'Client habituel.',
    ...surcharge,
  };
}

/** Client dont le profil instantané est prêt : un seul geste suffit à générer son bon. */
export function clientInstantaneTest(surcharge: Partial<Client> = {}): Client {
  return clientTest({ instantane: profilInstantane(), ...surcharge });
}

export function ligneTest(surcharge: Partial<LignePrestation> = {}): LignePrestation {
  return {
    id: 'ligne-1',
    libelle: 'Transport de personnes',
    quantite: 1,
    prixUnitaireCentimes: 10000,
    tauxTVA: 10,
    estDebours: false,
    ...surcharge,
  };
}

/**
 * Bon émis et conforme : les 7 mentions de l'arrêté du 6 août 2025 sont renseignées.
 * La réservation est bien ANTÉRIEURE à la prise en charge.
 */
export function bonTest(surcharge: Partial<Bon> = {}): Bon {
  const reglages = reglagesTest();
  const client = clientTest();
  return {
    id: 'bon-1',
    numero: 'BC-2026-0001',
    statut: 'emis',
    clientId: client.id,
    clientSnapshot: snapshotClient(client),
    emetteurSnapshot: snapshotEmetteur(reglages),
    creeLe: '2026-03-14T08:00:00.000Z',
    dateReservation: '2026-03-14',
    heureReservation: '08:00',
    datePriseEnCharge: '2026-03-15',
    heurePriseEnCharge: '09:30',
    lieuPriseEnCharge: '12 rue de la Gare, 95300 Pontoise',
    destination: 'Aéroport Charles-de-Gaulle, terminal 2E',
    distanceKm: 42,
    typePrestation: 'transfert_aeroport',
    numeroVolTrain: 'AF1234',
    terminal: '2E',
    bagages: '2 valises',
    nombrePassagers: 2,
    vehiculeMarque: 'Mercedes',
    vehiculeModele: 'Classe E',
    vehiculeImmatriculation: 'AB-123-CD',
    vehiculeCouleur: 'Noir',
    nomConducteur: '',
    lignes: [ligneTest()],
    remiseGlobale: null,
    modePaiement: 'cb',
    notesInternes: '',
    notesClient: '',
    factureId: null,
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
    ...surcharge,
  };
}

/**
 * Facture émise cohérente : les montants sont calculés par le moteur TVA, jamais saisis
 * à la main, afin qu'un test qui compare bon et facture compare bien deux calculs.
 */
export function factureTest(surcharge: Partial<Facture> = {}): Facture {
  const reglages = reglagesTest();
  const client = clientTest();
  const lignes = [ligneTest()];
  const totaux = calculerTotaux(lignes, {
    regimeTVA: reglages.regimeTVA,
    traitementPeages: reglages.traitementPeages,
    remiseGlobale: null,
  });

  return {
    id: 'facture-1',
    numero: 'FA-2026-0001',
    type: 'facture',
    bonId: 'bon-1',
    factureOrigineId: null,
    clientId: client.id,
    clientSnapshot: snapshotClient(client),
    emetteurSnapshot: snapshotEmetteur(reglages),
    dateEmission: '2026-03-16',
    datePrestation: '2026-03-15',
    dateEcheance: '2026-04-15',
    lignes,
    remiseGlobale: null,
    montantHT: totaux.totalHT,
    montantTVA: totaux.totalTVA,
    montantTTC: totaux.totalTTC,
    montantDebours: totaux.totalDebours,
    detailTVA: totaux.detailTVA,
    mentionTVA: totaux.mentionTVA,
    conditionsPaiement: reglages.conditionsPaiement,
    penalitesRetard: reglages.penalitesRetard,
    escompteTexte: reglages.escompteTexte,
    mentionSpecifique: '',
    statut: 'emise',
    datePaiement: null,
    moyenPaiement: null,
    notes: '',
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
    ...surcharge,
  };
}

/**
 * Aides de licence.
 *
 * Elles engendrent leur propre paire au lieu d'employer celle du dépôt : la clé privée
 * est écartée par `.gitignore`, donc absente sur toute autre machine, et un test qui en
 * dépendrait échouerait au premier clone.
 *
 * `btoa` plutôt que `Buffer` : les tests s'exécutent dans jsdom, où l'encodage doit
 * rester celui qu'un navigateur sait faire — c'est précisément ce que l'application
 * utilisera pour lire une licence.
 */
export function base64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function engendrerPaire(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

export async function clePubliqueDe(paire: CryptoKeyPair): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey)));
}

/** Signe une charge comme le fera le serveur de licences. */
export async function signerLicence(charge: unknown, clePrivee: CryptoKey): Promise<string> {
  const octets = new TextEncoder().encode(JSON.stringify(charge));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clePrivee, octets),
  );
  return `${base64Url(octets)}.${base64Url(signature)}`;
}

/** Charge de licence complète, valable loin devant. */
export function chargeLicence(
  surcharge: Partial<{ sujet: string; expiration: string; type: string }> = {},
): Record<string, unknown> {
  return { sujet: 'Transports Dupont', expiration: '2030-01-01', type: 'abonnement', ...surcharge };
}

/** Une licence valide signée par une paire neuve, prête à être enregistrée. */
export async function licenceValideTest(
  reference: Date = new Date(),
): Promise<{ jeton: string; clePublique: string }> {
  const paire = await engendrerPaire();
  const expiration = `${reference.getFullYear() + 1}-01-01`;
  const jeton = await signerLicence(chargeLicence({ expiration }), paire.privateKey);
  return { jeton, clePublique: await clePubliqueDe(paire) };
}
