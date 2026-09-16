/**
 * Service métier des factures.
 *
 * Une facture est créée soit depuis un bon de commande (cas courant), soit librement.
 * Les montants sont CALCULÉS à la création par le moteur TVA, puis FIGÉS : un PDF émis
 * ne doit jamais être recalculé, sinon deux impressions du même document pourraient
 * afficher deux montants différents.
 */

import { db } from '../../lib/db';
import { identifiant, journaliser } from '../../lib/audit';
import { optionsDepuisSettings, prochainNumero } from '../../lib/numbering';
import { ajouterJours, dateLocaleISO } from '../../lib/format';
import { calculerTotaux, mentionTVA } from '../../lib/tva';
import { snapshotClient, snapshotEmetteur } from '../../lib/snapshots';
import { genererEtStockerPdfFacture } from '../../lib/pdf/generate';
import type {
  Bon,
  Client,
  Facture,
  LignePrestation,
  ModePaiement,
  Settings,
  StatutFacture,
} from '../../types';

/**
 * Statut réellement affiché : une facture émise dont l'échéance est dépassée est
 * « en retard ». Le calcul est déterministe et testable (la date du jour est injectée).
 */
export function statutEffectif(facture: Facture, aujourdHui: string = dateLocaleISO()): StatutFacture {
  if (facture.statut === 'payee' || facture.statut === 'annulee') return facture.statut;
  if (facture.dateEcheance && facture.dateEcheance < aujourdHui) return 'en_retard';
  return facture.statut;
}

export function estEnRetard(facture: Facture, aujourdHui: string = dateLocaleISO()): boolean {
  return statutEffectif(facture, aujourdHui) === 'en_retard';
}

function calculerMontants(
  lignes: LignePrestation[],
  settings: Settings,
  remiseGlobale: Bon['remiseGlobale'],
) {
  return calculerTotaux(lignes, {
    regimeTVA: settings.regimeTVA,
    traitementPeages: settings.traitementPeages,
    remiseGlobale,
  });
}

/**
 * Crée la facture associée à un bon de commande.
 * Refuse la double facturation : c'est la protection la plus importante de ce module.
 */
export async function creerFactureDepuisBon(
  bonId: string,
  settings: Settings,
  options: { dateEmission?: string; datePrestation?: string } = {},
): Promise<Facture> {
  const bon = await db.bons.get(bonId);
  if (!bon) throw new Error('Bon introuvable.');
  if (bon.statut === 'brouillon') {
    throw new Error('Émettez d’abord le bon de commande avant de créer la facture.');
  }
  if (bon.factureId) {
    throw new Error(
      'Ce bon a déjà été facturé. Utilisez « Dupliquer » pour créer une nouvelle version.',
    );
  }
  if (!bon.clientSnapshot || !bon.emetteurSnapshot) {
    throw new Error('Le bon doit être émis avant de pouvoir être facturé.');
  }

  const dateEmission = options.dateEmission ?? dateLocaleISO();
  const datePrestation = options.datePrestation ?? bon.datePriseEnCharge ?? dateEmission;
  const dateEcheance = ajouterJours(dateEmission, settings.delaiPaiementJours || 0);
  const annee = Number(dateEmission.slice(0, 4));
  const numero = await prochainNumero(optionsDepuisSettings(settings, 'facture', annee));

  const totaux = calculerMontants(bon.lignes, settings, bon.remiseGlobale);

  const facture: Facture = {
    id: identifiant(),
    numero,
    type: 'facture',
    bonId: bon.id,
    factureOrigineId: null,
    clientId: bon.clientId,
    clientSnapshot: bon.clientSnapshot,
    emetteurSnapshot: bon.emetteurSnapshot,
    dateEmission,
    datePrestation,
    dateEcheance,
    lignes: bon.lignes,
    remiseGlobale: bon.remiseGlobale,
    montantHT: totaux.totalHT,
    montantTVA: totaux.totalTVA,
    montantTTC: totaux.totalTTC,
    montantDebours: totaux.totalDebours,
    detailTVA: totaux.detailTVA,
    mentionTVA: totaux.mentionTVA || mentionTVA(settings.regimeTVA),
    conditionsPaiement: settings.conditionsPaiement,
    penalitesRetard: settings.penalitesRetard,
    escompteTexte: settings.escompteTexte,
    mentionSpecifique: settings.mentionSpecifique,
    statut: 'emise',
    datePaiement: null,
    moyenPaiement: null,
    notes: '',
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
  };

  await db.factures.put(facture);
  await db.bons.update(bon.id, { statut: 'facture', factureId: facture.id });
  await journaliser(
    'facture',
    facture.id,
    'creation',
    `Facture ${numero} créée depuis le bon ${bon.numero ?? bon.id}`,
  );

  try {
    await genererEtStockerPdfFacture(facture.id, settings);
  } catch (erreur) {
    await journaliser(
      'facture',
      facture.id,
      'modification',
      `Échec de génération du PDF : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`,
    );
  }

  return (await db.factures.get(facture.id)) ?? facture;
}

