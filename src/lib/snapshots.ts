/**
 * Copies figées (« snapshots »).
 *
 * Au moment de l'émission d'un document, les informations de l'exploitant et du client
 * sont recopiées DANS le document. Un PDF déjà émis ne doit jamais changer parce que
 * l'utilisateur a modifié ses Réglages ou la fiche client plus tard : ce serait un
 * document non conforme et un risque en cas de contrôle.
 */

import type { Client, PresetInstantane, Settings, SnapshotClient, SnapshotEmetteur } from '../types';

export function snapshotEmetteur(settings: Settings): SnapshotEmetteur {
  return {
    raisonSociale: settings.raisonSociale,
    formeJuridique: settings.formeJuridique,
    nomCommercial: settings.nomCommercial,
    adresse: settings.adresse,
    codePostal: settings.codePostal,
    ville: settings.ville,
    pays: settings.pays,
    telephone: settings.telephone,
    email: settings.email,
    siren: settings.siren,
    siret: settings.siret,
    numeroREVTC: settings.numeroREVTC,
    numeroTVAIntracom: settings.numeroTVAIntracom,
    capitalSocial: settings.capitalSocial,
    rcsVille: settings.rcsVille,
    rcsNumero: settings.rcsNumero,
    codeAPE: settings.codeAPE,
    assureurNom: settings.assureurNom,
    assureurContrat: settings.assureurContrat,
    assureurCouvertureGeographique: settings.assureurCouvertureGeographique,
    iban: settings.iban,
    bic: settings.bic,
    titulaireCompte: settings.titulaireCompte,
    logo: settings.logo,
    signature: settings.signature,
    couleurAccent: settings.couleurAccent,
  };
}

export function snapshotClient(client: Client): SnapshotClient {
  return {
    type: client.type,
    civilite: client.civilite,
    nom: client.nom,
    adresse: client.adresse,
    codePostal: client.codePostal,
    ville: client.ville,
    pays: client.pays,
    telephone: client.telephone,
    email: client.email,
    siret: client.siret,
    numeroTVAIntracom: client.numeroTVAIntracom,
    contactSurPlace: client.contactSurPlace,
  };
}

/**
 * Profil de bon instantané vide. Désactivé : un client n'apparaît dans l'onglet
 * Instantané que si le chauffeur l'y a explicitement mis. L'inverse ferait surgir
 * des profils non renseignés, qui échoueraient au moment de générer.
 */
export function presetInstantaneVide(): PresetInstantane {
  return {
    actif: false,
    // Activé par défaut : c'est l'intérêt du geste unique, et cela reste sans effet
    // tant que le profil n'est pas lui-même activé.
    utiliserMaPosition: true,
    lieuPriseEnCharge: '',
    destination: '',
    distanceKm: null,
    typePrestation: 'course_simple',
    libellePrestation: 'Transport de personnes',
    prixTTCcentimes: 0,
    nombrePassagers: null,
    modePaiement: 'cb',
    notesInternes: '',
  };
}

export function clientVide(): Client {
  const maintenant = new Date().toISOString();
  return {
    id: '',
    type: 'particulier',
    civilite: '',
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    pays: 'France',
    telephone: '',
    email: '',
    siret: '',
    numeroTVAIntracom: '',
    contactSurPlace: '',
    notes: '',
    parDefaut: false,
    instantane: presetInstantaneVide(),
    creeLe: maintenant,
    modifieLe: maintenant,
    supprime: false,
  };
}

/**
 * Complète un client relu de la base.
 *
 * Les fiches enregistrées avant l'arrivée du bon instantané n'ont pas de champ
 * `instantane`. Sans cette relecture, elles arriveraient avec `undefined` et l'onglet
 * Instantané planterait — sur les données existantes de l'utilisateur, c'est-à-dire
 * exactement là où une régression coûte le plus cher. La fusion est superficielle à
 * dessein : le profil est plat, et une fusion récursive masquerait un profil
 * volontairement vide derrière les valeurs par défaut.
 */
export function normaliserClient(client: Client): Client {
  return { ...client, instantane: { ...presetInstantaneVide(), ...client.instantane } };
}

/** Adresse postale sur une seule ligne, pour les PDF. */
export function adresseSurUneLigne(entite: {
  adresse: string;
  codePostal: string;
  ville: string;
  pays?: string;
}): string {
  return [entite.adresse, [entite.codePostal, entite.ville].filter(Boolean).join(' '), entite.pays]
    .filter((partie) => partie && partie.trim() !== '')
    .join(', ');
}
