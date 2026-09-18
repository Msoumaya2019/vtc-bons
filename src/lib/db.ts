import Dexie, { type Table } from 'dexie';
import type {
  Bon,
  Client,
  Compteur,
  DocumentChauffeur,
  EntreeAudit,
  Facture,
  Settings,
} from '../types';

export const DB_NAME = 'vtc-bons';

/**
 * Base de données locale. Aucune donnée ne quitte jamais l'appareil.
 *
 * Note sur les index : IndexedDB n'accepte pas les booléens comme clé d'index.
 * Les champs `parDefaut` et `supprime` ne sont donc pas indexés ; ils sont filtrés
 * en mémoire, ce qui est parfaitement adapté à un volume de quelques centaines de documents.
 */
export class VtcDatabase extends Dexie {
  settings!: Table<Settings, string>;
  clients!: Table<Client, string>;
  bons!: Table<Bon, string>;
  factures!: Table<Facture, string>;
  compteurs!: Table<Compteur, string>;
  documentsChauffeur!: Table<DocumentChauffeur, string>;
  audit!: Table<EntreeAudit, string>;

  constructor() {
    super(DB_NAME);

    // Version 1 — schéma initial.
    // Toute évolution future ajoutera une `version(2)` avec sa fonction `upgrade`,
    // sans jamais modifier cette déclaration : les données déjà présentes sur les
    // appareils doivent survivre aux mises à jour.
    this.version(1).stores({
      settings: 'id',
      clients: 'id, nom, creeLe',
      bons: 'id, numero, statut, clientId, creeLe, datePriseEnCharge',
      factures: 'id, numero, statut, clientId, dateEmission, dateEcheance, bonId',
      compteurs: 'key',
      documentsChauffeur: 'id, ordre',
      audit: 'id, dateISO, entite, entiteId',
    });
  }
}

export const db = new VtcDatabase();

export function parametresParDefaut(): Settings {
  return {
    id: 'app',
    raisonSociale: '',
    formeJuridique: '',
    nomCommercial: '',
    adresse: '',
    codePostal: '',
    ville: '',
    pays: 'France',
    telephone: '',
    email: '',
    siren: '',
    siret: '',
    numeroREVTC: '',
    numeroTVAIntracom: '',
    capitalSocial: '',
    rcsVille: '',
    rcsNumero: '',
    codeAPE: '4932Z',

    regimeTVA: 'assujetti',
    tauxTVADefaut: 10,
    // Seuil éditable : aucune valeur légale n'est figée dans le code, elle change
    // régulièrement et doit être vérifiée chaque année.
    seuilFranchise: 37500,
    traitementPeages: 'dans_base',

    assureurNom: '',
    assureurContrat: '',
    assureurCouvertureGeographique: '',

    iban: '',
    bic: '',
    titulaireCompte: '',

    prefixeBon: 'BC',
    prefixeFacture: 'FA',
    prefixeAvoir: 'AV',
    reinitialiserChaqueAnnee: true,

    delaiPaiementJours: 30,
    conditionsPaiement: 'Paiement à réception de facture.',
    penalitesRetard:
      'Pénalités de retard : trois fois le taux d’intérêt légal en vigueur. Indemnité forfaitaire pour frais de recouvrement : 40 €.',
    escompteTexte: 'Pas d’escompte pour paiement anticipé.',
    mentionSpecifique: '',

    vehiculeMarque: '',
    vehiculeModele: '',
    vehiculeImmatriculation: '',
    vehiculeCouleur: '',

    logo: '',
    signature: '',
    couleurAccent: '#1d4ed8',

    // Activé par défaut : c'est ce qui rend la saisie d'adresse confortable. Le
    // chauffeur peut le couper, et plus rien ne sort alors de l'appareil.
    aideAdresse: true,

    // Aucune antédatation par défaut. Ce réglage existe pour corriger un défaut connu —
    // la réservation du bon instantané porte la même heure que la prise en charge — mais
    // le corriger d'office changerait la date de documents déjà émis, sans que le
    // chauffeur l'ait demandé. C'est à lui de l'activer.
    antedatationReservationMinutes: 0,

    derniereSauvegarde: null,

    // Aucune licence au premier lancement : l'application démarre en version d'essai,
    // avec ses plafonds. Voir `src/lib/quota.ts` et `src/lib/acces.ts`.
    licence: '',
  };
}

/** Renvoie les paramètres, en créant l'enregistrement par défaut au premier lancement. */
export async function getSettings(): Promise<Settings> {
  const existant = await db.settings.get('app');
  if (existant) {
    // Fusion défensive : si une nouvelle version de l'application ajoute un champ,
    // les installations existantes ne se retrouvent pas avec `undefined`.
    return { ...parametresParDefaut(), ...existant, id: 'app' };
  }
  const defaut = parametresParDefaut();
  await db.settings.put(defaut);
  return defaut;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ ...settings, id: 'app' });
}

/** Efface toutes les données locales. Action irréversible, à confirmer deux fois. */
export async function effacerToutesLesDonnees(): Promise<void> {
  await db.transaction(
    'rw',
    [db.settings, db.clients, db.bons, db.factures, db.compteurs, db.documentsChauffeur, db.audit],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.clients.clear(),
        db.bons.clear(),
        db.factures.clear(),
        db.compteurs.clear(),
        db.documentsChauffeur.clear(),
        db.audit.clear(),
      ]);
    },
  );
}