/** Crée une facture sans bon de commande (course ponctuelle). */
export async function creerFactureLibre(
  client: Client,
  lignes: LignePrestation[],
  settings: Settings,
  options: { dateEmission?: string; datePrestation?: string; remiseGlobale?: Bon['remiseGlobale'] } = {},
): Promise<Facture> {
  const dateEmission = options.dateEmission ?? dateLocaleISO();
  const datePrestation = options.datePrestation ?? dateEmission;
  const dateEcheance = ajouterJours(dateEmission, settings.delaiPaiementJours || 0);
  const annee = Number(dateEmission.slice(0, 4));
  const numero = await prochainNumero(optionsDepuisSettings(settings, 'facture', annee));

  const remise = options.remiseGlobale ?? null;
  const totaux = calculerMontants(lignes, settings, remise);

  const facture: Facture = {
    id: identifiant(),
    numero,
    type: 'facture',
    bonId: null,
    factureOrigineId: null,
    clientId: client.id,
    clientSnapshot: snapshotClient(client),
    emetteurSnapshot: snapshotEmetteur(settings),
    dateEmission,
    datePrestation,
    dateEcheance,
    lignes,
    remiseGlobale: remise,
    montantHT: totaux.totalHT,
    montantTVA: totaux.totalTVA,
    montantTTC: totaux.totalTTC,
    montantDebours: totaux.totalDebours,
    detailTVA: totaux.detailTVA,
    mentionTVA: totaux.mentionTVA || mentionTVA(settings.regimeTVA),
    conditionsPaiement: settings.conditionsPaiement,
    penalitesRetard: settings.penalitesRetard,
    escompteTexte: settings.escompteTexte,
    mentionSpecifique: settings.mentionSpecifique,
    statut: 'emise',
    datePaiement: null,
    moyenPaiement: null,
    notes: '',
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
  };

  await db.factures.put(facture);
  await journaliser('facture', facture.id, 'creation', `Facture ${numero} créée sans bon`);
  try {
    await genererEtStockerPdfFacture(facture.id, settings);
  } catch {
    // Le PDF pourra être régénéré depuis la fiche de la facture.
  }
  return (await db.factures.get(facture.id)) ?? facture;
}

/**
 * Émet un avoir sur une facture : montants négatifs, numérotation propre, référence
 * explicite à la facture d'origine, et passage de celle-ci au statut « annulée ».
 */
