/**
 * Service métier des bons de commande.
 *
 * Le point critique : l'ÉMISSION. C'est l'acte qui
 *  - vérifie la conformité (les 7 mentions de l'arrêté du 6 août 2025) ;
 *  - attribue un numéro définitif, de façon atomique ;
 *  - FIGE les informations de l'exploitant et du client dans le document ;
 *  - génère et stocke le PDF.
 *
 * Un brouillon n'a pas de numéro : sans cela, un brouillon abandonné créerait un trou
 * dans la séquence, ce que la réglementation interdit.
 */

import { db } from '../../lib/db';
import { identifiant, journaliser } from '../../lib/audit';
import { optionsDepuisSettings, prochainNumero } from '../../lib/numbering';
import { snapshotClient, snapshotEmetteur } from '../../lib/snapshots';
import { dateLocaleISO, heureLocale } from '../../lib/format';
import { verifierAcces } from '../../lib/acces';
import { blocages, verifierConformiteBon } from './conformite';
import { genererEtStockerPdfBon } from '../../lib/pdf/generate';
import type { Bon, Client, LignePrestation, Settings } from '../../types';

export class ErreurConformite extends Error {
  readonly problemes: string[];
  constructor(problemes: string[]) {
    super(problemes.join('\n'));
    this.name = 'ErreurConformite';
    this.problemes = problemes;
  }
}

export function ligneVide(settings: Settings): LignePrestation {
  return {
    id: identifiant(),
    libelle: 'Transport de personnes',
    quantite: 1,
    prixUnitaireCentimes: 0,
    tauxTVA: settings.regimeTVA === 'franchise_en_base' ? 0 : settings.tauxTVADefaut,
    estDebours: false,
  };
}

/**
 * Bon vide, pré-rempli avec l'instant présent et le véhicule habituel.
 *
 * `instant` est le moment où le bon est ÉTABLI, et il gouverne d'un seul coup la date de
 * création et les quatre champs d'horodatage. Le recevoir plutôt que le relire ici n'est
 * pas une commodité de test : deux lectures d'horloge séparées par une frontière de
 * minute donneraient une réservation et une prise en charge espacées d'une minute que
 * personne n'a vécue — et, avec l'antédatation, une réservation qui semblerait reculée
 * d'une minute de plus que le réglage demandé.
 *
 * L'appelant qui ne fournit rien obtient l'instant présent, ce qui est le cas de la
 * saisie manuelle.
 */
export function bonVide(
  settings: Settings,
  clientParDefaut: Client | null,
  instant: Date = new Date(),
): Bon {
  const maintenant = instant;
  return {
    id: identifiant(),
    numero: null,
    statut: 'brouillon',
    clientId: clientParDefaut?.id ?? '',
    clientSnapshot: null,
    emetteurSnapshot: null,
    creeLe: maintenant.toISOString(),
    dateReservation: dateLocaleISO(maintenant),
    heureReservation: heureLocale(maintenant),
    datePriseEnCharge: dateLocaleISO(maintenant),
    heurePriseEnCharge: heureLocale(maintenant),
    lieuPriseEnCharge: '',
    destination: '',
    distanceKm: null,
    typePrestation: 'course_simple',
    numeroVolTrain: '',
    terminal: '',
    bagages: '',
    nombrePassagers: null,
    vehiculeMarque: settings.vehiculeMarque,
    vehiculeModele: settings.vehiculeModele,
    vehiculeImmatriculation: settings.vehiculeImmatriculation,
    vehiculeCouleur: settings.vehiculeCouleur,
    nomConducteur: '',
    lignes: [ligneVide(settings)],
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
  };
}

export async function enregistrerBrouillon(bon: Bon): Promise<void> {
  const existant = await db.bons.get(bon.id);
  await db.bons.put(bon);
  await journaliser(
    'bon',
    bon.id,
    existant ? 'modification' : 'creation',
    existant ? `Brouillon modifié (${bon.numero ?? 'sans numéro'})` : 'Brouillon créé',
  );
}

/**
 * Émet un bon. Lève `ErreurConformite` si un blocage subsiste.
 * Le numéro, la copie figée des identités et le PDF sont produits ici, et nulle part ailleurs.
 */
export async function emettreBon(
  bonId: string,
  settings: Settings,
  client: Client | null,
): Promise<Bon> {
  const bon = await db.bons.get(bonId);
  if (!bon) throw new Error('Bon introuvable.');

  // AVANT tout le reste, et donc avant `prochainNumero`. Un plafond atteint ne doit
  // consommer AUCUN numéro : la séquence légale ne porte pas de trou pour un document
  // qui n'a pas été émis. Placé plus bas, ce contrôle perdrait un rang à chaque refus.
  //
  // Il passe aussi avant le contrôle de conformité, et c'est délibéré : il est plus
  // utile de dire au chauffeur qu'il a épuisé ses bons que de lui demander de corriger
  // un document qu'il n'a pas le droit d'émettre de toute façon.
  await verifierAcces('bons');

  const problemes = verifierConformiteBon(bon, settings, client);
  const bloquants = blocages(problemes);
  if (bloquants.length > 0) {
    throw new ErreurConformite(bloquants.map((probleme) => probleme.message));
  }

  const annee = Number((bon.datePriseEnCharge || dateLocaleISO()).slice(0, 4));
  const numero = await prochainNumero(optionsDepuisSettings(settings, 'bon', annee));

  const bonEmis: Bon = {
    ...bon,
    numero,
    statut: 'emis',
    clientSnapshot: client ? snapshotClient(client) : null,
    emetteurSnapshot: snapshotEmetteur(settings),
  };

  await db.bons.put(bonEmis);
  await journaliser('bon', bon.id, 'modification', `Bon émis sous le numéro ${numero}`);

  try {
    await genererEtStockerPdfBon(bonId, settings, client);
  } catch (erreur) {
    // Le bon est émis et numéroté même si le rendu PDF échoue : on ne perd pas un numéro
    // de séquence. L'utilisateur peut régénérer le PDF depuis la fiche du bon.
    await journaliser(
      'bon',
      bon.id,
      'modification',
      `Échec de génération du PDF : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`,
    );
  }

  return (await db.bons.get(bonId)) ?? bonEmis;
}

/** Enregistre une modification d'un bon et journalise les champs modifiés. */
export async function modifierBon(
  bon: Bon,
  champsModifies: { champ: string; ancienneValeur: string; nouvelleValeur: string }[],
): Promise<void> {
  const historique = [...bon.historique];
  const maintenant = new Date().toISOString();
  for (const modification of champsModifies) {
    historique.push({ dateISO: maintenant, motif: 'Correction manuelle', ...modification });
  }
  await db.bons.put({ ...bon, historique });
  await journaliser(
    'bon',
    bon.id,
    'modification',
    champsModifies.map((m) => m.champ).join(', ') || 'modification',
  );
}

/**
 * Corrige la date ou l'heure de réservation en conservant la valeur d'origine dans
 * l'historique. L'horodatage initial est immuable : on n'écrase jamais une trace.
 */
export async function corrigerReservation(
  bonId: string,
  dateReservation: string,
  heureReservation: string,
): Promise<void> {
  const bon = await db.bons.get(bonId);
  if (!bon) return;
  const historique = [
    ...bon.historique,
    {
      dateISO: new Date().toISOString(),
      champ: 'dateReservation',
      ancienneValeur: `${bon.dateReservation} ${bon.heureReservation}`,
      nouvelleValeur: `${dateReservation} ${heureReservation}`,
      motif: 'Correction manuelle de l’horodatage de réservation',
    },
  ];
  await db.bons.put({ ...bon, dateReservation, heureReservation, historique });
  await journaliser('bon', bonId, 'modification', 'Horodatage de réservation corrigé');
}

/** Duplique un bon pour créer une nouvelle version (même un bon déjà facturé). */
export async function dupliquerBon(bonId: string): Promise<Bon | null> {
  const bon = await db.bons.get(bonId);
  if (!bon) return null;
  const maintenant = new Date();
  const copie: Bon = {
    ...bon,
    id: identifiant(),
    numero: null,
    statut: 'brouillon',
    creeLe: maintenant.toISOString(),
    dateReservation: dateLocaleISO(maintenant),
    heureReservation: heureLocale(maintenant),
    clientSnapshot: null,
    emetteurSnapshot: null,
    factureId: null,
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
  };
  await db.bons.put(copie);
  await journaliser('bon', copie.id, 'creation', `Bon dupliqué depuis ${bon.numero ?? 'un brouillon'}`);
  return copie;
}

/** Met un bon à la corbeille. Le numéro n'est jamais réutilisé. */
export async function mettreBonALaCorbeille(bonId: string): Promise<void> {
  await db.bons.update(bonId, { supprime: true, supprimeLe: new Date().toISOString() });
  await journaliser('bon', bonId, 'suppression', 'Bon placé dans la corbeille');
}

export async function restaurerBon(bonId: string): Promise<void> {
  await db.bons.update(bonId, { supprime: false, supprimeLe: null });
  await journaliser('bon', bonId, 'modification', 'Bon restauré depuis la corbeille');
}

export async function lireBons(includeSupprimes = false): Promise<Bon[]> {
  const tous = await db.bons.orderBy('creeLe').reverse().toArray();
  return includeSupprimes ? tous : tous.filter((bon) => !bon.supprime);
}