export async function creerAvoir(factureId: string, settings: Settings): Promise<Facture> {
  const origine = await db.factures.get(factureId);
  if (!origine) throw new Error('Facture introuvable.');
  if (origine.type === 'avoir') throw new Error('Un avoir ne peut pas être annulé par un avoir.');
  if (origine.statut === 'annulee') throw new Error('Cette facture est déjà annulée.');

  const dateEmission = dateLocaleISO();
  const annee = Number(dateEmission.slice(0, 4));
  const numero = await prochainNumero(optionsDepuisSettings(settings, 'avoir', annee));

  const lignesNegatives: LignePrestation[] = origine.lignes.map((ligne) => ({
    ...ligne,
    id: identifiant(),
    prixUnitaireCentimes: -ligne.prixUnitaireCentimes,
  }));

  const totaux = calculerMontants(lignesNegatives, settings, origine.remiseGlobale);

  const avoir: Facture = {
    ...origine,
    id: identifiant(),
    numero,
    type: 'avoir',
    bonId: origine.bonId,
    factureOrigineId: origine.id,
    dateEmission,
    datePrestation: origine.datePrestation,
    dateEcheance: dateEmission,
    lignes: lignesNegatives,
    montantHT: totaux.totalHT,
    montantTVA: totaux.totalTVA,
    montantTTC: totaux.totalTTC,
    montantDebours: totaux.totalDebours,
    detailTVA: totaux.detailTVA,
    statut: 'emise',
    datePaiement: null,
    moyenPaiement: null,
    pdfBlob: null,
    pdfGenereLe: null,
    historique: [],
    supprime: false,
    supprimeLe: null,
  };

  await db.factures.put(avoir);
  await db.factures.update(origine.id, { statut: 'annulee' });
  await journaliser('facture', avoir.id, 'creation', `Avoir ${numero} sur la facture ${origine.numero}`);

  try {
    await genererEtStockerPdfFacture(avoir.id, settings);
  } catch {
    // PDF régénérable depuis la fiche.
  }
  return (await db.factures.get(avoir.id)) ?? avoir;
}

export async function marquerPayee(
  factureId: string,
  datePaiement: string,
  moyenPaiement: ModePaiement,
  settings: Settings,
): Promise<void> {
  await db.factures.update(factureId, { statut: 'payee', datePaiement, moyenPaiement });
  await journaliser('facture', factureId, 'modification', `Marquée payée le ${datePaiement}`);
  try {
    await genererEtStockerPdfFacture(factureId, settings);
  } catch {
    // Le tampon « PAYÉE » sera appliqué à la prochaine régénération.
  }
}

export async function annulerPaiement(factureId: string, settings: Settings): Promise<void> {
  await db.factures.update(factureId, { statut: 'emise', datePaiement: null, moyenPaiement: null });
  await journaliser('facture', factureId, 'modification', 'Paiement annulé');
  try {
    await genererEtStockerPdfFacture(factureId, settings);
  } catch {
    // PDF régénérable.
  }
}

export async function mettreFactureALaCorbeille(factureId: string): Promise<void> {
  await db.factures.update(factureId, { supprime: true, supprimeLe: new Date().toISOString() });
  await journaliser('facture', factureId, 'suppression', 'Facture placée dans la corbeille');
}

export async function restaurerFacture(factureId: string): Promise<void> {
  await db.factures.update(factureId, { supprime: false, supprimeLe: null });
  await journaliser('facture', factureId, 'modification', 'Facture restaurée');
}

export async function lireFactures(includeSupprimes = false): Promise<Facture[]> {
  const toutes = await db.factures.orderBy('dateEmission').reverse().toArray();
  return includeSupprimes ? toutes : toutes.filter((facture) => !facture.supprime);
}

export interface Indicateurs {
  chiffreAffairesTTC: number;
  totalHT: number;
  totalTVA: number;
  enAttente: number;
  nombreEnRetard: number;
}

/**
 * Indicateurs de l'année. Les avoirs viennent en déduction, et une facture annulée
 * n'est jamais comptée.
 */
export function calculerIndicateurs(factures: Facture[], annee: number): Indicateurs {
  const retenues = factures.filter(
    (facture) => !facture.supprime && Number(facture.dateEmission.slice(0, 4)) === annee,
  );

  const indicateurs: Indicateurs = {
    chiffreAffairesTTC: 0,
    totalHT: 0,
    totalTVA: 0,
    enAttente: 0,
    nombreEnRetard: 0,
  };

  for (const facture of retenues) {
    if (facture.statut === 'annulee') continue;
    indicateurs.chiffreAffairesTTC += facture.montantTTC;
    indicateurs.totalHT += facture.montantHT;
    indicateurs.totalTVA += facture.montantTVA;
    if (facture.statut === 'emise' || facture.statut === 'en_retard') {
      indicateurs.enAttente += facture.montantTTC;
      if (estEnRetard(facture)) indicateurs.nombreEnRetard += 1;
    }
  }

  return indicateurs;
}
